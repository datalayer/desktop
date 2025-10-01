/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Error message component for login form validation and authentication errors.
 *
 * @module ErrorMessage
 */

import React from 'react';
import { Flash } from '@primer/react';
import { LoginErrorProps } from '../../../shared/types';

/**
 * Displays login-related error messages with accessibility support.
 */
const ErrorMessage: React.FC<LoginErrorProps> = ({ error }) => {
  if (!error) {
    return null;
  }

  return (
    <Flash variant="danger" sx={{ mb: 3 }} role="alert" aria-live="assertive">
      {error}
    </Flash>
  );
};

export default ErrorMessage;
