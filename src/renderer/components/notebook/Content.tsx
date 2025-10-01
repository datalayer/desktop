/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Notebook content component with collaboration support and error handling.
 *
 * @module renderer/components/notebook/Content
 */

import React, { useMemo, useRef } from 'react';
import { Box, Text } from '@primer/react';
import {
  Notebook2,
  CellSidebarExtension,
  CellSidebarButton,
} from '@datalayer/jupyter-react';
import { NotebookContentProps } from '../../../shared/types';
import { createNotebookProps, logNotebookInfo } from '../../utils/notebook';
import ErrorBoundary from './ErrorBoundary';

/**
 * Notebook content component that renders Jupyter notebooks.
 */
const Content: React.FC<NotebookContentProps> = ({
  notebookContent,
  serviceManager,
  collaborationProvider,
  stableNotebookKey,
  notebookError,
  onNotebookError,
  onResetNotebook,
  Toolbar,
}) => {
  // Track if notebook component is mounted to prevent re-initialization
  const notebookComponentRef = useRef<unknown>(null);

  // Track if service manager is ready
  const [serviceManagerReady, setServiceManagerReady] = React.useState(false);

  // Create extensions for enhanced notebook UI
  const notebookExtensions = useMemo(
    () => [new CellSidebarExtension({ factory: CellSidebarButton })],
    []
  );

  // Wait for service manager to be ready
  React.useEffect(() => {
    if (!serviceManager) {
      setServiceManagerReady(false);
      return;
    }

    // Check if service manager is ready
    if (serviceManager.isReady) {
      setServiceManagerReady(true);
    } else {
      // Wait for service manager to become ready
      serviceManager.ready
        .then(() => {
          setServiceManagerReady(true);
        })
        .catch(() => {
          setServiceManagerReady(false);
        });
    }
  }, [serviceManager]);

  // Create notebook props with collaboration always enabled
  const notebookProps = useMemo(() => {
    if (
      !serviceManager ||
      !serviceManagerReady ||
      !notebookContent ||
      !notebookContent.cells ||
      !Array.isArray(notebookContent.cells)
    ) {
      return null;
    }

    // Log notebook information for debugging
    logNotebookInfo(
      serviceManager,
      notebookContent,
      collaborationProvider,
      stableNotebookKey
    );

    const props = createNotebookProps(
      stableNotebookKey,
      notebookContent,
      serviceManager,
      collaborationProvider,
      notebookExtensions,
      Toolbar
    );

    // Kernelspecs readiness check
    if (serviceManager && !notebookComponentRef.current) {
      serviceManager.kernelspecs.ready
        .then(() => {
          // Kernelspecs ready
        })
        .catch(() => {
          // Error getting kernelspecs
        });
    }

    return props;
  }, [
    stableNotebookKey,
    serviceManager,
    serviceManagerReady,
    notebookContent,
    collaborationProvider,
    notebookExtensions,
  ]);

  // If there's a notebook error, show error UI with reset option
  if (notebookError) {
    return (
      <Box
        sx={{
          p: 4,
          textAlign: 'center',
          bg: 'canvas.subtle',
          border: '1px solid',
          borderColor: 'border.default',
          borderRadius: 2,
          m: 2,
        }}
        role="alert"
        aria-live="assertive"
      >
        <Text
          sx={{
            color: 'danger.fg',
            mb: 2,
            fontSize: 2,
            fontWeight: 'semibold',
          }}
        >
          Notebook component encountered an error
        </Text>

        <Text sx={{ color: 'fg.muted', fontSize: 1, mb: 3 }}>
          This may be due to collaboration state conflicts, component lifecycle
          issues, or rendering conflicts.
        </Text>

        <Text
          sx={{
            color: 'accent.fg',
            cursor: 'pointer',
            textDecoration: 'underline',
            fontSize: 1,
            '&:hover': {
              color: 'accent.emphasis',
            },
            '&:focus': {
              outline: '2px solid',
              outlineColor: 'accent.fg',
              outlineOffset: '2px',
            },
          }}
          onClick={onResetNotebook}
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onResetNotebook();
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Reset notebook component and try again"
        >
          Reset notebook
        </Text>
      </Box>
    );
  }

  // If notebook props aren't ready, don't render anything
  // The parent component should handle the loading state
  if (!notebookProps) {
    return null;
  }

  // Render the notebook with error boundary
  return (
    <Box
      sx={{
        flex: 1,
        width: '100%',
        overflow: 'auto',
        height: '100%',
      }}
    >
      <ErrorBoundary onError={onNotebookError}>
        <Notebook2 key={`notebook-${stableNotebookKey}`} {...notebookProps} />
      </ErrorBoundary>
    </Box>
  );
};

export default Content;
