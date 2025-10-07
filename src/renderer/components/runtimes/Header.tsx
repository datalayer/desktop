/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Runtimes page header component with refresh and terminate all functionality.
 *
 * @module renderer/components/runtimes/Header
 */

import React from 'react';
import { Box, Heading, Text, IconButton, Button } from '@primer/react';
import { SyncIcon, TrashIcon, PlusIcon } from '@primer/octicons-react';
import { COLORS } from '../../../shared/constants/colors';
import type { RuntimesHeaderProps } from './types';

/**
 * Renders the runtimes page header with statistics and action buttons.
 */
const Header: React.FC<RuntimesHeaderProps> = ({
  runtimeCount,
  stats,
  isRefreshing,
  onRefresh,
  onTerminateAll,
  onCreateRuntime,
  disabled = false,
}) => {
  return (
    <Box sx={{ mb: 3 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          mb: 3,
        }}
      >
        <Box>
          <Heading as="h2" sx={{ mb: 1 }}>
            Active Runtimes
          </Heading>
          <Text sx={{ color: 'fg.subtle', mb: 2 }}>
            Manage your compute resources
          </Text>

          {/* Runtime statistics */}
          <Box sx={{ display: 'flex', gap: 3, mt: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Box
                sx={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#28a745',
                }}
              />
              <Text sx={{ fontSize: 1, color: 'fg.subtle' }}>
                {stats.running} Running
              </Text>
            </Box>

            {stats.expiringSoon > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#ffa500',
                  }}
                />
                <Text sx={{ fontSize: 1, color: 'fg.subtle' }}>
                  {stats.expiringSoon} Expiring Soon
                </Text>
              </Box>
            )}

            {stats.expired > 0 && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  sx={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#dc3545',
                  }}
                />
                <Text sx={{ fontSize: 1, color: 'fg.subtle' }}>
                  {stats.expired} Expired
                </Text>
              </Box>
            )}

            <Box sx={{ ml: 2 }}>
              <Text sx={{ fontSize: 1, fontWeight: 'semibold' }}>
                Total: {runtimeCount}
              </Text>
            </Box>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 2 }}>
          {/* Terminate All button */}
          <Button
            leadingVisual={TrashIcon}
            variant="danger"
            size="medium"
            onClick={onTerminateAll}
            disabled={disabled || runtimeCount === 0}
            sx={{
              backgroundColor: COLORS.palette.redPrimary + ' !important',
              color: 'white !important',
              border: '1px solid',
              borderColor: COLORS.palette.redPrimary,
              '& svg': {
                color: 'white !important',
                fill: 'white !important',
              },
              '&:hover:not([disabled])': {
                backgroundColor: COLORS.palette.redHover + ' !important',
                borderColor: COLORS.palette.redHover,
              },
              '&:disabled': {
                opacity: 0.5,
                cursor: 'not-allowed',
              },
            }}
          >
            Terminate All
          </Button>

          {/* Create Runtime button - never disabled */}
          <Button
            leadingVisual={PlusIcon}
            variant="primary"
            size="medium"
            onClick={onCreateRuntime}
            sx={{
              backgroundColor: COLORS.brand.primary + ' !important',
              color: 'white !important',
              border: '1px solid',
              borderColor: COLORS.brand.primary,
              '& svg': {
                color: 'white !important',
                fill: 'white !important',
              },
              '&:hover:not([disabled])': {
                backgroundColor: COLORS.brand.primaryHover + ' !important',
                borderColor: COLORS.brand.primaryHover,
              },
            }}
          >
            Create Runtime
          </Button>

          {/* Refresh button - only disabled while refreshing */}
          <IconButton
            aria-label="Refresh runtimes"
            icon={SyncIcon}
            size="medium"
            variant="invisible"
            onClick={onRefresh}
            disabled={isRefreshing}
            sx={{
              color: COLORS.brand.primary + ' !important',
              border: '1px solid',
              borderColor: COLORS.brand.primary,
              borderRadius: '6px',
              '& svg': {
                color: COLORS.brand.primary + ' !important',
                fill: COLORS.brand.primary + ' !important',
              },
              '&:hover:not([disabled])': {
                backgroundColor: `${COLORS.brand.primary}15`,
                borderColor: COLORS.brand.primaryHover,
                color: COLORS.brand.primaryHover + ' !important',
                '& svg': {
                  color: COLORS.brand.primaryHover + ' !important',
                  fill: COLORS.brand.primaryHover + ' !important',
                },
              },
              '&:disabled': {
                opacity: 0.6,
                borderColor: 'border.default',
                color: 'fg.muted',
              },
            }}
          />
        </Box>
      </Box>
    </Box>
  );
};

export default Header;
