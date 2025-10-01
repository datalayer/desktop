/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Dialog for editing notebook or lexical document name and description.
 *
 * @module renderer/components/spaces/EditItemDialog
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  Box,
  Button,
  TextInput,
  FormControl,
  Text,
} from '@primer/react';
import type { DocumentItem } from '../../../shared/types';

export interface EditItemDialogProps {
  isOpen: boolean;
  item: DocumentItem | null;
  onClose: () => void;
  onUpdate: (uid: string, name: string, description: string) => Promise<void>;
}

const EditItemDialog: React.FC<EditItemDialogProps> = ({
  isOpen,
  item,
  onClose,
  onUpdate,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when item changes
  useEffect(() => {
    if (item) {
      setName(item.name || '');
      setDescription(item.description || '');
      setError(null);
    }
  }, [item]);

  // Handle Escape key to close dialog
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen && !isUpdating) {
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
  }, [isOpen, isUpdating]);

  const handleUpdate = async () => {
    if (!item || !item.uid || !name.trim()) {
      setError('Name is required');
      return;
    }

    setIsUpdating(true);
    setError(null);

    try {
      await onUpdate(item.uid, name, description);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update item');
    } finally {
      setIsUpdating(false);
    }
  };

  // Check if values have changed from original
  const hasChanges =
    item &&
    (name !== (item.name || '') || description !== (item.description || ''));

  // Handle Enter key to update
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !isUpdating && name.trim() && hasChanges) {
      event.preventDefault();
      handleUpdate();
    }
  };

  const handleCancel = () => {
    setError(null);
    onClose();
  };

  const title = item?.type === 'notebook' ? 'Edit Notebook' : 'Edit Document';

  if (!item) return null;

  return (
    <Dialog
      isOpen={isOpen}
      onDismiss={handleCancel}
      aria-labelledby="edit-dialog-title"
    >
      <Dialog.Header id="edit-dialog-title">{title}</Dialog.Header>
      <Box p={3}>
        <FormControl required>
          <FormControl.Label>Name</FormControl.Label>
          <TextInput
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter name"
            disabled={isUpdating}
            autoFocus
            block
          />
        </FormControl>

        <Box mt={3}>
          <FormControl>
            <FormControl.Label>Description</FormControl.Label>
            <TextInput
              value={description}
              onChange={e => setDescription(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Enter description (optional)"
              disabled={isUpdating}
              block
            />
          </FormControl>
        </Box>

        {error && (
          <Box
            mt={3}
            p={2}
            sx={{
              backgroundColor: 'danger.emphasis',
              border: '1px solid',
              borderColor: 'danger.emphasis',
              borderRadius: 2,
            }}
          >
            <Text sx={{ color: 'fg.onEmphasis' }}>{error}</Text>
          </Box>
        )}

        <Box mt={3} display="flex" justifyContent="flex-end" sx={{ gap: 2 }}>
          <Button onClick={handleCancel} disabled={isUpdating}>
            Cancel
          </Button>
          <Button
            onClick={handleUpdate}
            variant="primary"
            disabled={isUpdating || !name.trim() || !hasChanges}
          >
            {isUpdating ? 'Updating...' : 'Update'}
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
};

export default EditItemDialog;
