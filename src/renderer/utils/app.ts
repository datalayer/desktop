/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Application utility functions for console filtering.
 *
 * @module renderer/utils/app
 */

/**
 * Filter console logs to suppress noisy Jupyter React messages.
 * @returns Cleanup function to restore original console methods
 */
export const setupConsoleFiltering = (): (() => void) => {
  const originalConsoleLog = console.log;
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;

  console.log = (...args: unknown[]) => {
    const message = args.join(' ');
    if (
      message.includes('Created config for Jupyter React') ||
      // Suppress Primer React FormControl prop warnings
      message.includes(
        "instead of passing the 'disabled' prop directly to the input component"
      ) ||
      // Suppress misleading Jupyter React config logs (we pass serviceManager with correct URL)
      message.includes('Returning existing Jupyter React config')
    ) {
      return; // Suppress these messages
    }
    originalConsoleLog.apply(console, args);
  };

  console.warn = (...args: unknown[]) => {
    const message = args.join(' ');
    // Suppress various third-party library warnings
    if (
      message.includes('use allowUnionTypes to allow union type keyword') ||
      message.includes('strictTypes') ||
      // Suppress Lumino defaultProps deprecation warning (from JupyterLab packages)
      message.includes(
        'Support for defaultProps will be removed from function components'
      ) ||
      // Suppress React unmount timing warning (from Jupyter components)
      message.includes(
        'Attempted to synchronously unmount a root while React was already rendering'
      ) ||
      // Suppress cell executor warning (expected behavior when using proxy service manager)
      message.includes(
        'Requesting cell execution without any cell executor defined'
      ) ||
      // Suppress SVG malformed warnings from JupyterLab icons
      message.includes('SVG HTML was malformed for LabIcon instance')
    ) {
      return;
    }
    originalConsoleWarn.apply(console, args);
  };

  // Don't filter console.error - we need to see actual errors
  // The beep is annoying but breaking functionality is worse
  console.error = originalConsoleError;

  return () => {
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
  };
};
