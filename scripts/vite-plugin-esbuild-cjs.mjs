/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Vite plugin that uses esbuild to pre-bundle CJS packages into proper ESM
 * before Rollup processes them.
 *
 * This replaces @rollup/plugin-commonjs by using esbuild (which robustly handles
 * CJS→ESM conversion including __exportStar, module.exports, require() patterns)
 * to pre-bundle problematic CJS packages into proper ESM modules with explicit
 * named exports.
 *
 * Advantages over @rollup/plugin-commonjs:
 * - esbuild evaluates require() calls at build time (not static analysis)
 * - Handles __exportStar(require(...)) barrel patterns correctly
 * - Handles module.exports = value (default export) correctly
 * - Resolves CJS require chains properly
 * - Much faster than rollup's CJS transform
 */

import { build } from 'esbuild';
import { resolve, dirname } from 'path';
import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { createHash } from 'crypto';

// Cache for pre-bundled ESM modules
const bundleCache = new Map();

// Cache for auto-detected named exports from each package
const detectedExports = new Map();

/**
 * Scan esbuild output to auto-detect all named exports from CJS modules.
 * Looks for `exports.XXX =`, `exports2.XXX =`, `exports3.XXX =` etc.
 * patterns which esbuild generates when converting CJS barrel modules.
 */
function detectExportsFromCode(code) {
  const exportNames = new Set();

  // Match exports, exports2, exports3, etc. — esbuild uses numbered
  // variables for different scope levels in the bundle
  const allExportRe = /\bexports\d*\.(\w+)\s*=/g;
  let match;
  while ((match = allExportRe.exec(code)) !== null) {
    const name = match[1];
    // Skip internal/private properties
    if (name !== '__esModule' && name !== 'default' && !name.startsWith('_')) {
      exportNames.add(name);
    }
  }

  return [...exportNames];
}

/**
 * Packages that need esbuild pre-bundling from CJS to ESM.
 * Each entry specifies the package name, entry point, and the named exports
 * that consumers expect.
 */
const CJS_PACKAGES = [
  {
    // @jupyterlab/coreutils uses __exportStar(require(...)) barrel
    name: '@jupyterlab/coreutils',
    exports: [
      'ActivityMonitor', 'LruCache', 'MarkdownCodeBlocks',
      'PageConfig', 'PathExt', 'Text', 'Time', 'URLExt',
    ],
  },
  {
    // @jupyterlab/services uses __exportStar barrel
    name: '@jupyterlab/services',
    exports: [
      'ServiceManager', 'ServerConnection', 'KernelManager',
      'SessionManager', 'ContentsManager', 'TerminalManager',
      'SettingManager', 'WorkspaceManager', 'EventManager',
      'NbConvertManager', 'KernelSpecManager', 'UserManager',
      'BuildManager', 'BaseManager', 'ConfigSection',
      'ConfigSectionManager', 'ConfigWithDefaults',
      'ConnectionStatus', 'Drive', 'RestContentProvider',
    ],
  },
  {
    // @jupyterlab/statedb uses __exportStar barrel
    name: '@jupyterlab/statedb',
    exports: ['DataConnector', 'StateDB', 'RestorablePool', 'IStateDB'],
  },
  {
    // mime uses module.exports = new Mime(...)
    name: 'mime',
    defaultExport: true,
    exports: [], // only default
  },
  {
    // jquery uses module.exports = jQuery
    name: 'jquery',
    defaultExport: true,
    exports: ['jQuery', '$'],
  },
  {
    // vscode-jsonrpc CJS barrel
    name: 'vscode-jsonrpc',
    exports: [
      'AbstractMessageReader', 'AbstractMessageWriter',
      'ReadableStreamMessageReader', 'WriteableStreamMessageWriter',
      'StreamMessageReader', 'StreamMessageWriter',
      'createMessageConnection', 'RequestType', 'NotificationType',
    ],
  },
  {
    // ajv uses module.exports = Ajv
    name: 'ajv',
    defaultExport: true,
    exports: [],
  },
  {
    // lodash.escape uses module.exports = escape
    name: 'lodash.escape',
    defaultExport: true,
    exports: [],
  },
  {
    // yjs re-exports
    name: 'yjs',
    exports: [
      'Doc', 'Map', 'Array', 'Text',
      'XmlElement', 'XmlFragment', 'XmlHook', 'XmlText',
    ],
    defaultExport: true,
  },
  {
    // json5 uses module.exports = JSON5 object with parse/stringify
    name: 'json5',
    defaultExport: true,
    exports: ['parse', 'stringify'],
  },
];

/**
 * Creates a Vite plugin that pre-bundles CJS packages to ESM using esbuild.
 */
