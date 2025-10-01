/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Error state component with retry functionality for environment loading.
 *
 * @module renderer/components/environments/ErrorState
 */

import React from 'react';
import { Box, Text, Button, Flash } from '@primer/react';

/**
 * Props for the ErrorState component.
 */
interface ErrorStateProps {
  /** Error message to display */
  error: string;
  /** Callback function when retry button is clicked */
  onRetry: () => void;
}

/**
 * Error state component for environment loading failures.
 */
const ErrorState: React.FC<ErrorStateProps> = ({ error, onRetry }) => {
  return (
    <Flash variant="danger" sx={{ mb: 3 }}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Text>{error}</Text>
        <Button size="small" onClick={onRetry}>
          Retry
        </Button>
      </Box>
    </Flash>
  );
};

export default ErrorState;
