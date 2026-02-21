/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Shared runtime toolbar component.
 *
 * @module RuntimeToolbar
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Dialog,
  FormControl,
  TextInput,
  Select,
  Button,
  Text,
  IconButton,
} from '@primer/react';
import { TrashIcon } from '@primer/octicons-react';
import type { EnvironmentJSON } from '@datalayer/core/lib/models';
import { RuntimeProgressBar } from './RuntimeProgressBar';
import { RuntimeSelector } from './RuntimeSelector';
import { useService } from '../../contexts/ServiceContext';
import type { Runtime } from '../../services/interfaces/IRuntimeService';

export interface RuntimeToolbarProps {
  runtimePodName?: string;
  onRuntimeSelected?: (runtime: Runtime | null) => void;
  /** Left content slot (e.g., notebook controls, lexical toolbar) */
  leftContent?: React.ReactNode;
  /** Right content slot (optional additional controls) */
  rightContent?: React.ReactNode;
}

export const RuntimeToolbar: React.FC<RuntimeToolbarProps> = ({
  runtimePodName,
  onRuntimeSelected,
  leftContent,
  rightContent,
}) => {
  const runtimeService = useService('runtimeService');
  const [showRuntimeDialog, setShowRuntimeDialog] = useState(false);
  const [environments, setEnvironments] = useState<EnvironmentJSON[]>([]);
  const [selectedEnvironment, setSelectedEnvironment] = useState('');
  const [runtimeName, setRuntimeName] = useState('');
  const [minutes, setMinutes] = useState(10);
  const [creating, setCreating] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [terminating, setTerminating] = useState(false);
  const [showTerminateDialog, setShowTerminateDialog] = useState(false);

  // Subscribe to runtime expiration events
  useEffect(() => {
    if (!runtimeService || !runtimePodName) return;

    const unsubscribe = runtimeService.onRuntimeExpired(expiredPodName => {
      // If the current runtime expired, notify parent to reset
      if (expiredPodName === runtimePodName) {
        console.log(
          '[RuntimeToolbar] Current runtime expired:',
          expiredPodName
        );
        if (onRuntimeSelected) {
          onRuntimeSelected(null);
        }
      }
    });

    return () => unsubscribe();
  }, [runtimeService, runtimePodName, onRuntimeSelected]);

  // Load environments when dialog opens
  useEffect(() => {
    if (showRuntimeDialog && environments.length === 0) {
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
  }, [showRuntimeDialog]);

  // Handle Escape key for runtime creation dialog
  useEffect(() => {
    if (!showRuntimeDialog) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !creating) {
        event.preventDefault();
        setShowRuntimeDialog(false);
        setRuntimeName('');
        setMinutes(10);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showRuntimeDialog, creating]);

  // Handle Escape key for terminate dialog
  useEffect(() => {
    if (!showTerminateDialog) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !terminating) {
        event.preventDefault();
        setShowTerminateDialog(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showTerminateDialog, terminating]);

  const handleRuntimeSelectorChange = async (runtime: Runtime | null) => {
    if (!runtime) {
      // User chose "Create New" - show dialog
      setShowRuntimeDialog(true);
    } else {
      // User selected existing runtime - pass it directly to parent
      setIsConnecting(true);
      try {
        if (onRuntimeSelected) {
          await onRuntimeSelected(runtime);
        }
      } catch (error) {
        console.error('Failed to connect to runtime:', error);
        alert('Failed to connect to runtime: ' + (error as Error).message);
      } finally {
        setIsConnecting(false);
      }
    }
  };

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

      // Refresh runtime list to include newly created runtime FIRST
      // This ensures the runtime appears in the selector before we select it
      if (runtimeService) {
        await runtimeService.refreshAllRuntimes();
      }

      // Now notify parent component to automatically select the runtime
      if (onRuntimeSelected && runtime) {
        // Pass the runtime object to the selector
        onRuntimeSelected(runtime as unknown as Runtime);
      }

      // Close dialog
      setShowRuntimeDialog(false);
      setRuntimeName('');
      setMinutes(10);
    } catch (error) {
      console.error('Failed to create runtime:', error);
      alert('Failed to create runtime: ' + (error as Error).message);
    } finally {
      setCreating(false);
    }
  };

  // Handle Enter and Escape keys in runtime dialog
  const handleRuntimeKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setShowRuntimeDialog(false);
      setRuntimeName('');
      setMinutes(10);
    } else if (
      event.key === 'Enter' &&
      !creating &&
      selectedEnvironment &&
      runtimeName
    ) {
      event.preventDefault();
      handleCreateRuntime();
    }
  };

  const handleTerminateRuntime = async () => {
    if (!runtimePodName || terminating) return;

    setTerminating(true);
    try {
      await window.datalayerClient.deleteRuntime(runtimePodName);

      // Refresh global runtime list so ALL notebooks see the updated list
      if (runtimeService) {
        await runtimeService.refreshAllRuntimes();
        // Fire expiration event so ALL editors connected to this runtime reset
        runtimeService.notifyRuntimeTerminated(runtimePodName);
      }

      if (onRuntimeSelected) {
        onRuntimeSelected(null);
      }

      setShowTerminateDialog(false);
    } catch (error) {
      console.error('Failed to terminate runtime:', error);
      alert('Failed to terminate runtime: ' + (error as Error).message);
    } finally {
      setTerminating(false);
    }
  };

  return (
    <>
      {/* Runtime progress bar at the top */}
      <RuntimeProgressBar runtimePodName={runtimePodName} />

      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          px: 2,
          py: 2.5,
          minHeight: '52px',
          borderBottom: '1px solid',
          borderColor: 'border.default',
          bg: 'canvas.default',
        }}
      >
        {/* Left content slot */}
        {leftContent && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              minHeight: '32px',
            }}
          >
            {leftContent}
          </Box>
        )}

        {/* Right side: Runtime selector and controls */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            ml: 'auto',
            minHeight: '32px',
          }}
        >
          {rightContent}

          <RuntimeSelector
            selectedRuntimePodName={runtimePodName}
            onRuntimeSelected={handleRuntimeSelectorChange}
            disabled={isConnecting || creating}
          />
          {runtimePodName && (
            <IconButton
              size="small"
              aria-label="Terminate runtime"
              icon={TrashIcon}
              variant="danger"
              onClick={() => setShowTerminateDialog(true)}
            />
          )}
        </Box>
      </Box>

      {/* Create Runtime Dialog */}
      {showRuntimeDialog && (
        <Dialog
          isOpen={showRuntimeDialog}
          onDismiss={() => setShowRuntimeDialog(false)}
          aria-labelledby="runtime-dialog-title"
        >
          <Dialog.Header id="runtime-dialog-title">
            Create Runtime
          </Dialog.Header>
          <Box sx={{ p: 3 }}>
            <FormControl required>
              <FormControl.Label>Runtime Name</FormControl.Label>
              <TextInput
                value={runtimeName}
                onChange={e => setRuntimeName(e.target.value)}
                onKeyDown={handleRuntimeKeyDown}
                placeholder="my-runtime"
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
                Runtime Duration: {minutes}{' '}
                {minutes === 1 ? 'minute' : 'minutes'}
                {minutes >= 60 &&
                  ` (${(minutes / 60).toFixed(1)} ${minutes === 60 ? 'hour' : 'hours'})`}
              </FormControl.Label>
              <Box
                sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 2 }}
              >
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
              <Button
                onClick={() => setShowRuntimeDialog(false)}
                disabled={creating}
              >
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
      )}

      {/* Terminate Runtime Dialog */}
      {showTerminateDialog && (
        <Dialog
          isOpen={showTerminateDialog}
          onDismiss={() => !terminating && setShowTerminateDialog(false)}
          aria-labelledby="terminate-dialog-title"
        >
          <Dialog.Header id="terminate-dialog-title">
            Terminate Runtime
          </Dialog.Header>
          <Box sx={{ p: 3 }}>
            <Box sx={{ mb: 3 }}>
              Are you sure you want to terminate this runtime? This action
              cannot be undone.
            </Box>

            <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
              <Button
                onClick={() => setShowTerminateDialog(false)}
                disabled={terminating}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                onClick={handleTerminateRuntime}
                disabled={terminating}
              >
                {terminating ? 'Terminating...' : 'Terminate'}
              </Button>
            </Box>
          </Box>
        </Dialog>
      )}
    </>
  );
};

export default RuntimeToolbar;
