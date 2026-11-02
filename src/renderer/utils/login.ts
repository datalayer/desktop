/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Login form validation and credential utilities.
 *
 * @module renderer/utils/login
 */

import { LoginFormData, LoginWay } from '../../shared/types';

/**
 * Validates login form data.
 * @param formData - Login form data to validate
 * @returns Error message or empty string if valid
 */
export const validateLoginForm = (
  formData: LoginFormData,
  way: LoginWay = 'password'
): string => {
  if (!formData.runUrl) {
    return 'Please provide the Run URL (under More options).';
  }
  if (way === 'password') {
    return formData.handle && formData.password
      ? ''
      : 'Please provide your handle and your password.';
  }
  return formData.token ? '' : 'Please provide your API token.';
};

/**
 * Gets the default run URL for the login form.
 * @returns Default run URL
 */
export const getDefaultRunUrl = (): string => {
  return 'https://prod1.datalayer.run';
};

/**
 * Formats error messages for display.
 * @param error - Error object or string
 * @returns Formatted error message
 */
export const formatLoginError = (error: unknown): string => {
  if (typeof error === 'string') {
    return error;
  }
  // The main process's sentence, without Electron's remote-call prefix.
  if (error instanceof Error && error.message) {
    const sentence = error.message
      .replace(/^Error invoking remote method '[^']*':\s*/, '')
      .replace(/^Error:\s*/, '')
      .trim();
    if (sentence) {
      return sentence;
    }
  }
  return 'Failed to login. Please check your credentials.';
};
