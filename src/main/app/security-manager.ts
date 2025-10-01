/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Security configuration and Content Security Policy management.
 * Handles CSP headers, security policies, and production security features.
 *
 * @module main/app/security-manager
 */

import { session } from 'electron';
import { shouldUseProductionSecurity } from './environment';

/**
 * Set up Content Security Policy headers for the application.
 * Production mode uses stricter CSP policies.
 */
export function setupContentSecurityPolicy(): void {
  if (shouldUseProductionSecurity()) {
    // Production CSP - stricter
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [
            "default-src 'self'; " +
              "script-src 'self' 'unsafe-eval'; " +
              "style-src 'self' 'unsafe-inline'; " +
              "img-src 'self' data: https:; " +
              "connect-src 'self' https://prod1.datalayer.run https://*.datalayer.io wss://*.datalayer.run; " +
              "font-src 'self' data:;",
          ],
        },
      });
    });
  }
}

/**
 * Security configuration object with CSP policies.
 */
export const SECURITY_POLICIES = {
  PRODUCTION_CSP: {
    defaultSrc: "'self'",
    scriptSrc: "'self' 'unsafe-eval'",
    styleSrc: "'self' 'unsafe-inline'",
    imgSrc: "'self' data: https:",
    connectSrc:
      "'self' https://prod1.datalayer.run https://*.datalayer.io wss://*.datalayer.run",
    fontSrc: "'self' data:",
  },
  ALLOWED_PROTOCOLS: ['https:', 'wss:'],
  BLOCKED_SHORTCUTS: [
    { ctrl: true, shift: true, key: 'i' }, // DevTools
    { ctrl: true, shift: true, key: 'c' }, // DevTools
    { ctrl: true, shift: true, key: 'j' }, // DevTools
    { key: 'F12' }, // DevTools
  ],
} as const;
