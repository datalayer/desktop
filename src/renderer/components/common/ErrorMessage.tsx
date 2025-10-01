/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Unified error and warning message component.
 * Supports error messages, warning messages, or both.
 * Includes accessibility features and icon support.
 *
 * @module ErrorMessage
 */

import React from 'react';
import { Flash } from '@primer/react';
import { AlertIcon } from '@primer/octicons-react';

export interface ErrorMessageProps {
  /** Error message to display (red variant) */
  error?: string;
  /** Warning message to display (yellow variant) */
  warning?: string;
}

/**
 * Displays error and/or warning messages using Flash components.
 * Supports accessibility attributes for screen readers.
 */
const ErrorMessage: React.FC<ErrorMessageProps> = ({ error, warning }) => {
  return (
    <>
      {error && (
        <Flash
          variant="danger"
          sx={{ mb: 3 }}
          role="alert"
          aria-live="assertive"
        >
          {error}
        </Flash>
      )}

      {warning && (
        <Flash variant="warning" sx={{ mb: 3 }} role="alert" aria-live="polite">
          <AlertIcon /> {warning}
        </Flash>
      )}
    </>
  );
};

export default ErrorMessage;
