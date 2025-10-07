/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Individual runtime item component displaying runtime details and actions.
 *
 * @module renderer/components/runtimes/RuntimeItem
 */

import React from 'react';
import { Box, Text, IconButton, Label, ProgressBar } from '@primer/react';
import { TrashIcon } from '@primer/octicons-react';
import { COLORS } from '../../../shared/constants/colors';
import type { RuntimeItemProps } from './types';
import {
  formatRuntimeName,
  formatRuntimeDuration,
  getRuntimeStatus,
  getRuntimeProgress,
  getStatusColor,
} from './utils';

/**
 * Renders a single runtime item with details and terminate action.
 */
const RuntimeItem: React.FC<RuntimeItemProps> = ({ runtime, onTerminate }) => {
  const status = getRuntimeStatus(runtime);
  const progress = getRuntimeProgress(runtime);
  const statusColor = getStatusColor(status);

  return (
    <Box
      sx={{
        p: 3,
        mb: 2,
        bg: 'canvas.subtle',
        border: '1px solid',
        borderColor: 'border.default',
        borderRadius: 2,
        '&:hover': {
          borderColor: 'border.muted',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
        },
      }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'start',
          mb: 2,
        }}
      >
        <Box sx={{ flex: 1 }}>
          {/* Runtime name and status indicator */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
            <Box
              sx={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                backgroundColor: statusColor,
                flexShrink: 0,
              }}
              aria-label={`Status: ${status}`}
            />
            <Text sx={{ fontWeight: 'semibold', fontSize: 2 }}>
              {formatRuntimeName(runtime)}
            </Text>
            <Label
              size="small"
              variant="default"
              sx={{
                backgroundColor:
                  status === 'expired'
                    ? `${COLORS.palette.redPrimary}15`
                    : status === 'expiring'
                      ? '#ffa50015'
                      : undefined,
                color:
                  status === 'expired'
                    ? COLORS.palette.redPrimary
                    : status === 'expiring'
                      ? '#ffa500'
                      : undefined,
              }}
            >
              {status === 'running'
                ? 'Running'
                : status === 'expiring'
                  ? 'Expiring Soon'
                  : 'Expired'}
            </Label>
          </Box>

          {/* Environment information */}
          {runtime.environmentTitle && (
            <Text
              sx={{
                fontSize: 1,
                color: 'fg.subtle',
                display: 'block',
                mb: 1,
              }}
            >
              Environment: {runtime.environmentTitle}
            </Text>
          )}

          {/* Pod name */}
          <Text
            sx={{
              fontSize: 0,
              color: 'fg.muted',
              fontFamily: 'mono',
              display: 'block',
            }}
          >
            Pod: {runtime.podName}
          </Text>
        </Box>

        {/* Terminate button */}
        <IconButton
          aria-label="Terminate runtime"
          icon={TrashIcon}
          size="large"
          variant="invisible"
          onClick={e => {
            e.stopPropagation();
            onTerminate(runtime);
          }}
          sx={{
            color: COLORS.palette.redPrimary + ' !important',
            '& svg': {
              color: COLORS.palette.redPrimary + ' !important',
              fill: COLORS.palette.redPrimary + ' !important',
            },
            '&:hover': {
              color: COLORS.palette.redHover + ' !important',
              backgroundColor: `${COLORS.palette.redPrimary}10`,
              '& svg': {
                color: COLORS.palette.redHover + ' !important',
                fill: COLORS.palette.redHover + ' !important',
              },
            },
          }}
        />
      </Box>

      {/* Progress bar and time remaining */}
      {runtime.expiredAt && (
        <Box sx={{ mt: 2 }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              mb: 1,
            }}
          >
            <Text
              sx={{
                fontSize: 1,
                fontWeight: 'semibold',
                color:
                  status === 'expired'
                    ? COLORS.palette.redPrimary
                    : status === 'expiring'
                      ? '#ffa500'
                      : 'fg.default',
              }}
            >
              {formatRuntimeDuration(runtime)}
            </Text>
          </Box>

          <ProgressBar
            progress={progress}
            barSize="small"
            sx={{
              '& [data-component="ProgressBar.Item"]': {
                backgroundColor:
                  status === 'expired'
                    ? COLORS.palette.redPrimary
                    : status === 'expiring'
                      ? '#ffa500'
                      : COLORS.brand.primary,
              },
            }}
          />
        </Box>
      )}
    </Box>
  );
};

export default RuntimeItem;
