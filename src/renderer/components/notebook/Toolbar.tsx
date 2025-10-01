/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Notebook toolbar component with kernel management.
 *
 * @module Toolbar
 */

import React from 'react';
import { Box, Button, Text, IconButton, Tooltip } from '@primer/react';
import {
  PlayIcon,
  StopIcon,
  TrashIcon,
  KebabHorizontalIcon,
} from '@primer/octicons-react';

export interface NotebookToolbarProps {
  /**
   * Whether a real kernel is connected
   */
  hasKernel: boolean;

  /**
   * Whether kernel is currently connecting
   */
  isConnectingKernel: boolean;

  /**
   * Current kernel name/display name
   */
  kernelName?: string;

  /**
   * Callback to start/connect a kernel
   */
  onStartKernel: () => void;

  /**
   * Callback to stop the current kernel
   */
  onStopKernel?: () => void;

  /**
   * Callback to restart the kernel
   */
  onRestartKernel?: () => void;

  /**
   * Callback to interrupt the kernel
   */
  onInterruptKernel?: () => void;
}

/**
 * Notebook toolbar with kernel management and standard actions
 */
const NotebookToolbar: React.FC<NotebookToolbarProps> = ({
  hasKernel,
  isConnectingKernel,
  kernelName,
  onStartKernel,
  onStopKernel,
  onRestartKernel,
  onInterruptKernel,
}) => {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        p: 2,
        borderBottom: '1px solid',
        borderColor: 'border.default',
        bg: 'canvas.subtle',
      }}
    >
      {/* Kernel Status */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
        {!hasKernel ? (
          <>
            <Button
              variant="primary"
              size="small"
              leadingVisual={PlayIcon}
              onClick={onStartKernel}
              disabled={isConnectingKernel}
            >
              {isConnectingKernel ? 'Connecting...' : 'Start Kernel'}
            </Button>
            <Text sx={{ fontSize: 1, color: 'fg.muted' }}>
              No kernel connected - notebook is read-only
            </Text>
          </>
        ) : (
          <>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 1,
                px: 2,
                py: 1,
                bg: 'success.subtle',
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'success.muted',
              }}
            >
              <Box
                sx={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  bg: 'success.fg',
                }}
              />
              <Text sx={{ fontSize: 1, fontWeight: 'semibold' }}>
                {kernelName || 'Kernel Connected'}
              </Text>
            </Box>

            {/* Kernel Actions */}
            <Box sx={{ display: 'flex', gap: 1 }}>
              {onInterruptKernel && (
                <Tooltip aria-label="Interrupt kernel">
                  <IconButton
                    icon={StopIcon}
                    size="small"
                    aria-label="Interrupt kernel"
                    onClick={onInterruptKernel}
                  />
                </Tooltip>
              )}

              {onRestartKernel && (
                <Tooltip aria-label="Restart kernel">
                  <IconButton
                    icon={PlayIcon}
                    size="small"
                    aria-label="Restart kernel"
                    onClick={onRestartKernel}
                  />
                </Tooltip>
              )}

              {onStopKernel && (
                <Tooltip aria-label="Stop kernel">
                  <IconButton
                    icon={TrashIcon}
                    size="small"
                    aria-label="Stop kernel"
                    onClick={onStopKernel}
                  />
                </Tooltip>
              )}
            </Box>
          </>
        )}
      </Box>

      {/* Notebook Actions */}
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Tooltip aria-label="More options">
          <IconButton
            icon={KebabHorizontalIcon}
            size="small"
            aria-label="More options"
          />
        </Tooltip>
      </Box>
    </Box>
  );
};

export default NotebookToolbar;
