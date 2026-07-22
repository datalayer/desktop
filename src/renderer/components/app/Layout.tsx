/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Application layout wrapper component providing theme providers.
 *
 * @module renderer/components/app/Layout
 */

import React from 'react';
import { JupyterReactTheme } from '@datalayer/jupyter-react';
import { Box } from '@primer/react';
import {
  ThemedProvider,
  themeConfigs,
  useSystemColorMode,
} from '@datalayer/primer-addons';
import { AppLayoutProps } from '../../../shared/types';
import { useThemeStore } from '../../theme/themeStore';

/**
 * Application layout component that wraps the app with theme providers.
 */
const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const colorMode = useThemeStore(state => state.colorMode);
  const themeVariant = useThemeStore(state => state.theme);
  const systemColorMode = useSystemColorMode();

  // Keep JupyterReactTheme in sync with the Primer store-driven appearance.
  const resolvedColorMode = colorMode === 'auto' ? systemColorMode : colorMode;
  const primerTheme =
    themeConfigs[themeVariant]?.primerTheme ??
    themeConfigs.datalayer.primerTheme;
  const themeStyles =
    themeConfigs[themeVariant]?.themeStyles ??
    themeConfigs.datalayer.themeStyles;
  const modeStyles =
    resolvedColorMode === 'dark' ? themeStyles.dark : themeStyles.light;
  const themeBackground =
    (modeStyles as Record<string, string>).backgroundColor ??
    'var(--bgColor-default)';

  return (
    <ThemedProvider useStore={useThemeStore}>
      <JupyterReactTheme
        colormode={resolvedColorMode}
        theme={primerTheme}
        backgroundColor={themeBackground}
        useBaseStyles={false}
      >
        <Box
          sx={{
            height: '100vh',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {children}
        </Box>
      </JupyterReactTheme>
    </ThemedProvider>
  );
};

export default AppLayout;
