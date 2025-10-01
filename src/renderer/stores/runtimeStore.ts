/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Zustand store for managing compute runtime state and lifecycle.
 * Handles runtime creation, termination, ServiceManager instances, and cleanup.
 *
 * @module renderer/stores/runtimeStore
 */

import { create } from 'zustand';
import { ServiceManager } from '@jupyterlab/services';

// Type declarations for globalThis properties
declare global {
  var __datalayerRuntimeCleanup:
    | Map<string, { terminated: boolean }>
    | undefined;
  var __runtimeCreationPromises:
    | Map<string, Promise<Runtime | null>>
    | undefined;
}

/**
 * Runtime information from Datalayer API.
 */
interface Runtime {
  uid: string;
  given_name?: string;
  pod_name: string;
  ingress?: string;
  token?: string;
  environment_name?: string;
  environment_title?: string;
  type?: string;
  burning_rate?: number;
  reservation_id?: string;
  started_at?: string;
  expired_at?: string;
  status?: string;
  [key: string]: unknown;
}

/**
 * Associates a notebook with its runtime and service manager.
 */
interface NotebookRuntime {
  notebookId: string;
  notebookPath?: string;
  runtime: Runtime;
  serviceManager?: ServiceManager.IManager;
}

/**
 * Runtime store state and actions.
 */
interface RuntimeState {
  // Map of notebook IDs to their runtimes
  notebookRuntimes: Map<string, NotebookRuntime>;

  // Currently active notebook
  activeNotebookId: string | null;

  // Global list of all platform runtimes
  allRuntimes: Runtime[];
  lastRuntimesFetch: number | null;

  // Expiration timers for automatic cleanup
  expirationTimers: Map<string, NodeJS.Timeout>;

  // Loading states
  isCreatingRuntime: boolean;
  isTerminatingRuntime: boolean;

  // Error state
  runtimeError: string | null;

  // Actions
  setActiveNotebook: (notebookId: string | null) => void;
  setIsCreatingRuntime: (value: boolean) => void;
  setIsTerminatingRuntime: (value: boolean) => void;
  setRuntimeError: (error: string | null) => void;

  // Runtime management
  createRuntimeForNotebook: (
    notebookId: string,
    notebookPath?: string,
    options?: { environment?: string; name?: string; credits?: number }
  ) => Promise<Runtime | null>;
  _createRuntimeInternal: (
    notebookId: string,
    notebookPath?: string,
    options?: { environment?: string; name?: string; credits?: number }
  ) => Promise<Runtime | null>;
  getRuntimeForNotebook: (notebookId: string) => NotebookRuntime | undefined;
  setServiceManagerForNotebook: (
    notebookId: string,
    manager: ServiceManager.IManager
  ) => void;
  terminateRuntimeForNotebook: (notebookId: string) => Promise<void>;
  terminateAllRuntimes: () => Promise<void>;

  // Helper getters
  getCurrentRuntime: () => Runtime | null;
  getCurrentServiceManager: () => ServiceManager.IManager | null;
  getActiveNotebook: () => NotebookRuntime | null;
  hasActiveRuntime: () => boolean;
  getActiveNotebookWithRuntime: () => {
    notebookId: string;
    notebookPath?: string;
  } | null;

  // Persistence
  saveRuntimesToStorage: () => void;
  loadRuntimesFromStorage: () => void;
  reconnectToExistingRuntimes: () => Promise<void>;
  createServiceManagerFromRuntime: (
    runtime: Record<string, unknown>,
    notebookId: string,
    notebookPath: string
  ) => Promise<ServiceManager.IManager | null>;
  removeRuntimeFromStorage: (notebookId: string) => void;

  // Single notebook enforcement
  canOpenNotebook: (notebookId: string) => {
    allowed: boolean;
    message?: string;
  };

  // Global runtime management
  fetchAllRuntimes: () => Promise<Runtime[]>;
  refreshRuntimes: () => Promise<Runtime[]>;
  selectRuntimeForNotebook: (
    notebookId: string,
    runtime: Runtime
  ) => Promise<void>;
  startExpirationTimer: (runtime: Runtime) => void;
  handleRuntimeExpired: (runtimeUid: string) => void;
  clearAllExpirationTimers: () => void;
}

