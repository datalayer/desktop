/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Shared theme store for the desktop app.
 *
 * Wraps `createThemeStore` from `@datalayer/primer-addons` so that color
 * mode and theme variant are persisted to localStorage and can be driven
 * from the appearance controls in the header while being consumed by the
 * `ThemedProvider` that wraps the whole application.
 *
 * @module renderer/theme/themeStore
 */

import { createThemeStore } from '@datalayer/primer-addons';

/**
 * Persisted theme store instance for the desktop app.
 */
export const useThemeStore = createThemeStore('datalayer-desktop-theme', {
  colorMode: 'light',
  theme: 'matrix',
});

export default useThemeStore;
