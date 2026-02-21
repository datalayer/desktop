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
 * Loading order:
 * 1. Lodash globals - Makes _ and Backbone available globally for Jupyter widgets
 * 2. RequireJS - AMD module compatibility for Jupyter widgets
 */

// 1. Global lodash/underscore/Backbone setup (needed by Jupyter widgets)
import './lodash-globals';

// 2. RequireJS/AMD compatibility shim (needed by Jupyter widgets)
import './requirejs';

// Global object polyfill for MathJax
if (typeof global === 'undefined') {
  (window as unknown as Record<string, unknown>).global = window;
}

// Export for convenience
// @ts-expect-error - Importing JS file
export { default as lodash } from './lodash-globals';
// @ts-expect-error - Importing JS file
export { Backbone } from './lodash-globals';
