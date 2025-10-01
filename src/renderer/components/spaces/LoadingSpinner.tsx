/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Loading spinner component specifically for the library page.
 * Wraps the unified LoadingSpinner with library-specific configuration.
 *
 * @module LoadingSpinner
 */

import React from 'react';
import UnifiedLoadingSpinner from '../LoadingSpinner';
import { LoadingSpinnerProps } from '../../../shared/types';

/**
 * Displays a loading spinner with custom message for library operations.
 */
const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ message }) => {
  return (
    <UnifiedLoadingSpinner message={message} variant="card" size="medium" />
  );
};

export default LoadingSpinner;
