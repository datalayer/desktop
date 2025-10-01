/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Login form validation and credential utilities.
 *
 * @module renderer/utils/login
 */

import { LoginFormData } from '../../shared/types';

/**
 * Validates login form data.
 * @param formData - Login form data to validate
 * @returns Error message or empty string if valid
 */
export const validateLoginForm = (formData: LoginFormData): string => {
  if (!formData.runUrl || !formData.token) {
    return 'Please provide both Run URL and Token';
  }
  return '';
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
  return 'Failed to login. Please check your credentials.';
};
