/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Container component for displaying a list of runtimes.
 *
 * @module renderer/components/runtimes/RuntimesList
 */

import React from 'react';
import { Box, Text } from '@primer/react';
import RuntimeItem from './RuntimeItem';
import LoadingSpinner from '../common/LoadingSpinner';
import type { RuntimesListProps } from './types';
import { sortRuntimes } from './utils';

/**
 * Renders a list of runtime items with loading and empty states.
 */
const RuntimesList: React.FC<RuntimesListProps> = ({
  runtimes,
  loading,
  onTerminate,
}) => {
  // Show loading spinner
  if (loading && runtimes.length === 0) {
    return <LoadingSpinner message="Loading runtimes..." variant="inline" />;
  }

  // Show empty state
  if (runtimes.length === 0) {
    return (
      <Box
        sx={{
          textAlign: 'center',
          py: 6,
          px: 3,
          bg: 'canvas.subtle',
          border: '1px dashed',
          borderColor: 'border.default',
          borderRadius: 2,
        }}
      >
        <Text
          sx={{
            fontSize: 3,
            fontWeight: 'semibold',
            display: 'block',
            mb: 2,
            color: 'fg.muted',
          }}
        >
          No Active Runtimes
        </Text>
        <Text sx={{ fontSize: 1, color: 'fg.subtle' }}>
          Create a runtime here or directly within a document.
        </Text>
      </Box>
    );
  }

  // Sort runtimes by expiration time (soonest first)
  const sortedRuntimes = sortRuntimes(runtimes, 'time');

  return (
    <Box>
      {sortedRuntimes.map(runtime => (
        <RuntimeItem
          key={runtime.uid}
          runtime={runtime}
          onTerminate={onTerminate}
        />
      ))}
    </Box>
  );
};

export default RuntimesList;