export function esbuildCjsToEsm(options = {}) {
  const {
    // Root directory for resolving packages
    rootDir = process.cwd(),
    // Additional packages to pre-bundle
    additionalPackages = [],
    // Cache directory
    cacheDir = resolve(rootDir, 'node_modules/.cache/esbuild-cjs-esm'),
    // Packages whose sub-path imports should also be handled
    deepImportPackages = [
      '@jupyterlab/services',
      '@jupyterlab/coreutils',
      'vscode-jsonrpc',
    ],
    // External packages that shouldn't be bundled into the pre-bundled modules
    external = [
      'electron',
      'path', 'fs', 'os', 'util', 'crypto', 'stream', 'events', 'buffer',
      'http', 'https', 'net', 'tls', 'zlib', 'url', 'querystring',
      'child_process', 'worker_threads', 'assert',
    ],
    // Platform
    platform = 'browser',
  } = options;

  const packages = [...CJS_PACKAGES, ...additionalPackages];
  const packageNames = new Set(packages.map(p => p.name));

  // Map from resolved file path to package info
  const resolvedPackages = new Map();

  return {
    name: 'esbuild-cjs-to-esm',
    enforce: 'pre',

    async buildStart() {
      // Ensure cache directory exists
      mkdirSync(cacheDir, { recursive: true });

      // Pre-bundle each CJS package
      for (const pkg of packages) {
        try {
          const entryPoint = resolvePackageEntry(pkg.name, rootDir);
          if (!entryPoint) {
            console.warn(`[esbuild-cjs-to-esm] Could not resolve entry for ${pkg.name}, skipping`);
            continue;
          }

          const cacheKey = computeCacheKey(entryPoint, pkg);
          const cachePath = resolve(cacheDir, `${cacheKey}.mjs`);

          // Check cache
          if (existsSync(cachePath) && !options.force) {
            const cached = readFileSync(cachePath, 'utf-8');
            bundleCache.set(pkg.name, cached);
            resolvedPackages.set(pkg.name, entryPoint);
            // Auto-detect exports from cached code
            const exports = detectExportsFromCode(cached);
            detectedExports.set(pkg.name, exports);
            console.log(`[esbuild-cjs-to-esm] Loaded ${pkg.name} from cache (${exports.length} exports detected)`);
            continue;
          }

          console.log(`[esbuild-cjs-to-esm] Pre-bundling ${pkg.name}...`);

          // Use esbuild to bundle the CJS package into a single ESM module
          const result = await build({
            entryPoints: [entryPoint],
            bundle: true,
            format: 'esm',
            platform: platform,
            target: 'esnext',
            write: false,
            metafile: true,
            // Don't bundle other CJS packages or externals into this bundle
            external: [
              ...external,
              // Don't bundle peer deps — they'll be resolved separately
              ...packages
                .filter(p => p.name !== pkg.name)
                .map(p => p.name),
            ],
            // Handle JSX in .js files (common in React packages)
            loader: { '.js': 'jsx' },
            define: {
              'process.env.NODE_ENV': JSON.stringify('production'),
              global: 'globalThis',
            },
            // Preserve original module structure for better tree-shaking
            treeShaking: true,
            // Log level
            logLevel: 'warning',
          });

          if (result.outputFiles && result.outputFiles.length > 0) {
            const code = result.outputFiles[0].text;
            bundleCache.set(pkg.name, code);
            resolvedPackages.set(pkg.name, entryPoint);

            // Auto-detect exports from bundled code
            const exports = detectExportsFromCode(code);
            detectedExports.set(pkg.name, exports);

            // Write to cache
            writeFileSync(cachePath, code, 'utf-8');
            console.log(`[esbuild-cjs-to-esm] Pre-bundled ${pkg.name} (${(code.length / 1024).toFixed(1)}KB, ${exports.length} exports)`);
          }
        } catch (err) {
          console.warn(`[esbuild-cjs-to-esm] Failed to pre-bundle ${pkg.name}:`, err.message);
        }
      }
    },

    resolveId(source, importer) {
      // Exact package name match
      if (bundleCache.has(source)) {
        return `\0esbuild-cjs-esm:${source}`;
      }

      // Handle deep imports like @jupyterlab/coreutils/lib/pageconfig.js
      for (const deepPkg of deepImportPackages) {
        if (source.startsWith(deepPkg + '/') && bundleCache.has(deepPkg)) {
          // Sub-path imports are served from the pre-bundled parent
          // esbuild already bundled all sub-modules into the parent
          return `\0esbuild-cjs-esm:${deepPkg}`;
        }
      }

      return null;
    },

    load(id) {
      if (!id.startsWith('\0esbuild-cjs-esm:')) return null;

      const pkgName = id.slice('\0esbuild-cjs-esm:'.length);
      const code = bundleCache.get(pkgName);

      if (!code) return null;

      // Detect __require("sibling-package") calls for other pre-bundled packages.
      // esbuild with format:'esm' generates __require() for externalized CJS deps
      // instead of ESM imports. In the browser, require() doesn't exist, so we
      // inject ESM imports and rewrite __require to a lookup function.
      const siblingRequires = [];
      const requireCallRe = /__require\("([^"]+)"\)/g;
      let reqMatch;
      while ((reqMatch = requireCallRe.exec(code)) !== null) {
        const dep = reqMatch[1];
        // Only handle deps that we also pre-bundle (sibling CJS packages)
        if (bundleCache.has(dep) && !siblingRequires.includes(dep)) {
          siblingRequires.push(dep);
        }
      }

      let processedCode = code;

      // If this bundle has __require() calls to sibling packages, inject a shim
      if (siblingRequires.length > 0) {
        // Generate ESM imports for each sibling (Rollup will resolve these
        // to our virtual modules via resolveId)
        const imports = siblingRequires
          .map((dep, i) => `import __sibling_${i}__ from "${dep}";`)
          .join('\n');

        // Build a require shim that maps package names to the imported modules
        const mapping = siblingRequires
          .map((dep, i) => `  "${dep}": __sibling_${i}__`)
          .join(',\n');

        const requireShim = `
${imports}
var __sibling_map__ = {
${mapping}
};
`;
        // Replace esbuild's __require definition with our shim version
        // esbuild generates: var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : ...
        const esbuildRequireDef = /var __require = \/\* @__PURE__ \*\/ \(\(x\) =>[\s\S]*?\)\(function\(x\) \{[\s\S]*?\}\);/;
        if (esbuildRequireDef.test(processedCode)) {
          processedCode = processedCode.replace(esbuildRequireDef,
            `${requireShim}\nvar __require = function(x) { if (__sibling_map__[x]) return __sibling_map__[x]; throw Error('Dynamic require of "' + x + '" is not supported'); };`
          );
        } else {
          // Fallback: prepend imports and add a global __require if not already defined
          processedCode = `${requireShim}\nif (typeof __require === 'undefined') { var __require = function(x) { if (__sibling_map__[x]) return __sibling_map__[x]; throw Error('Dynamic require of "' + x + '" is not supported'); }; }\n${processedCode}`;
        }
      }

      // Get auto-detected exports (or fallback to manual list)
      const pkg = packages.find(p => p.name === pkgName);
      const autoExports = detectedExports.get(pkgName) || [];
      const manualExports = (pkg && pkg.exports) || [];
      const allExports = [...new Set([...autoExports, ...manualExports])];

      // If we have named exports, wrap the esbuild output to add them.
      // esbuild CJS→ESM only generates `export default require_xxx()` or
      // `export { var as default }` — neither exposes named exports to Rollup.
      if (allExports.length > 0) {
        // Pattern 1: export default require_xxx();
        const exportDefaultRe = /export default ([\w$]+\(.*?\));?\s*$/;
        // Pattern 2: export { some_var as default };
        const exportBracketRe = /export\s*\{\s*([\w$]+)\s+as\s+default\s*\};?\s*$/;

        const match = processedCode.match(exportDefaultRe) || processedCode.match(exportBracketRe);

        if (match) {
          const defaultExpr = match[1];
          const before = processedCode.slice(0, match.index);
          // Use unique alias names to avoid colliding with internal declarations
          const namedExports = allExports
            .map(name => `const __cjs_export_${name}__ = __cjs_default__["${name}"];`)
            .join('\n');
          const reExports = allExports
            .map(name => `__cjs_export_${name}__ as ${name}`)
            .join(', ');

          const wrappedCode = `${before}
const __cjs_default__ = ${defaultExpr};
${namedExports}
export default __cjs_default__;
export { ${reExports} };
`;
          return { code: wrappedCode, map: null };
        }
      }

      return { code: processedCode, map: null };
    },
  };
}

