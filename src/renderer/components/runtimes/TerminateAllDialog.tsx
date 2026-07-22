/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Confirmation dialog for terminating all runtimes.
 *
 * @module renderer/components/runtimes/TerminateAllDialog
 */

import React from 'react';
import { Dialog, Box, Text, Button } from '@primer/react';
import { COLORS } from '../../../shared/constants/colors';
import type { TerminateAllDialogProps } from './types';

/**
 * Renders a confirmation dialog for terminating all runtimes.
 */
const TerminateAllDialog: React.FC<TerminateAllDialogProps> = ({
  isOpen,
  runtimeCount,
  isTerminating,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <Dialog
      onClose={onCancel}
      title="Terminate All Agents"
      sx={{ maxWidth: '500px' }}
    >
      <Box sx={{ p: 3 }}>
        <Box sx={{ mb: 3 }}>
          <Text sx={{ fontWeight: 'semibold', display: 'block', mb: 2 }}>
            Agents to be terminated:
          </Text>
          <Box
            sx={{
              p: 2,
              bg: 'canvas.subtle',
              border: '1px solid',
              borderColor: 'border.default',
              borderRadius: 2,
              textAlign: 'center',
            }}
          >
            <Text
              sx={{
                fontSize: 4,
                fontWeight: 'bold',
                color: COLORS.palette.redPrimary,
              }}
            >
              {runtimeCount}
            </Text>
            <Text sx={{ fontSize: 1, color: 'fg.subtle', display: 'block' }}>
              {runtimeCount === 1 ? 'agent' : 'agents'}
            </Text>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
          <Button onClick={onCancel} disabled={isTerminating}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={onConfirm}
            disabled={isTerminating}
            sx={{
              backgroundColor: COLORS.palette.redPrimary + ' !important',
              color: 'white !important',
              '&:hover:not([disabled])': {
                backgroundColor: COLORS.palette.redHover + ' !important',
              },
              '&:disabled': {
                opacity: 0.5,
                cursor: 'not-allowed',
              },
            }}
          >
            {isTerminating ? 'Terminating All...' : 'Terminate All Agents'}
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
};

export default TerminateAllDialog;
