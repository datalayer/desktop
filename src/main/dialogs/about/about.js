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
  // Update copyright year to current year
  const currentYear = new Date().getFullYear();
  const copyrightYearElement = document.getElementById('copyright-year');
  if (copyrightYearElement) {
    copyrightYearElement.textContent = currentYear.toString();
  }

  // Hide close button on Windows/Linux (they have titlebar with close button)
  const closeBtn = document.querySelector('[data-action="close"]');
  if (closeBtn && window.aboutAPI && window.aboutAPI.platform !== 'darwin') {
    closeBtn.style.display = 'none';
  }

  // Add event listeners for buttons
  const websiteBtn = document.querySelector('[data-action="website"]');
  const docsBtn = document.querySelector('[data-action="docs"]');
  const githubBtn = document.querySelector('[data-action="github"]');

  if (websiteBtn) {
    websiteBtn.addEventListener('click', () => {
      if (window.aboutAPI) {
        window.aboutAPI.openExternal('https://datalayer.io');
      }
    });
  }

  if (docsBtn) {
    docsBtn.addEventListener('click', () => {
      if (window.aboutAPI) {
        window.aboutAPI.openExternal('https://docs.datalayer.io');
      }
    });
  }

  if (githubBtn) {
    githubBtn.addEventListener('click', () => {
      if (window.aboutAPI) {
        window.aboutAPI.openExternal('https://github.com/datalayer/core');
      }
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      if (window.aboutAPI) {
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
      if (window.aboutAPI) {
        window.aboutAPI.close();
      }
    }
  });
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
    initializeAboutDialog();
  }
});
