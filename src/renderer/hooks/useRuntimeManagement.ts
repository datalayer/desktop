/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * @module useRuntimeManagement
 * @description React hook for managing Jupyter runtime lifecycle, service managers, and runtime state coordination
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import type { ServiceManager } from '@jupyterlab/services';
import {
  UseRuntimeManagementOptions,
  UseRuntimeManagementReturn,
} from '../../shared/types';
import { useRuntimeStore } from '../stores/runtimeStore';
import { createProxyServiceManager } from '../services/proxyServiceManager';
import {
  isRuntimeTerminated,
  markRuntimeTerminated,
  clearRuntimeTerminationFlag,
  getCachedServiceManager,
  cacheServiceManager,
  removeCachedServiceManager,
  safelyDisposeServiceManager,
  formatErrorMessage,
} from '../utils/notebook';

/**
 * React hook that manages the complete lifecycle of Jupyter runtimes and service managers.
 * Handles runtime creation, termination, caching, and state synchronization with the runtime store.
 *
 * @param options - Configuration options for runtime management
 * @param options.selectedNotebook - Currently selected notebook object
 * @param options.configuration - Datalayer configuration with service URLs and authentication
 * @returns Object containing service manager, runtime state, and control functions
 */
export const useRuntimeManagement = ({
  selectedNotebook,
  configuration,
}: UseRuntimeManagementOptions): UseRuntimeManagementReturn => {
  const [serviceManager, setServiceManager] =
    useState<ServiceManager.IManager | null>(null);
  const [creating, setCreating] = useState(false);
  const [terminating, setTerminating] = useState(false);
  const [terminated, setTerminated] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use refs to prevent race conditions and component lifecycle issues
  const mountedRef = useRef(true);

  // Use runtime store for runtime management
  const {
    isCreatingRuntime,
    isTerminatingRuntime,
    runtimeError,
    createRuntimeForNotebook,
    getRuntimeForNotebook,
    terminateRuntimeForNotebook,
    setServiceManagerForNotebook,
    setActiveNotebook,
    loadRuntimesFromStorage,
  } = useRuntimeStore();

  // Get runtime for current notebook
  const notebookRuntime = selectedNotebook
    ? getRuntimeForNotebook(selectedNotebook.id)
    : null;
  const runtime = notebookRuntime?.runtime;

  // Component mount/unmount tracking
  useEffect(() => {
    mountedRef.current = true;
    loadRuntimesFromStorage();
    return () => {
      mountedRef.current = false;
    };
  }, [loadRuntimesFromStorage]);

  // Reset termination flag when changing notebooks
  useEffect(() => {
    if (mountedRef.current && selectedNotebook) {
      setTerminated(false);
      clearRuntimeTerminationFlag(selectedNotebook.id);
    }
  }, [selectedNotebook?.id]);

  // Initialize service manager for the notebook
  useEffect(() => {
    let cancelled = false;

    const initServiceManager = async () => {
      if (!mountedRef.current || !selectedNotebook) {
        return;
      }

      // PRIORITY CHECK: Don't create resources if runtime was terminated
      if (terminated) {
        return;
      }

      // Check if this notebook's runtime was just terminated
      if (isRuntimeTerminated(selectedNotebook.id)) {
        return;
      }

      // ADDITIONAL CHECK: Check global cleanup registry for any existing runtime
      const cleanupRegistry = (window as any).__datalayerRuntimeCleanup;
      if (cleanupRegistry && runtime?.uid) {
        if (
          cleanupRegistry.has(runtime.uid) &&
          cleanupRegistry.get(runtime.uid).terminated
        ) {
          return;
        }
      }

      // TERMINATING STATE CHECK: Don't create resources if currently terminating
      if (isTerminatingRuntime) {
        return;
      }

      // Check if we already have a runtime with service manager for this notebook
      const existingRuntime = getRuntimeForNotebook(selectedNotebook.id);
      const hasExistingServiceManager =
        existingRuntime?.serviceManager &&
        !existingRuntime.serviceManager.isDisposed;

      if (
        configuration?.token &&
        configuration?.runUrl &&
        !hasExistingServiceManager
      ) {
        setError(null);
        setCreating(true);

        try {
          // Check if this notebook was just terminated
          if (isRuntimeTerminated(selectedNotebook.id)) {
            clearRuntimeTerminationFlag(selectedNotebook.id);
            return;
          }

          // Set this notebook as active
          setActiveNotebook(selectedNotebook.id);

          // Get or create runtime for this specific notebook
          let currentRuntime = runtime;

          // Only create a new runtime if one doesn't exist
          if (!currentRuntime) {
            const newRuntime = await createRuntimeForNotebook(
              selectedNotebook.id,
              selectedNotebook.path,
              {
                environment: 'python-cpu-env',
                credits: 10,
              }
            );

            if (!newRuntime) {
              throw new Error(runtimeError || 'Failed to create runtime');
            }
            currentRuntime = newRuntime;
          }

          const jupyterServerUrl = currentRuntime?.ingress;
          if (!jupyterServerUrl) {
            throw new Error(
              'No Jupyter server URL provided in runtime response'
            );
          }

          const jupyterToken = currentRuntime?.token || configuration.token;

          if (cancelled || !mountedRef.current) return;

          // Check if we already have a service manager for this runtime
          let manager = getCachedServiceManager(currentRuntime.uid);

          if (!manager) {
            manager = await createProxyServiceManager(
              jupyterServerUrl,
              jupyterToken,
              currentRuntime.uid
            );

            if (manager) {
              await manager.ready;
            }

            if (cancelled || !mountedRef.current) {
              // Clean up if component was unmounted during async operation
              safelyDisposeServiceManager(manager);
              return;
            }

            // Cache the service manager with cleanup
            cacheServiceManager(currentRuntime.uid, manager);

            // Add cleanup function to prevent disposal conflicts
            if (manager && typeof (manager as any).dispose === 'function') {
              const originalDispose = (manager as any).dispose.bind(manager);
              (manager as any).dispose = function () {
                removeCachedServiceManager(currentRuntime.uid);
                try {
                  // Check if the manager is still valid and not disposed
                  if (
                    manager &&
                    !(manager as any).isDisposed &&
                    typeof originalDispose === 'function'
                  ) {
                    originalDispose();
                  }
                } catch (e) {
                  // Ignore disposal errors as they're expected during cleanup
                }
              }.bind(manager);
            }
          } else {
            // Verify the manager is still valid
            if ((manager as any).isDisposed) {
              removeCachedServiceManager(currentRuntime.uid);
              manager = await createProxyServiceManager(
                jupyterServerUrl,
                jupyterToken,
                currentRuntime.uid
              );

              if (manager) {
                await manager.ready;
              }

              if (cancelled || !mountedRef.current) {
                safelyDisposeServiceManager(manager);
                return;
              }
              cacheServiceManager(currentRuntime.uid, manager);
            }
          }

          if (cancelled || !mountedRef.current) {
            return;
          }

          if (manager) {
            setServiceManagerForNotebook(selectedNotebook.id, manager);
            setServiceManager(manager);
          }
        } catch (initError) {
          if (!cancelled) {
            const errorMessage = formatErrorMessage(initError as Error);
            setError(errorMessage);
          }
        } finally {
          setCreating(false);
        }
      } else if (!configuration?.token || !configuration?.runUrl) {
        setServiceManager(null);
        setError(null);
      } else if (hasExistingServiceManager) {
        // Use existing service manager
        setServiceManager(existingRuntime.serviceManager || null);
        setError(null);
      }
    };

    initServiceManager();

    return () => {
      cancelled = true;
    };
  }, [
    configuration?.token,
    configuration?.runUrl,
    selectedNotebook?.id,
    selectedNotebook?.path,
    runtime,
    getRuntimeForNotebook,
    createRuntimeForNotebook,
    setServiceManagerForNotebook,
    setActiveNotebook,
    runtimeError,
  ]);

  // Terminate runtime function
  const terminateRuntime = useCallback(async () => {
    if (!selectedNotebook) return;

    setTerminating(true);
    try {
      // Mark as terminated to prevent re-creation
      markRuntimeTerminated(selectedNotebook.id);

      await terminateRuntimeForNotebook(selectedNotebook.id);

      setServiceManager(null);
      setError(null);
      setTerminated(true);

      // Clear the active notebook from the store
      setActiveNotebook(null);
    } catch (terminateError) {
      // Don't set error state here - let the parent component handle it
    } finally {
      setTerminating(false);
    }
  }, [selectedNotebook, terminateRuntimeForNotebook, setActiveNotebook]);

  return {
    serviceManager,
    runtime,
    creating: creating || isCreatingRuntime,
    terminating: terminating || isTerminatingRuntime,
    terminated,
    error: error || runtimeError,
    terminateRuntime,
  };
};
