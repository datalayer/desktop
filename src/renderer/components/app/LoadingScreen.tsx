/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Full-screen loading indicator component with status messages.
 *
 * @module renderer/components/app/LoadingScreen
 */

import React from 'react';
import { ThemeProvider, BaseStyles } from '@primer/react';
import { LoadingScreenProps } from '../../../shared/types';
import LoadingSpinner from '../common/LoadingSpinner';
import { PreloadState } from '../../hooks/usePreload';

/**
 * Extended loading screen props with preload state.
 */
interface ExtendedLoadingScreenProps extends LoadingScreenProps {
  /** Whether components are being preloaded */
  isPreloading?: boolean;
  /** States of individual preload operations */
  preloadStates?: Record<string, PreloadState>;
}

/**
 * Full-screen loading component shown during app initialization.
 */
const LoadingScreen: React.FC<ExtendedLoadingScreenProps> = ({
  isCheckingAuth,
  isReconnecting,
  isPreloading,
}) => {
  const getMessage = () => {
    if (isCheckingAuth) return 'Checking authentication...';
    if (isReconnecting) return 'Reconnecting to runtimes...';
    if (isPreloading) return 'Loading components...';
    return 'Initializing...';
  };

  return (
    <ThemeProvider>
      <BaseStyles>
        <LoadingSpinner variant="fullscreen" message={getMessage()} />
      </BaseStyles>
    </ThemeProvider>
  );
};

export default LoadingScreen;
