/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * @module renderer/polyfills/requirejs
 *
 * RequireJS/AMD module system shim.
 * Provides a minimal AMD-compatible module loader for compatibility
 * with legacy Jupyter components that use define() and require().
 */

/**
 * RequireJS shim for Jupyter widgets in Electron
 *
 * This provides a minimal RequireJS implementation that allows Jupyter widgets
 * to load their view classes dynamically in the Electron/Vite environment.
 */

// Store loaded modules
const moduleRegistry = new Map();

// Register a path polyfill for CJS code that uses require("path").
// The Vite virtual module handles ESM imports, but CJS modules bundled with
// __commonJS wrappers call __require$1("path") which resolves to window.require,
// i.e. the requirejs shim below. Without this registration, the CJS call returns
// undefined and @jupyterlab/coreutils crashes on path_1.posix.join().
const pathModule = {
  join: function (...parts) {
    if (!parts || parts.length === 0) return '.';
    return parts
      .filter(p => p != null && p !== '')
      .join('/')
      .replace(/\/+/g, '/');
  },
  dirname: function (p) {
    if (!p) return '.';
    const idx = p.lastIndexOf('/');
    return idx <= 0 ? (p[0] === '/' ? '/' : '.') : p.slice(0, idx);
  },
  basename: function (p, ext) {
    if (!p) return '';
    const base = p.split('/').pop() || '';
    return ext && base.endsWith(ext) ? base.slice(0, -ext.length) : base;
  },
  extname: function (p) {
    if (!p) return '';
    const base = p.split('/').pop() || '';
    const idx = base.lastIndexOf('.');
    return idx <= 0 ? '' : base.slice(idx);
  },
  resolve: function (...paths) {
    return (
      '/' +
      paths
        .filter(p => p)
        .join('/')
        .replace(/\/+/g, '/')
    );
  },
  relative: function (from, to) {
    return to || '';
  },
  normalize: function (path) {
    if (!path || path === '') return '.';
    const isAbsolute = path[0] === '/';
    const parts = path.split('/').filter(p => p && p !== '.');
    const result = [];
    for (let i = 0; i < parts.length; i++) {
      if (parts[i] === '..') {
        if (result.length > 0 && result[result.length - 1] !== '..') {
          result.pop();
        } else if (!isAbsolute) {
          result.push('..');
        }
      } else {
        result.push(parts[i]);
      }
    }
    let normalized = result.join('/');
    if (isAbsolute) normalized = '/' + normalized;
    else if (normalized === '') normalized = '.';
    return normalized;
  },
  sep: '/',
  delimiter: ':',
  parse: function (p) {
    return {
      root: '',
      dir: this.dirname(p),
      base: this.basename(p),
      ext: this.extname(p),
      name: this.basename(p, this.extname(p)),
    };
  },
  posix: null,
};
pathModule.posix = pathModule;
moduleRegistry.set('path', pathModule);

// Define a minimal RequireJS-compatible loader
window.requirejs = function (deps, callback) {
  if (typeof deps === 'string') {
    // Single module request
    return moduleRegistry.get(deps);
  }

  // Multiple dependencies
  if (Array.isArray(deps) && callback) {
    const modules = deps.map(dep => moduleRegistry.get(dep) || {});
    callback(...modules);
  }
};

// Alias for compatibility
window.require = window.requirejs;

// RequireJS configuration
window.requirejs.config = function (config) {
  // Store config but don't process it - we handle modules directly
};

// Define function for registering modules
window.define = function (name, deps, factory) {
  // Handle different calling patterns
  if (typeof name !== 'string') {
    // Anonymous module
    factory = deps;
    deps = name;
    name = null;
  }

  if (!Array.isArray(deps)) {
    factory = deps;
    deps = [];
  }

  // Execute factory function
  if (typeof factory === 'function') {
    const depModules = deps.map(dep => {
      if (dep === 'exports') return {};
      if (dep === 'require') return window.requirejs;
      // Special handling for underscore/lodash
      if (dep === 'underscore' || dep === 'lodash') {
        return window._ || window.lodash || moduleRegistry.get(dep) || {};
      }
      return moduleRegistry.get(dep) || {};
    });

    const exports = {};
    const result = factory(...depModules);
    const module = result || exports;

    // Register the module if it has a name
    if (name) {
      moduleRegistry.set(name, module);
    }

    return module;
  }

  // Direct value
  if (name && factory !== undefined) {
    moduleRegistry.set(name, factory);
  }
};

// AMD flag
window.define.amd = {
  jQuery: true,
};

// Pre-register underscore/lodash if available
if (window._ || window.lodash) {
  const lodashModule = window._ || window.lodash;
  moduleRegistry.set('underscore', lodashModule);
  moduleRegistry.set('lodash', lodashModule);
}

// Pre-register Backbone if available
if (window.Backbone) {
  moduleRegistry.set('backbone', window.Backbone);
}

// Pre-register Jupyter widget modules that are already loaded
async function registerJupyterModules() {
  try {
    // Import widget modules
    const [base, controls, output] = await Promise.all([
      import('@jupyter-widgets/base'),
      import('@jupyter-widgets/controls'),
      import('@jupyter-widgets/output'),
    ]);

    // Register modules in RequireJS format
    moduleRegistry.set('@jupyter-widgets/base', base);
    moduleRegistry.set('@jupyter-widgets/controls', controls);
    moduleRegistry.set('@jupyter-widgets/output', output);

    // Also register with version numbers (common pattern)
    moduleRegistry.set('@jupyter-widgets/base@*', base);
    moduleRegistry.set('@jupyter-widgets/controls@*', controls);
    moduleRegistry.set('@jupyter-widgets/output@*', output);

    // Register specific view classes
    if (base.ErrorWidgetView) {
      moduleRegistry.set('@jupyter-widgets/base/ErrorWidgetView', {
        ErrorWidgetView: base.ErrorWidgetView,
      });
    }
  } catch (error) {
    // Failed to register modules
  }
}

// Register modules on load
registerJupyterModules();

// Export for debugging
window.__requireRegistry = moduleRegistry;
