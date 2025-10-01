/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Loading spinner component specifically for environments page.
 *
 * @module LoadingSpinner
 */

import React from 'react';
import UnifiedLoadingSpinner from '../LoadingSpinner';

/**
 * Displays a loading spinner with "Loading environments..." message.
 */
const LoadingSpinner: React.FC = () => {
  return (
    <UnifiedLoadingSpinner
      message="Loading environments..."
      variant="inline"
      sx={{ py: 6 }}
    />
  );
};

export default LoadingSpinner;
