/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Loading spinner component for document editor states.
 *
 * @module renderer/components/document/LoadingSpinner
 */

import React from 'react';
import { DocumentLoadingStateProps } from '../../../shared/types';
import UnifiedLoadingSpinner from '../LoadingSpinner';

/**
 * Loading spinner component specific to document editor operations.
 */
const LoadingSpinner: React.FC<DocumentLoadingStateProps> = ({
  isCreatingRuntime,
  loading: _loading,
  serviceManager,
}) => {
  let message = 'Loading document...';

  if (isCreatingRuntime) {
    message = 'Creating runtime environment...';
  } else if (!serviceManager) {
    message = 'Loading document...';
  } else {
    message = 'Preparing kernel environment...';
  }

  return <UnifiedLoadingSpinner message={message} variant="default" />;
};

export default LoadingSpinner;
