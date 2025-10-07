/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Reusable dialog for creating new runtimes.
 *
 * @module runtime/CreateRuntimeDialog
 */

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  Box,
  FormControl,
  TextInput,
  Select,
  Button,
  Text,
} from '@primer/react';
import type { EnvironmentJSON } from '@datalayer/core/lib/client/models';

export interface CreateRuntimeDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onRuntimeCreated?: (runtime: unknown) => void;
}

/**
 * Dialog for creating a new runtime with environment and duration selection.
 */
export const CreateRuntimeDialog: React.FC<CreateRuntimeDialogProps> = ({
  isOpen,
  onClose,
  onRuntimeCreated,
}) => {
  const [environments, setEnvironments] = useState<EnvironmentJSON[]>([]);
  const [selectedEnvironment, setSelectedEnvironment] = useState('');
  const [runtimeName, setRuntimeName] = useState('');
  const [minutes, setMinutes] = useState(10);
  const [creating, setCreating] = useState(false);

  // Load environments when dialog opens
  useEffect(() => {
    if (isOpen && environments.length === 0) {
      window.datalayerClient
        .listEnvironments()
        .then((envs: EnvironmentJSON[]) => {
          setEnvironments(envs);
          if (envs.length > 0) {
            // Default to python-cpu-env if available, otherwise use first environment
            const defaultEnv = envs.find(env => env.name === 'python-cpu-env');
            setSelectedEnvironment(defaultEnv?.name || envs[0].name);
          }
        })
        .catch(err => {
          console.error('Failed to load environments:', err);
        });
    }
  }, [isOpen, environments.length]);

  const handleClose = () => {
    if (!creating) {
      setRuntimeName('');
      setMinutes(10);
      onClose();
    }
  };

  // Handle Escape key globally when dialog is open
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !creating) {
        event.stopPropagation();
        handleClose();
      }
    };

    window.addEventListener('keydown', handleEscape, true); // Use capture phase
    return () => window.removeEventListener('keydown', handleEscape, true);
  }, [isOpen, creating]);

  const handleCreateRuntime = async () => {
    if (!selectedEnvironment || !runtimeName || creating) return;

    setCreating(true);
    try {
      const runtime = await window.datalayerClient.createRuntime({
        environmentName: selectedEnvironment,
        type: 'notebook',
        givenName: runtimeName,
        minutesLimit: minutes,
      });

      // Notify parent of successful creation
      if (onRuntimeCreated && runtime) {
        onRuntimeCreated(runtime);
      }

      // Close dialog
      handleClose();
    } catch (error) {
      console.error('Failed to create runtime:', error);
      alert('Failed to create runtime: ' + (error as Error).message);
    } finally {
      setCreating(false);
    }
  };

  // Handle Enter key in runtime dialog (Escape is handled by Dialog's onDismiss)
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (
      event.key === 'Enter' &&
      !creating &&
      selectedEnvironment &&
      runtimeName
    ) {
      event.preventDefault();
      handleCreateRuntime();
    }
  };

  return (
    <Dialog
      isOpen={isOpen}
      onDismiss={handleClose}
      aria-labelledby="create-runtime-dialog-title"
    >
      <Dialog.Header id="create-runtime-dialog-title">
        Create Runtime
      </Dialog.Header>
      <Box sx={{ p: 3 }}>
        <FormControl required>
          <FormControl.Label>Runtime Name</FormControl.Label>
          <TextInput
            value={runtimeName}
            onChange={e => setRuntimeName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="my-runtime"
            autoFocus
            sx={{ width: '100%' }}
          />
        </FormControl>

        <FormControl sx={{ mt: 3 }}>
          <FormControl.Label>Environment</FormControl.Label>
          <Select
            value={selectedEnvironment}
            onChange={e => setSelectedEnvironment(e.target.value)}
            sx={{ width: '100%' }}
          >
            {environments.map(env => (
              <Select.Option key={env.name} value={env.name}>
                {env.title}
              </Select.Option>
            ))}
          </Select>
        </FormControl>

        <FormControl sx={{ mt: 3 }}>
          <FormControl.Label>
            Runtime Duration: {minutes} {minutes === 1 ? 'minute' : 'minutes'}
            {minutes >= 60 &&
              ` (${(minutes / 60).toFixed(1)} ${minutes === 60 ? 'hour' : 'hours'})`}
          </FormControl.Label>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2 }}>
            <Text sx={{ fontSize: 0, color: 'fg.muted', minWidth: '30px' }}>
              1
            </Text>
            <input
              type="range"
              min="1"
              max="1440"
              value={minutes}
              onChange={e => setMinutes(Number(e.target.value))}
              style={{ flex: 1 }}
            />
            <Text sx={{ fontSize: 0, color: 'fg.muted', minWidth: '40px' }}>
              1440
            </Text>
          </Box>
          <Box sx={{ mt: 2 }}>
            <TextInput
              type="number"
              min="1"
              max="1440"
              value={minutes}
              onChange={e => {
                const val = Number(e.target.value);
                if (val >= 1 && val <= 1440) {
                  setMinutes(val);
                }
              }}
              sx={{ width: '120px' }}
              trailingVisual="min"
            />
          </Box>
        </FormControl>

        <Box
          sx={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 2,
            mt: 3,
          }}
        >
          <Button onClick={handleClose} disabled={creating}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleCreateRuntime}
            disabled={!selectedEnvironment || !runtimeName || creating}
          >
            {creating ? 'Creating...' : 'Create'}
          </Button>
        </Box>
      </Box>
    </Dialog>
  );
};

export default CreateRuntimeDialog;
