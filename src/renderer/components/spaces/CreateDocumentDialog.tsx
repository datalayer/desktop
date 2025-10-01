/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Dialog for creating new notebooks or lexical documents.
 *
 * @module renderer/components/library/CreateDocumentDialog
 */

import React, { useState } from 'react';
import {
  Dialog,
  Box,
  Button,
  TextInput,
  FormControl,
  Text,
} from '@primer/react';
import { COLORS } from '../../../shared/constants/colors';

export interface CreateDocumentDialogProps {
  isOpen: boolean;
  type: 'notebook' | 'lexical';
  onClose: () => void;
  onCreate: (name: string, description: string) => Promise<void>;
}

const CreateDocumentDialog: React.FC<CreateDocumentDialogProps> = ({
  isOpen,
  type,
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle Escape key to close dialog
  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen && !isCreating) {
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
  }, [isOpen, isCreating]);

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      await onCreate(name, description);
      // Reset form
      setName('');
      setDescription('');
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to create document'
      );
    } finally {
      setIsCreating(false);
    }
  };

  // Handle Enter key to create
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !isCreating && name.trim()) {
      event.preventDefault();
      handleCreate();
    }
  };

  const handleCancel = () => {
    setName('');
    setDescription('');
    setError(null);
    onClose();
  };

  const title =
    type === 'notebook' ? 'Create New Notebook' : 'Create New Document';

  return (
    <Dialog
      isOpen={isOpen}
      onDismiss={handleCancel}
      aria-labelledby="create-dialog-title"
    >
      <Dialog.Header id="create-dialog-title">{title}</Dialog.Header>
      <Box p={3}>
        <FormControl required>
          <FormControl.Label>Name</FormControl.Label>
          <TextInput
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Enter ${type} name`}
            disabled={isCreating}
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
              disabled={isCreating}
              block
            />
          </FormControl>
        </Box>

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
          <Button onClick={handleCancel} disabled={isCreating}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            variant="primary"
            disabled={isCreating || !name.trim()}
          >
            {isCreating ? 'Creating...' : 'Create'}
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
};

export default CreateDocumentDialog;