/**
 * Resolve the entry point of a package from the root directory.
 */
function resolvePackageEntry(pkgName, rootDir) {
  // Try multiple resolution strategies
  const strategies = [
    // Strategy 1: Direct node_modules resolution
    () => {
      const pkgJsonPath = resolve(rootDir, 'node_modules', pkgName, 'package.json');
      if (existsSync(pkgJsonPath)) {
        const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
        const entry = pkgJson.module || pkgJson.main || 'index.js';
        return resolve(dirname(pkgJsonPath), entry);
      }
      return null;
    },
    // Strategy 2: Hoisted node_modules (monorepo)
    () => {
      let dir = rootDir;
      for (let i = 0; i < 6; i++) {
        const pkgJsonPath = resolve(dir, 'node_modules', pkgName, 'package.json');
        if (existsSync(pkgJsonPath)) {
          const pkgJson = JSON.parse(readFileSync(pkgJsonPath, 'utf-8'));
          const entry = pkgJson.module || pkgJson.main || 'index.js';
          return resolve(dirname(pkgJsonPath), entry);
        }
        dir = dirname(dir);
      }
      return null;
    },
  ];

  for (const strategy of strategies) {
    const result = strategy();
    if (result && existsSync(result)) {
      return result;
    }
  }

  return null;
}

/**
 * Compute a cache key for a pre-bundled module based on its entry file content.
 */
function computeCacheKey(entryPoint, pkg) {
  const hash = createHash('md5');
  hash.update(pkg.name);
  try {
    const content = readFileSync(entryPoint, 'utf-8');
    hash.update(content);
  } catch {
    hash.update(Date.now().toString());
  }
  return `${pkg.name.replace(/[/@]/g, '_')}-${hash.digest('hex').slice(0, 12)}`;
}
