/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Toolbar for Notebook2 component using notebookStore2.
 *
 * @module Notebook2Toolbar
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  IconButton,
  Button,
  ButtonGroup,
  Dialog,
  FormControl,
  TextInput,
  Select,
  Text,
} from '@primer/react';
import {
  PlayIcon,
  StopIcon,
  TrashIcon,
  PaperAirplaneIcon,
} from '@primer/octicons-react';
import { notebookStore2 } from '@datalayer/jupyter-react';
import type { EnvironmentJSON } from '@datalayer/core/lib/client/models';
import { RuntimeProgressBar } from '../runtime/RuntimeProgressBar';
import { RuntimeSelector } from '../runtime/RuntimeSelector';
import { useService } from '../../contexts/ServiceContext';
import type { Runtime } from '../../services/interfaces/IRuntimeService';

export interface INotebook2ToolbarProps {
  notebookId?: string;
  runtimePodName?: string;
  showNotebookControls?: boolean;
  onRuntimeCreated?: (runtime: {
    id: string;
    podName: string;
    ingress: string;
    token: string;
  }) => void;
  onRuntimeSelected?: (runtime: {
    id: string;
    podName: string;
    ingress: string;
    token: string;
  }) => void;
  onRuntimeTerminated?: () => void;
}

export const Notebook2Toolbar: React.FC<INotebook2ToolbarProps> = ({
  notebookId,
  runtimePodName,
  showNotebookControls = true,
  onRuntimeCreated,
  onRuntimeSelected,
  onRuntimeTerminated,
}) => {
  const runtimeService = useService('runtimeService');
  const [cellType, setCellType] = useState('code');
  const [showRuntimeDialog, setShowRuntimeDialog] = useState(false);
  const [environments, setEnvironments] = useState<EnvironmentJSON[]>([]);
  const [selectedEnvironment, setSelectedEnvironment] = useState('');
  const [runtimeName, setRuntimeName] = useState('');
  const [minutes, setMinutes] = useState(10);
  const [creating, setCreating] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [terminating, setTerminating] = useState(false);
  const [showTerminateDialog, setShowTerminateDialog] = useState(false);
  const [isCellRunning, setIsCellRunning] = useState(false);

  // Monitor kernel execution state
  useEffect(() => {
    if (!notebookId) return;

    const unsubscribe = notebookStore2.subscribe(state => {
      const notebook = state.notebooks.get(notebookId);
      if (!notebook?.adapter) {
        setIsCellRunning(false);
        return;
      }

      // Access kernel status via adapter's context
      const kernelStatus =
        notebook.adapter.context.sessionContext?.session?.kernel?.status;
      const isBusy = kernelStatus === 'busy';
      setIsCellRunning(isBusy);
    });

    return () => unsubscribe();
  }, [notebookId]);

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

  const handleRun = (e: React.MouseEvent) => {
    e.preventDefault();
    if (notebookId) notebookStore2.getState().run(notebookId);
  };

  const handleRunAll = (e: React.MouseEvent) => {
    e.preventDefault();
    if (notebookId) notebookStore2.getState().runAll(notebookId);
  };

  const handleInterrupt = (e: React.MouseEvent) => {
    e.preventDefault();
    if (notebookId) notebookStore2.getState().interrupt(notebookId);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    if (notebookId) notebookStore2.getState().delete(notebookId);
  };

  const handleRuntimeSelectorChange = async (runtime: Runtime | null) => {
    if (!runtime) {
      // User chose "Create New" - show dialog
      setShowRuntimeDialog(true);
    } else {
      // User selected existing runtime - connect to it
      setIsConnecting(true);
      try {
        if (onRuntimeSelected) {
          // runtime is already a plain JSON object from the bridge (RuntimeJSON)
          await onRuntimeSelected({
            id: runtime.uid,
            podName: runtime.podName,
            ingress: runtime.ingress,
            token: runtime.token,
          });
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
      if (onRuntimeCreated && runtime) {
        // runtime is already a plain JSON object from the bridge (RuntimeJSON)
        onRuntimeCreated({
          id: runtime.uid,
          podName: runtime.podName,
          ingress: runtime.ingress,
          token: runtime.token,
        });
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

  // Handle Enter key in runtime dialog
  const handleRuntimeKeyDown = (event: React.KeyboardEvent) => {
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

  const handleTerminateRuntime = async () => {
    if (!runtimePodName || terminating) return;

    setTerminating(true);
    try {
      await window.datalayerClient.deleteRuntime(runtimePodName);

      // Refresh global runtime list so ALL notebooks see the updated list
      if (runtimeService) {
        await runtimeService.refreshAllRuntimes();
      }

      if (onRuntimeTerminated) {
        onRuntimeTerminated();
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
          p: 2,
          borderBottom: '1px solid',
          borderColor: 'border.default',
          bg: 'canvas.default',
        }}
      >
        {/* Left side: notebook controls */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {showNotebookControls && (
            <>
              <IconButton
                variant="invisible"
                size="small"
                aria-label="Run cell"
                title={!runtimePodName ? 'No runtime connected' : 'Run cell'}
                onClick={handleRun}
                icon={PlayIcon}
                disabled={!runtimePodName}
              />
              <IconButton
                variant="invisible"
                size="small"
                aria-label="Run all cells"
                title={
                  !runtimePodName ? 'No runtime connected' : 'Run all cells'
                }
                onClick={handleRunAll}
                icon={PaperAirplaneIcon}
                disabled={!runtimePodName}
              />
              <IconButton
                variant="invisible"
                size="small"
                aria-label="Interrupt"
                title={
                  !runtimePodName
                    ? 'No runtime connected'
                    : !isCellRunning
                      ? 'No cells running'
                      : 'Interrupt kernel'
                }
                onClick={handleInterrupt}
                icon={StopIcon}
                disabled={!runtimePodName || !isCellRunning}
              />
              <Box sx={{ width: 1, height: 20, bg: 'border.default', mx: 1 }} />
              <IconButton
                variant="invisible"
                size="small"
                aria-label="Delete cell"
                title="Delete cell"
                onClick={handleDelete}
                icon={TrashIcon}
              />
              <Box sx={{ width: 1, height: 20, bg: 'border.default', mx: 1 }} />
              <ButtonGroup>
                <Button
                  size="small"
                  variant={cellType === 'code' ? 'primary' : 'invisible'}
                  onClick={() => setCellType('code')}
                >
                  Code
                </Button>
                <Button
                  size="small"
                  variant={cellType === 'markdown' ? 'primary' : 'invisible'}
                  onClick={() => setCellType('markdown')}
                >
                  Markdown
                </Button>
              </ButtonGroup>
            </>
          )}
        </Box>

        {/* Right side: Runtime selector, terminate button, and close button */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <RuntimeSelector
            selectedRuntimePodName={runtimePodName}
            onRuntimeSelected={handleRuntimeSelectorChange}
            disabled={isConnecting || creating}
          />
          {runtimePodName && (
            <Button
              size="small"
              variant="danger"
              leadingVisual={StopIcon}
              onClick={() => setShowTerminateDialog(true)}
            >
              Terminate
            </Button>
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

export default Notebook2Toolbar;
