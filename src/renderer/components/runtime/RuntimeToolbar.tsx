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
import type { EnvironmentJSON } from '@datalayer/agent-runtimes/lib/models';
import { createRandomTimestampName } from '@datalayer/core/lib/utils/Name';
import { RuntimeProgressBar } from './RuntimeProgressBar';
import { RuntimeSelector } from './RuntimeSelector';
import { useService } from '../../contexts/ServiceContext';
import type { Runtime } from '../../services/interfaces/IRuntimeService';

export interface RuntimeToolbarProps {
  runtimeName?: string;
  onRuntimeSelected?: (runtime: Runtime | null) => void;
  /** Left content slot (e.g., notebook controls, lexical toolbar) */
  leftContent?: React.ReactNode;
  /** Right content slot (optional additional controls) */
  rightContent?: React.ReactNode;
}

export const RuntimeToolbar: React.FC<RuntimeToolbarProps> = ({
  runtimeName,
  onRuntimeSelected,
  leftContent,
  rightContent,
}) => {
  const runtimeService = useService('runtimeService');
  const [showRuntimeDialog, setShowRuntimeDialog] = useState(false);
  const [environments, setEnvironments] = useState<EnvironmentJSON[]>([]);
  const [selectedEnvironment, setSelectedEnvironment] = useState('');
  const [givenName, setGivenName] = useState(() =>
    createRandomTimestampName()
  );
  const [minutes, setMinutes] = useState(10);
  const [creating, setCreating] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [terminating, setTerminating] = useState(false);
  const [showTerminateDialog, setShowTerminateDialog] = useState(false);

  const handleOpenRuntimeDialog = () => {
    setGivenName(createRandomTimestampName());
    setMinutes(10);
    setShowRuntimeDialog(true);
  };

  const handleCloseRuntimeDialog = () => {
    setShowRuntimeDialog(false);
    setGivenName(createRandomTimestampName());
    setMinutes(10);
  };

  // Subscribe to runtime expiration events
  useEffect(() => {
    if (!runtimeService || !runtimeName) return;

    const unsubscribe = runtimeService.onRuntimeExpired(expiredRuntimeName => {
      // If the current runtime expired, notify parent to reset
      if (expiredRuntimeName === runtimeName) {
        console.log(
          '[RuntimeToolbar] Current runtime expired:',
          expiredRuntimeName
        );
        if (onRuntimeSelected) {
          onRuntimeSelected(null);
        }
      }
    });

    return () => unsubscribe();
  }, [runtimeService, runtimeName, onRuntimeSelected]);

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
        handleCloseRuntimeDialog();
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
    if (!runtime) return;

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
  };

  const handleCreateRuntime = async () => {
    if (!selectedEnvironment || !givenName || creating) return;

    setCreating(true);
    try {
      const runtime = await window.datalayerClient.createRuntime({
        environmentName: selectedEnvironment,
        type: 'notebook',
        givenName: givenName,
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
      handleCloseRuntimeDialog();
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
      handleCloseRuntimeDialog();
    } else if (
      event.key === 'Enter' &&
      !creating &&
      selectedEnvironment &&
      givenName
    ) {
      event.preventDefault();
      handleCreateRuntime();
    }
  };

  const handleTerminateRuntime = async () => {
    if (!runtimeName || terminating) return;

    setTerminating(true);
    try {
      await window.datalayerClient.deleteRuntime(runtimeName);

      // Refresh global runtime list so ALL notebooks see the updated list
      if (runtimeService) {
        await runtimeService.refreshAllRuntimes();
        // Fire expiration event so ALL editors connected to this runtime reset
        runtimeService.notifyRuntimeTerminated(runtimeName);
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
      <RuntimeProgressBar runtimeName={runtimeName} />

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
            selectedRuntimeName={runtimeName}
            onRuntimeSelected={handleRuntimeSelectorChange}
            disabled={isConnecting || creating}
          />
          <Button size="small" onClick={handleOpenRuntimeDialog}>
            New Agent
          </Button>
          {runtimeName && (
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
        <Dialog onClose={handleCloseRuntimeDialog} title="New Agent">
          <Box sx={{ p: 3 }}>
            <FormControl required>
              <FormControl.Label>Agent Name</FormControl.Label>
              <TextInput
                value={givenName}
                onChange={e => setGivenName(e.target.value)}
                onKeyDown={handleRuntimeKeyDown}
                placeholder="my-runtime"
                sx={{ width: '100%' }}
              />
            </FormControl>

            <FormControl sx={{ mt: 3 }}>
              <FormControl.Label>Runtime Profile</FormControl.Label>
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
                Agent Duration: {minutes} {minutes === 1 ? 'minute' : 'minutes'}
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
              <Button onClick={handleCloseRuntimeDialog} disabled={creating}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleCreateRuntime}
                disabled={!selectedEnvironment || !givenName || creating}
              >
                {creating ? 'Creating...' : 'Create Agent'}
              </Button>
            </Box>
          </Box>
        </Dialog>
      )}

      {/* Terminate Runtime Dialog */}
      {showTerminateDialog && (
        <Dialog
          onClose={() => !terminating && setShowTerminateDialog(false)}
          title="Terminate Runtime"
        >
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
