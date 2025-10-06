/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * @module renderer/polyfills
 *
 * Master polyfill loader for the renderer process.
 * Ensures compatibility with various module systems and provides required globals.
 *
 * @remarks
 * CRITICAL: These polyfills MUST be loaded in this exact order to prevent
 * temporal dead zone errors and ensure all dependencies are available.
 *
 * Loading order:
 * 1. Symbol - Must be first, React needs Symbol.for
 * 2. Lodash numbered variations - Needed by bundled lodash code
 * 3. Lodash internals - Data structures used by lodash
 * 4. Lodash globals - Makes _ and Backbone available globally
 * 5. Node.js builtins - Path, os, crypto, etc.
 * 6. RequireJS - AMD module compatibility
 * 7. JupyterLab proxy - Must be last as it depends on other polyfills
 */

// Starting polyfill loading sequence...

// 1. CRITICAL: Symbol must be first - React uses Symbol.for immediately
import './symbol';

// 2. Lodash numbered variations (baseGetTag$1-$10, base$1-$10, etc.)
import './lodash-numbered';

// 3. Lodash internal data structures (ListCache, MapCache, Stack, Hash)
import './lodash-internals';

// 4. Global lodash/underscore/Backbone setup
import './lodash-globals';

// 5. Node.js built-in module polyfills
// Commented out due to production build issues
// import './nodejs-builtins';

// 6. RequireJS/AMD compatibility shim
import './requirejs';

// 7. JupyterLab services proxy (depends on other polyfills)
// Note: This is imported elsewhere when needed, not globally
// export * from './jupyterlab-proxy';

// Global object polyfill for MathJax
if (typeof global === 'undefined') {
  (window as unknown as Record<string, unknown>).global = window;
}

// All polyfills loaded successfully

// Export for convenience
// @ts-expect-error - Importing JS file
export { default as lodash } from './lodash-globals';
// @ts-expect-error - Importing JS file
export { Backbone } from './lodash-globals';
