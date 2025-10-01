/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Simple component for displaying error and warning messages in the library.
 * Renders Flash components with appropriate variants and icons for error and warning states.
 *
 * @module ErrorMessage
 */

import React from 'react';
import { Flash } from '@primer/react';
import { AlertIcon } from '@primer/octicons-react';
import { ErrorMessageProps } from '../../../shared/types';

/**
 * Displays error and/or warning messages using Flash components
 */
const ErrorMessage: React.FC<ErrorMessageProps> = ({ error, warning }) => {
  return (
    <>
      {error && (
        <Flash variant="danger" sx={{ mb: 3 }}>
          {error}
        </Flash>
      )}

      {warning && (
        <Flash variant="warning" sx={{ mb: 3 }}>
          <AlertIcon /> {warning}
        </Flash>
      )}
    </>
  );
};

export default ErrorMessage;
