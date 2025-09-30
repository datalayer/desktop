/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * @module main/about
 *
 * About dialog functionality.
 * This script runs in the renderer context with context isolation enabled
 * and handles UI interactions for the about dialog window.
 */

// Initialize the about dialog when DOM is ready
function initializeAboutDialog() {
  console.log('[About] Initializing about dialog');

  // Update copyright year to current year
  const currentYear = new Date().getFullYear();
  const copyrightYearElement = document.getElementById('copyright-year');
  if (copyrightYearElement) {
    copyrightYearElement.textContent = currentYear.toString();
  }

  // Add event listeners for buttons
  const websiteBtn = document.querySelector('[data-action="website"]');
  const docsBtn = document.querySelector('[data-action="docs"]');
  const githubBtn = document.querySelector('[data-action="github"]');
  const closeBtn = document.querySelector('[data-action="close"]');

  console.log('[About] Found close button:', !!closeBtn);
  console.log('[About] aboutAPI available:', !!window.aboutAPI);

  if (websiteBtn) {
    websiteBtn.addEventListener('click', () => {
      console.log('[About] Website button clicked');
      if (window.aboutAPI) {
        window.aboutAPI.openExternal('https://datalayer.io');
      }
    });
  }

  if (docsBtn) {
    docsBtn.addEventListener('click', () => {
      console.log('[About] Docs button clicked');
      if (window.aboutAPI) {
        window.aboutAPI.openExternal('https://docs.datalayer.io');
      }
    });
  }

  if (githubBtn) {
    githubBtn.addEventListener('click', () => {
      console.log('[About] GitHub button clicked');
      if (window.aboutAPI) {
        window.aboutAPI.openExternal('https://github.com/datalayer/core');
      }
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      console.log('[About] Close button clicked');
      if (window.aboutAPI) {
        console.log('[About] Calling aboutAPI.close()');
        window.aboutAPI.close();
      } else {
        console.error('[About] aboutAPI not available');
      }
    });
  } else {
    console.error('[About] Close button not found');
  }

  // Close on ESC key
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      console.log('[About] ESC key pressed');
      if (window.aboutAPI) {
        window.aboutAPI.close();
      }
    }
  });

  console.log('[About] Initialization complete');
}

// Try multiple ways to ensure the dialog is initialized
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeAboutDialog);
} else {
  // DOM is already loaded
  initializeAboutDialog();
}

// Also try with window.onload as a fallback
window.addEventListener('load', () => {
  // Re-initialize if close button still doesn't have handler
  const closeBtn = document.querySelector('[data-action="close"]');
  if (closeBtn && !closeBtn.onclick) {
    console.log('[About] Re-initializing handlers on window load');
    initializeAboutDialog();
  }
});
