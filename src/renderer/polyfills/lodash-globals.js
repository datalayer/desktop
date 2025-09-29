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

/**
 * Lodash/Underscore Global Setup
 * Makes lodash available globally as _ and underscore for Backbone compatibility
 */

import * as lodash from 'lodash';
import * as Backbone from 'backbone';

// CRITICAL: Define bulletproof extend function
function bulletproofExtend(object, ...sources) {
  const target = object && typeof object === 'object' ? object : {};
  sources.forEach(source => {
    if (source != null && typeof source === 'object') {
      for (const key in source) {
        if (Object.prototype.hasOwnProperty.call(source, key)) {
          const finalKey = key === 'class-name' ? 'className' : key;
          target[finalKey] = source[key];
        }
      }
    }
  });
  return target;
}

// Make lodash available globally as underscore
window._ = lodash;
window.lodash = lodash;
window.underscore = lodash;

// Override extend functions with bulletproof version
try {
  if (window._) {
    window._.extend = bulletproofExtend;
  }
  if (window.lodash) {
    window.lodash.extend = bulletproofExtend;
  }
} catch (e) {
  // Could not override extend functions
}

// Make Backbone available globally for widgets
window.Backbone = Backbone;

// Export for use by other modules
export { lodash, Backbone };
export default lodash;

// Lodash and Backbone loaded globally
