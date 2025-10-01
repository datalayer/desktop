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
import { ThemeProvider, BaseStyles, Box } from '@primer/react';
import { AppLayoutProps } from '../../../shared/types';
import { datalayerTheme } from '../../theme/datalayerTheme';

/**
 * Application layout component that wraps the app with theme providers.
 */
const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  return (
    <ThemeProvider theme={datalayerTheme}>
      <BaseStyles>
        <JupyterReactTheme theme={datalayerTheme}>
          <Box
            sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}
          >
            {children}
          </Box>
        </JupyterReactTheme>
      </BaseStyles>
    </ThemeProvider>
  );
};

export default AppLayout;
