/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Shared confirmation dialog for terminating a runtime.
 * Simple dialog matching the one used in RuntimeToolbar for documents.
 *
 * @module renderer/components/runtime/TerminateRuntimeDialog
 */

import React from 'react';
import { Dialog, Box, Button } from '@primer/react';

/**
 * Props for TerminateRuntimeDialog component.
 */
export interface TerminateRuntimeDialogProps {
  /**
   * Whether the dialog is open.
   */
  isOpen: boolean;

  /**
   * Whether termination is in progress.
   */
  isTerminating: boolean;

  /**
   * Callback when user confirms termination.
   */
  onConfirm: () => void;

  /**
   * Callback when user cancels.
   */
  onCancel: () => void;
}

/**
 * Renders a simple confirmation dialog for terminating a runtime.
 * Matches the RuntimeToolbar dialog design.
 */
const TerminateRuntimeDialog: React.FC<TerminateRuntimeDialogProps> = ({
  isOpen,
  isTerminating,
  onConfirm,
  onCancel,
}) => {
  return (
    <Dialog
      isOpen={isOpen}
      onDismiss={() => !isTerminating && onCancel()}
      aria-labelledby="terminate-dialog-title"
    >
      <Dialog.Header id="terminate-dialog-title">
        Terminate Runtime
      </Dialog.Header>
      <Box sx={{ p: 3 }}>
        <Box sx={{ mb: 3 }}>
          Are you sure you want to terminate this runtime? This action cannot be
          undone.
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
          <Button onClick={onCancel} disabled={isTerminating}>
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} disabled={isTerminating}>
            {isTerminating ? 'Terminating...' : 'Terminate'}
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
};

export default TerminateRuntimeDialog;
