/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Dialog for selecting and connecting to a kernel.
 *
 * @module KernelSelectionDialog
 */

import React, { useState, useEffect } from 'react';
import { Dialog, Box, Button, Text, FormControl, Select } from '@primer/react';
import { COLORS } from '../../../shared/constants/colors';

export interface KernelSelectionDialogProps {
  /**
   * Whether the dialog is open
   */
  isOpen: boolean;

  /**
   * Callback when dialog is closed
   */
  onClose: () => void;

  /**
   * Callback when kernel is selected
   * @param kernelId - Selected kernel specification ID
   */
  onKernelSelect: (kernelId: string) => Promise<void>;

  /**
   * Available kernel specifications
   */
  availableKernels?: Array<{
    id: string;
    name: string;
    display_name: string;
    language: string;
  }>;

  /**
   * Whether kernel is currently connecting
   */
  isConnecting?: boolean;

  /**
   * Error message if kernel connection failed
   */
  error?: string | null;
}

/**
 * Dialog for selecting and connecting to a Jupyter kernel
 */
const KernelSelectionDialog: React.FC<KernelSelectionDialogProps> = ({
  isOpen,
  onClose,
  onKernelSelect,
  availableKernels = [],
  isConnecting = false,
  error = null,
}) => {
  const [selectedKernel, setSelectedKernel] = useState<string>('');

  // Reset selection when dialog opens
  useEffect(() => {
    if (isOpen && availableKernels.length > 0) {
      setSelectedKernel(availableKernels[0].id);
    }
  }, [isOpen, availableKernels]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen && !isConnecting) {
        event.preventDefault();
        event.stopPropagation();
        handleCancel();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown, true);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isOpen, isConnecting]);

  const handleCancel = () => {
    setSelectedKernel('');
    onClose();
  };

  const handleConnect = async () => {
    if (!selectedKernel) {
      return;
    }

    try {
      await onKernelSelect(selectedKernel);
      // Dialog will be closed by parent on success
    } catch (err) {
      // Error is handled by parent component
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onDismiss={handleCancel}
      aria-labelledby="kernel-dialog-title"
    >
      <Dialog.Header id="kernel-dialog-title">Connect to Kernel</Dialog.Header>

      <Box p={3}>
        <Text sx={{ mb: 3, color: 'fg.muted' }}>
          Select a kernel to enable code execution in this notebook. A runtime
          will be created to host the kernel.
        </Text>

        <FormControl required>
          <FormControl.Label>Kernel</FormControl.Label>
          <Select
            value={selectedKernel}
            onChange={e => setSelectedKernel(e.target.value)}
            disabled={isConnecting || availableKernels.length === 0}
            sx={{ width: '100%' }}
          >
            {availableKernels.length === 0 ? (
              <option value="">No kernels available</option>
            ) : (
              availableKernels.map(kernel => (
                <option key={kernel.id} value={kernel.id}>
                  {kernel.display_name} ({kernel.language})
                </option>
              ))
            )}
          </Select>
          <FormControl.Caption>
            The kernel specification determines which programming language and
            environment will be used.
          </FormControl.Caption>
        </FormControl>

        {error && (
          <Box
            mt={3}
            p={2}
            style={{
              backgroundColor: COLORS.palette.redPrimary,
              border: '1px solid ' + COLORS.palette.redPrimary,
              borderRadius: '6px',
            }}
          >
            <Text style={{ color: '#fff' }}>{error}</Text>
          </Box>
        )}

        <Box mt={3} display="flex" justifyContent="flex-end" sx={{ gap: 2 }}>
          <Button onClick={handleCancel} disabled={isConnecting}>
            Cancel
          </Button>
          <Button
            onClick={handleConnect}
            variant="primary"
            disabled={
              isConnecting || !selectedKernel || availableKernels.length === 0
            }
          >
            {isConnecting ? 'Connecting...' : 'Connect'}
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
};

export default KernelSelectionDialog;
