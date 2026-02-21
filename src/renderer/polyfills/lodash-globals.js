/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * @module renderer/polyfills/lodash-globals
 *
 * Global lodash and Backbone setup.
 * Makes lodash available as underscore (_) and sets up Backbone globally
 * for compatibility with Jupyter widgets.
 */

import * as lodash from 'lodash';
import * as Backbone from 'backbone';

// Make lodash available globally as underscore
window._ = lodash;
window.lodash = lodash;
window.underscore = lodash;

// Make Backbone available globally for widgets
window.Backbone = Backbone;
globalThis.Backbone = Backbone;

// Export for use by other modules
export { lodash, Backbone };
export default lodash;
