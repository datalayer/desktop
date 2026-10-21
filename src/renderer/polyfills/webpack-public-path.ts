/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * @module renderer/polyfills/webpack-public-path
 *
 * `@jupyter-widgets` (through `@datalayer/jupyter-react`) reads a bare
 * `__webpack_public_path__` when its module runs — a variable webpack
 * provides and Vite does not. The renderer's `define` replaces it in the
 * sources Vite transforms, not in the pre-bundled dependencies, so the
 * window went blank on a `ReferenceError` once signed in. Declared here, on
 * the global object, before any other module runs: a bare identifier
 * resolves to it.
 */

const globals = globalThis as unknown as Record<string, unknown>;
if (globals.__webpack_public_path__ === undefined) {
  globals.__webpack_public_path__ = '';
}

export {};