export const useRuntimeStore = create<RuntimeState>((set, get) => ({
  // Initial state
  notebookRuntimes: new Map(),
  activeNotebookId: null,
  allRuntimes: [],
  lastRuntimesFetch: null,
  expirationTimers: new Map(),
  isCreatingRuntime: false,
  isTerminatingRuntime: false,
  runtimeError: null,

  // Basic setters
  setActiveNotebook: notebookId => set({ activeNotebookId: notebookId }),
  setIsCreatingRuntime: value => set({ isCreatingRuntime: value }),
  setIsTerminatingRuntime: value => set({ isTerminatingRuntime: value }),
  setRuntimeError: error => set({ runtimeError: error }),

  // Create a runtime for a specific notebook
  createRuntimeForNotebook: async (notebookId, notebookPath, options) => {
    const { notebookRuntimes } = get();

    // Check if this notebook already has a runtime
    const existingRuntime = notebookRuntimes.get(notebookId);
    if (existingRuntime) {
      // CRITICAL: Check if the runtime has been terminated
      const cleanupRegistry = globalThis.__datalayerRuntimeCleanup;
      const isTerminated =
        cleanupRegistry &&
        cleanupRegistry.has(existingRuntime.runtime.uid) &&
        cleanupRegistry.get(existingRuntime.runtime.uid)?.terminated;

      if (isTerminated) {
        // Existing runtime has been terminated, creating new one
      } else {
        return existingRuntime.runtime;
      }
    }

    // CRITICAL: Prevent race condition by checking if runtime creation is already in progress
    // This prevents React strict mode from triggering duplicate API calls
    if (!globalThis.__runtimeCreationPromises) {
      globalThis.__runtimeCreationPromises = new Map();
    }

    const existingPromise =
      globalThis.__runtimeCreationPromises.get(notebookId);
    if (existingPromise) {
      return existingPromise;
    }

    // Create and store the promise to prevent concurrent requests
    const creationPromise = get()._createRuntimeInternal(
      notebookId,
      notebookPath,
      options
    );
    globalThis.__runtimeCreationPromises.set(notebookId, creationPromise);

    try {
      const result = await creationPromise;
      globalThis.__runtimeCreationPromises.delete(notebookId);
      return result;
    } catch (error) {
      globalThis.__runtimeCreationPromises.delete(notebookId);
      throw error;
    }
  },

  // Internal runtime creation method (extracted to allow promise caching)
  _createRuntimeInternal: async (notebookId, notebookPath, options) => {
    const { notebookRuntimes } = get();
    const { setIsCreatingRuntime, setRuntimeError } = get();

    setIsCreatingRuntime(true);
    setRuntimeError(null);

    try {
      // Add timestamp to ensure unique runtime names
      const timestamp = Date.now().toString(36); // Convert to base36 for shorter string
      const createRuntimeParams = {
        environment: options?.environment || 'python-cpu-env',
        name: `electron-example-${notebookId}-${timestamp}`,
        credits: options?.credits || 10,
      };

      // Check authentication state before API call
      await (window as any).datalayerAPI.getCredentials();

      const result = await (window as any).datalayerAPI.createRuntime(
        createRuntimeParams
      );

      if (result.success && result.data?.runtime) {
        const runtime = result.data.runtime;

        // Store the runtime for this notebook
        const newRuntimes = new Map(notebookRuntimes);
        newRuntimes.set(notebookId, {
          notebookId,
          notebookPath,
          runtime,
        });
        set({ notebookRuntimes: newRuntimes });

        // Save to storage for persistence
        get().saveRuntimesToStorage();

        return runtime;
      } else {
        throw new Error(result.error || 'Failed to create runtime');
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to create runtime';
      setRuntimeError(errorMessage);
      return null;
    } finally {
      setIsCreatingRuntime(false);
    }
  },

  // Get runtime for a specific notebook
  getRuntimeForNotebook: notebookId => {
    return get().notebookRuntimes.get(notebookId);
  },

  // Set service manager for a notebook
  setServiceManagerForNotebook: (notebookId, manager) => {
    const { notebookRuntimes } = get();
    const notebookRuntime = notebookRuntimes.get(notebookId);

    if (notebookRuntime) {
      const newRuntimes = new Map(notebookRuntimes);
      newRuntimes.set(notebookId, {
        ...notebookRuntime,
        serviceManager: manager,
      });
      set({ notebookRuntimes: newRuntimes });
    }
  },

  // Terminate runtime for a specific notebook
  terminateRuntimeForNotebook: async notebookId => {
    // Wrap entire function in a Promise to handle all async errors
    return new Promise<void>((resolve, reject) => {
      let resolved = false; // Track if promise has been resolved

      // Use async IIFE to handle async operations
      (async () => {
        const { notebookRuntimes, setIsTerminatingRuntime, setRuntimeError } =
          get();
        const notebookRuntime = notebookRuntimes.get(notebookId);

        if (!notebookRuntime) {
          resolved = true;
          resolve();
          return;
        }

        setIsTerminatingRuntime(true);
        setRuntimeError(null);

        try {
          // CRITICAL: Clear cached creation promise for this notebook
          // This ensures new requests create fresh runtimes instead of reusing terminated ones
          if (globalThis.__runtimeCreationPromises) {
            if (globalThis.__runtimeCreationPromises.has(notebookId)) {
              globalThis.__runtimeCreationPromises.delete(notebookId);
            }
          }

          // STEP 1: First shut down all sessions and kernels cleanly
          if (
            notebookRuntime.serviceManager &&
            !notebookRuntime.serviceManager.isDisposed
          ) {
            try {
              const serviceManager = notebookRuntime.serviceManager;

              // Shut down all sessions for this notebook
              if (serviceManager.sessions) {
                await serviceManager.sessions.refreshRunning();
                const runningSessions = Array.from(
                  serviceManager.sessions.running()
                );
                for (const session of runningSessions) {
                  try {
                    await serviceManager.sessions.shutdown(session.id);
                  } catch {
                    // Error shutting down session
                  }
                }
              }

              // Shut down all kernels
              if (serviceManager.kernels) {
                await serviceManager.kernels.refreshRunning();
                const runningKernels = Array.from(
                  serviceManager.kernels.running()
                );
                for (const kernel of runningKernels) {
                  try {
                    await serviceManager.kernels.shutdown(kernel.id);
                  } catch {
                    // Ignore 200 response errors - these are actually successful shutdowns
                  }
                }
              }
            } catch {
              // Error during session/kernel shutdown
            }
          }

          // STEP 2: Clean up collaboration provider
          try {
            // Emit a global event that NotebookView components can listen to
            const collaborationCleanupEvent = new CustomEvent(
              'runtime-collaboration-cleanup',
              {
                detail: {
                  runtimeId: notebookRuntime.runtime.uid,
                  notebookId: notebookId,
                },
              }
            );
            window.dispatchEvent(collaborationCleanupEvent);
          } catch {
            // Failed to dispatch collaboration cleanup event
          }

          // STEP 3: Close WebSocket connections for this runtime
          try {
            await (window as any).proxyAPI.websocketCloseRuntime({
              runtimeId: notebookRuntime.runtime.uid,
            });
          } catch {
            // Failed to close WebSocket connections
          }

          // STEP 4: Dispose service manager
          if (
            notebookRuntime.serviceManager &&
            !notebookRuntime.serviceManager.isDisposed
          ) {
            // Aggressive cleanup: Force stop any kernel polling/requests
            try {
              const serviceManager = notebookRuntime.serviceManager as any;

              // Stop kernel manager polling if it exists
              if (
                serviceManager.kernels &&
                typeof serviceManager.kernels.dispose === 'function' &&
                !serviceManager.kernels.isDisposed
              ) {
                try {
                  const disposeResult = serviceManager.kernels.dispose();
                  // Handle both sync and async disposal
                  if (
                    disposeResult &&
                    typeof disposeResult.catch === 'function'
                  ) {
                    disposeResult.catch(() => {
                      // Ignore Poll disposal errors - these are expected during cleanup
                    });
                  }
                } catch {
                  // Ignore Poll disposal errors - these are expected during cleanup
                }
              }

              // Stop session manager polling if it exists
              if (
                serviceManager.sessions &&
                typeof serviceManager.sessions.dispose === 'function' &&
                !serviceManager.sessions.isDisposed
              ) {
                try {
                  const disposeResult = serviceManager.sessions.dispose();
                  // Handle both sync and async disposal
                  if (
                    disposeResult &&
                    typeof disposeResult.catch === 'function'
                  ) {
                    disposeResult.catch(() => {
                      // Ignore Poll disposal errors - these are expected during cleanup
                    });
                  }
                } catch {
                  // Ignore Poll disposal errors - these are expected during cleanup
                }
              }

              // Clear any pending timers/intervals
              if (
                serviceManager._kernelManager &&
                serviceManager._kernelManager._models
              ) {
                serviceManager._kernelManager._models.clear();
              }

              if (
                serviceManager._sessionManager &&
                serviceManager._sessionManager._models
              ) {
                serviceManager._sessionManager._models.clear();
              }
            } catch {
              // Error during aggressive cleanup
            }

            try {
              notebookRuntime.serviceManager.dispose();
            } catch {
              // Ignore Poll disposal errors - these are expected during cleanup
            }
          }

          // Additional cleanup: Stop any kernel/session polling specifically for this runtime
          try {
            // Instead of clearing ALL timers, let's be more targeted
            // Force abort any pending fetch requests to this specific runtime
            // const _runtimeUrl = `${notebookRuntime.runtime.jupyter_server_url}`;

            // Store reference to track and clean up runtime-specific timers
            // We'll use a global registry for runtime-specific cleanup
            if (!(window as any).__datalayerRuntimeCleanup) {
              (window as any).__datalayerRuntimeCleanup = new Map();
            }

            const cleanupRegistry = (window as any).__datalayerRuntimeCleanup;
            const runtimeId = notebookRuntime.runtime.uid;

            // Mark this runtime as terminated to prevent new timers
            cleanupRegistry.set(runtimeId, { terminated: true });

            // Notify main process to update its cleanup registry for WebSocket blocking
            try {
              (window as any).electronAPI?.notifyRuntimeTerminated?.(runtimeId);
            } catch {
              // Error notifying main process
            }
          } catch {
            // Error during targeted cleanup
          }

          // Clear cached service manager if any
          const cacheKey = `serviceManager-${notebookRuntime.runtime.uid}`;
          if ((window as Record<string, any>)[cacheKey]) {
            delete (window as Record<string, any>)[cacheKey];
          }

          // Call API to delete runtime on server

          // Use pod_name for deletion (API requires pod name, not UID)
          const podNameToDelete = notebookRuntime.runtime.pod_name;

          if (!podNameToDelete) {
            setRuntimeError('Cannot delete runtime - no pod name available');
            resolved = true;
            resolve();
            return;
          }

          const deleteResult = await (window as any).datalayerAPI.deleteRuntime(
            podNameToDelete
          );

          if (!deleteResult.success) {
            // Failed to delete runtime on server
          }

          // Remove from map
          const newRuntimes = new Map(notebookRuntimes);
          newRuntimes.delete(notebookId);

          // Clear active notebook if it was this one
          const { activeNotebookId } = get();
          if (activeNotebookId === notebookId) {
            set({
              notebookRuntimes: newRuntimes,
              activeNotebookId: null,
            });
          } else {
            set({ notebookRuntimes: newRuntimes });
          }

          // Update storage
          get().saveRuntimesToStorage();

          resolved = true;
          resolve();
        } catch (error) {
          const errorMessage =
            error instanceof Error
              ? error.message
              : 'Failed to terminate runtime';

          // Filter out expected Poll disposal errors
          if (
            String(error).includes('Poll') &&
            String(error).includes('disposed')
          ) {
            resolved = true;
            resolve(); // Don't treat Poll disposal as a real error
          } else {
            setRuntimeError(errorMessage);
            resolved = true;
            reject(error); // Reject with the error for real failures
          }
        } finally {
          setIsTerminatingRuntime(false);
          // Ensure promise resolves even if not handled in catch
          if (!resolved) {
            resolved = true;
            resolve();
          }
        }
      })(); // Execute the async IIFE
    });
  },

  // Terminate all runtimes
  terminateAllRuntimes: async () => {
    const { notebookRuntimes } = get();

    for (const [notebookId] of notebookRuntimes) {
      await get().terminateRuntimeForNotebook(notebookId);
    }

    // Clear all state and storage
    set({
      notebookRuntimes: new Map(),
      activeNotebookId: null,
    });
    sessionStorage.removeItem('datalayer-runtimes');
  },

  // Helper getters
  getCurrentRuntime: () => {
    const { activeNotebookId, notebookRuntimes } = get();
    if (!activeNotebookId) return null;

    const notebookRuntime = notebookRuntimes.get(activeNotebookId);
    return notebookRuntime?.runtime || null;
  },

  getCurrentServiceManager: () => {
    const { activeNotebookId, notebookRuntimes } = get();
    if (!activeNotebookId) return null;

    const notebookRuntime = notebookRuntimes.get(activeNotebookId);
    return notebookRuntime?.serviceManager || null;
  },

  getActiveNotebook: () => {
    const { activeNotebookId, notebookRuntimes } = get();
    if (!activeNotebookId) return null;

    return notebookRuntimes.get(activeNotebookId) || null;
  },

  hasActiveRuntime: () => {
    const { notebookRuntimes } = get();
    return notebookRuntimes.size > 0;
  },

  getActiveNotebookWithRuntime: () => {
    const { notebookRuntimes, activeNotebookId } = get();

    // Try to get the active notebook first
    if (activeNotebookId && notebookRuntimes.has(activeNotebookId)) {
      const runtime = notebookRuntimes.get(activeNotebookId)!;
      return {
        notebookId: runtime.notebookId,
        notebookPath: runtime.notebookPath,
      };
    }

    // Otherwise return the first notebook with a runtime
    if (notebookRuntimes.size > 0) {
      const firstRuntime = notebookRuntimes.values().next().value;
      if (firstRuntime) {
        return {
          notebookId: firstRuntime.notebookId,
          notebookPath: firstRuntime.notebookPath,
        };
      }
    }

    return null;
  },

  // Persistence methods
  saveRuntimesToStorage: () => {
    const { notebookRuntimes } = get();
    const runtimesData: Array<{
      notebookId: string;
      notebookPath?: string;
      runtime: Runtime;
    }> = [];

    notebookRuntimes.forEach((value, key) => {
      runtimesData.push({
        notebookId: key,
        notebookPath: value.notebookPath,
        runtime: value.runtime,
      });
    });

    sessionStorage.setItem('datalayer-runtimes', JSON.stringify(runtimesData));
  },

  // Reconnect to existing active runtimes on startup
  reconnectToExistingRuntimes: async () => {
    try {
      // Get stored runtime info
      const storedData = sessionStorage.getItem('datalayer-runtimes');
      if (!storedData) {
        return;
      }

      const parsedData = JSON.parse(storedData);
      const storedRuntimes = parsedData.notebookRuntimes || {};

      // Check each stored runtime to see if it's still active
      for (const [notebookId, runtimeInfo] of Object.entries(storedRuntimes)) {
        const info = runtimeInfo as Record<string, any>;
        const podName = (info.runtime as any)?.pod_name as string;

        if (podName) {
          // Check if runtime is still active
          const statusResponse = await (
            window as any
          ).datalayerAPI.isRuntimeActive(podName);

          if (
            statusResponse.success &&
            statusResponse.isActive &&
            statusResponse.runtime
          ) {
            try {
              // Recreate the service manager with existing runtime
              const serviceManager =
                await get().createServiceManagerFromRuntime(
                  statusResponse.runtime,
                  notebookId,
                  info.notebookPath as string
                );

              if (serviceManager) {
                // Store the reconnected runtime
                const notebookRuntime: NotebookRuntime = {
                  notebookId,
                  notebookPath: info.notebookPath as string,
                  runtime: statusResponse.runtime,
                  serviceManager,
                };

                set(state => ({
                  notebookRuntimes: new Map(state.notebookRuntimes).set(
                    notebookId,
                    notebookRuntime
                  ),
                  activeNotebookId: notebookId, // Set as active if successfully reconnected
                }));

                get().saveRuntimesToStorage();
              }
            } catch {
              // Remove invalid runtime from storage
              get().removeRuntimeFromStorage(notebookId);
            }
          } else {
            get().removeRuntimeFromStorage(notebookId);
          }
        }
      }
    } catch (error) {
      // Error during runtime reconnection
    }
  },

  // Create service manager from existing runtime data
  createServiceManagerFromRuntime: async (
    runtime: Record<string, unknown>,
    _notebookId: string,
    _notebookPath: string
  ): Promise<ServiceManager.IManager | null> => {
    try {
      // RACE CONDITION PREVENTION: Check if runtime is terminated before creating ServiceManager
      const runtimeUid = runtime.uid as string;
      const cleanupRegistry = (window as any).__datalayerRuntimeCleanup;
      if (cleanupRegistry && runtimeUid) {
        if (
          cleanupRegistry.has(runtimeUid) &&
          cleanupRegistry.get(runtimeUid).terminated
        ) {
          return null;
        }
      }

      // Check if we're currently terminating any runtime
      const { isTerminatingRuntime } = get();
      if (isTerminatingRuntime) {
        return null;
      }

      const { createProxyServiceManager } = await import(
        '../services/proxyServiceManager'
      );

      const runtimeData = {
        pod_name: runtime.pod_name as string,
        ingress: runtime.ingress as string,
        token: runtime.token as string,
        uid: runtime.uid as string,
      };

      const serviceManager = await createProxyServiceManager(
        runtimeData.ingress,
        runtimeData.token,
        runtimeData.uid
      );

      return serviceManager;
    } catch (error) {
      return null;
    }
  },

  // Remove runtime from storage
  removeRuntimeFromStorage: (notebookId: string) => {
    const storedData = sessionStorage.getItem('datalayer-runtimes');
    if (storedData) {
      try {
        const parsedData = JSON.parse(storedData);
        if (
          parsedData.notebookRuntimes &&
          parsedData.notebookRuntimes[notebookId]
        ) {
          delete parsedData.notebookRuntimes[notebookId];
          sessionStorage.setItem(
            'datalayer-runtimes',
            JSON.stringify(parsedData)
          );
        }
      } catch (error) {
        // Error removing runtime from storage
      }
    }
  },

  loadRuntimesFromStorage: () => {
    const stored = sessionStorage.getItem('datalayer-runtimes');
    if (!stored) return;

    try {
      const runtimesData = JSON.parse(stored);
      const newRuntimes = new Map<string, NotebookRuntime>();

      runtimesData.forEach((item: Record<string, any>) => {
        newRuntimes.set(item.notebookId as string, {
          notebookId: item.notebookId as string,
          notebookPath: item.notebookPath as string | undefined,
          runtime: item.runtime as Runtime,
        });
      });

      set({ notebookRuntimes: newRuntimes });
    } catch (error) {
      // Failed to load runtimes from storage
    }
  },

  // Multiple notebooks are now supported - always allow opening
  canOpenNotebook: () => {
    return { allowed: true };
  },

  // Fetch all runtimes from platform
  fetchAllRuntimes: async () => {
    try {
      // Bridge returns array of plain RuntimeJSON objects, not SDK models
      const runtimes = await (window as any).datalayerClient.listRuntimes();

      // Start expiration timers for all runtimes
      runtimes.forEach((runtime: Runtime) => {
        get().startExpirationTimer(runtime);
      });

      set({
        allRuntimes: runtimes,
        lastRuntimesFetch: Date.now(),
      });

      return runtimes;
    } catch (error) {
      console.error('[runtimeStore] Failed to fetch runtimes:', error);
      return [];
    }
  },

  // Refresh runtimes if cache is stale
  refreshRuntimes: async () => {
    const { lastRuntimesFetch } = get();
    const now = Date.now();

    // Refresh if never fetched OR last fetch was >30s ago
    if (!lastRuntimesFetch || now - lastRuntimesFetch > 30000) {
      return get().fetchAllRuntimes();
    }

    return get().allRuntimes;
  },

  // Select an existing runtime for a notebook
  selectRuntimeForNotebook: async (notebookId: string, runtime: Runtime) => {
    const { notebookRuntimes } = get();

    // Add to notebook runtimes
    const newRuntimes = new Map(notebookRuntimes);
    newRuntimes.set(notebookId, {
      notebookId,
      runtime,
    });

    set({
      notebookRuntimes: newRuntimes,
      activeNotebookId: notebookId,
    });

    // Start expiration timer
    get().startExpirationTimer(runtime);

    // Save to storage
    get().saveRuntimesToStorage();
  },

  // Start expiration timer for a runtime
  startExpirationTimer: (runtime: Runtime) => {
    const { expirationTimers } = get();

    // Clear existing timer if any
    const existingTimer = expirationTimers.get(runtime.uid);
    if (existingTimer) {
      clearTimeout(existingTimer);
    }

    // Parse expiration timestamp
    const parseTimestamp = (value: string | number) => {
      if (typeof value === 'string' && !value.includes('-')) {
        return new Date(parseFloat(value) * 1000);
      }
      return new Date(value);
    };

    const expiredAtValue = (runtime.expired_at || runtime.expiredAt || '0') as
      | string
      | number;
    const expiresAt = parseTimestamp(expiredAtValue).getTime();
    const now = Date.now();
    const msUntilExpiration = Math.max(0, expiresAt - now);

    // Don't set timer if already expired
    if (msUntilExpiration <= 0) {
      get().handleRuntimeExpired(runtime.uid);
      return;
    }

    // Set timer to remove runtime when expired
    const timer = setTimeout(() => {
      get().handleRuntimeExpired(runtime.uid);
    }, msUntilExpiration);

    // Store timer reference
    const newTimers = new Map(expirationTimers);
    newTimers.set(runtime.uid, timer);
    set({ expirationTimers: newTimers });
  },

  // Handle runtime expiration
  handleRuntimeExpired: (runtimeUid: string) => {
    const { allRuntimes, expirationTimers, notebookRuntimes } = get();

    // Find the expired runtime details for notification
    const expiredRuntime = allRuntimes.find(r => r.uid === runtimeUid);
    const runtimeName =
      expiredRuntime?.given_name ||
      expiredRuntime?.givenName ||
      expiredRuntime?.pod_name ||
      expiredRuntime?.podName ||
      'Unknown';

    // Remove from global list
    const newAllRuntimes = allRuntimes.filter(r => r.uid !== runtimeUid);

    // Remove timer
    const timer = expirationTimers.get(runtimeUid);
    if (timer) {
      clearTimeout(timer);
    }
    const newTimers = new Map(expirationTimers);
    newTimers.delete(runtimeUid);

    // Find and remove from notebook runtimes
    const newNotebookRuntimes = new Map(notebookRuntimes);
    for (const [notebookId, nbRuntime] of notebookRuntimes) {
      if (nbRuntime.runtime.uid === runtimeUid) {
        newNotebookRuntimes.delete(notebookId);
      }
    }

    set({
      allRuntimes: newAllRuntimes,
      expirationTimers: newTimers,
      notebookRuntimes: newNotebookRuntimes,
    });

    // Show notification to user
    if ((window.electronAPI as any)?.showNotification) {
      (window.electronAPI as any).showNotification({
        title: 'Runtime Expired',
        body: `Runtime "${runtimeName}" has expired and been terminated.`,
      });
    }

    // Update storage
    get().saveRuntimesToStorage();
  },

  // Clear all expiration timers (cleanup on unmount)
  clearAllExpirationTimers: () => {
    const { expirationTimers } = get();

    expirationTimers.forEach(timer => clearTimeout(timer));
    set({ expirationTimers: new Map() });
  },
}));
