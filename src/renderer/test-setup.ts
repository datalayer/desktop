/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Test setup file for vitest.
 * Adds @testing-library/jest-dom matchers to vitest expect.
 *
 * @module test-setup
 */

import '@testing-library/jest-dom/vitest';
// The webpack global Jupyter widgets read bare when they load, declared as
// the app declares it before any module runs.
import './polyfills/webpack-public-path';

/*
 * happy-dom's `document` is not an `instanceof Document` (it is an
 * HTMLDocument of another class). primer-addons' Box puts its stylesheet in
 * the node's root and tells a document from a shadow root that way, so a
 * rendered Box would look for the document's owner and fail. The browser
 * answers true; the test window answers the same.
 */
if (typeof Document !== 'undefined' && !(document instanceof Document)) {
  const native = Document;
  Object.defineProperty(native, Symbol.hasInstance, {
    value: (value: unknown) =>
      value === document ||
      Function.prototype[Symbol.hasInstance].call(native, value),
  });
}
