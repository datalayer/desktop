/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Notebook editor with collaboration.
 * Completely remounts notebook when runtime is selected/changed.
 *
 * @module renderer/pages/NotebookEditor
 */

import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from 'react';
import { Box } from '@primer/react';
import type { ServiceManager, Kernel } from '@jupyterlab/services';
import type { Runtime } from '../services/interfaces/IRuntimeService';
import {
  Notebook2,
  notebookStore2,
  CellSidebarExtension,
  CellSidebarButton,
} from '@datalayer/jupyter-react';
import { useCoreStore } from '@datalayer/core/lib/state';
import { useService } from '../contexts/ServiceContext';
import { createProxyServiceManager } from '../services/proxyServiceManager';
import { createMockServiceManager } from '../services/mockServiceManager';
import { ElectronCollaborationProvider } from '../services/electronCollaborationProvider';
import { RuntimeToolbar } from '../components/runtime/RuntimeToolbar';
import { NotebookControls } from '../components/notebook/NotebookControls';

interface NotebookEditorProps {
  notebookId: string;
}

/**
 * Notebook editor that creates a fresh service manager when runtime changes.
 * Each runtime selection completely remounts the notebook component.
 */
const NotebookEditor: React.FC<NotebookEditorProps> = ({ notebookId }) => {
  const { configuration, setConfiguration } = useCoreStore();
  const runtimeService = useService('runtimeService');

  const [collaborationProvider, setCollaborationProvider] =
    useState<unknown>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [runtimeInfo, setRuntimeInfo] = useState<{
    id: string;
    podName: string;
    ingress: string;
    token: string;
  } | null>(null);
  const [serviceManager, setServiceManager] =
    useState<ServiceManager.IManager | null>(null);
  const [serviceManagerReady, setServiceManagerReady] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize RuntimeService
  useEffect(() => {
    if (!runtimeService) return;

    const initService = async () => {
      if (runtimeService.state === 'uninitialized') {
        await runtimeService.initialize();
      }
    };

    initService();
  }, [runtimeService]);

  // Listen for global runtime expiration events
  useEffect(() => {
    if (!runtimeService) return;

    const unsubscribe = runtimeService.onRuntimeExpired(expiredPodName => {
      console.log('[NotebookEditor] Runtime expired globally:', expiredPodName);

      // Check current runtime using setRuntimeInfo callback to avoid dependency
      setRuntimeInfo(current => {
        if (current?.podName === expiredPodName) {
          console.log(
            '[NotebookEditor] Current runtime expired, switching to mock'
          );
          return null;
        }
        return current;
      });
    });

    return () => {
      unsubscribe();
    };
  }, [runtimeService]); // Only depend on runtimeService, not runtimeInfo

  // Handle runtime selection - set runtime info which will trigger service manager creation
  const handleRuntimeSelected = useCallback(async (runtime: Runtime | null) => {
    if (!runtime) {
      console.log('[NotebookEditor] Creating new runtime...');
      setRuntimeInfo(null);
      return;
    }

    console.log('[NotebookEditor] Runtime selected:', runtime);
    const info = {
      id: runtime.uid,
      podName: runtime.podName,
      ingress: runtime.ingress,
      token: runtime.token,
    };
    console.log('[NotebookEditor] Setting runtime info:', info);
    setRuntimeInfo(info);
  }, []);

  // Get authentication token from main process
  useEffect(() => {
    const getAuthToken = async () => {
      try {
        if (window.datalayerClient?.getAuthState) {
          const authState = await window.datalayerClient.getAuthState();
          if (authState.isAuthenticated && authState.token) {
            setAuthToken(authState.token);
            setConfiguration({
              token: authState.token,
              runUrl: authState.runUrl || configuration.runUrl,
            });
          }
        }
      } catch (error) {
        console.error(
          '[NotebookEditorSimple] Failed to get auth state:',
          error
        );
      }
    };

    getAuthToken();
  }, [setConfiguration]);

  // Initialize collaboration provider
  useEffect(() => {
    if (!configuration?.runUrl || !authToken) {
      return;
    }

    const provider = new ElectronCollaborationProvider({
      runUrl: configuration.runUrl,
      token: authToken,
      runtimeId: undefined,
    });

    setCollaborationProvider(provider as unknown);

    return () => {
      if (provider && typeof provider.dispose === 'function') {
        provider.dispose();
      }
    };
  }, [configuration?.runUrl, authToken]);

  // Create service manager when runtime info changes
  useEffect(() => {
    let mounted = true;
    let currentManager: ServiceManager.IManager | null = null;

    const createServiceManager = async () => {
      // Immediately clear service manager to prevent race conditions
      // This ensures Notebook2 unmounts before we create a new manager
      setServiceManager(null);
      setServiceManagerReady(false);

      // Wait a tick to allow React to finish unmounting the previous widget
      await new Promise(resolve => setTimeout(resolve, 0));

      if (!mounted) return;

      if (!runtimeInfo) {
        // No runtime - use mock service manager
        console.log(
          '[NotebookEditor] No runtime info, using mock service manager'
        );
        const mockManager = createMockServiceManager();
        currentManager = mockManager;
        if (mounted) {
          setServiceManager(mockManager);
          setServiceManagerReady(false); // Don't start kernel with mock
        }
      } else {
        // Runtime selected - create real service manager
        console.log('[NotebookEditor] Creating real service manager with:', {
          ingress: runtimeInfo.ingress,
          id: runtimeInfo.id,
          podName: runtimeInfo.podName,
        });
        try {
          const realManager = await createProxyServiceManager(
            runtimeInfo.ingress,
            runtimeInfo.token,
            runtimeInfo.id
          );
          console.log(
            '[NotebookEditor] Real service manager created successfully'
          );
          currentManager = realManager;
          if (mounted) {
            setServiceManager(realManager);
            setServiceManagerReady(true); // Now we can start kernel
          } else {
            // Component unmounted, clean up immediately
            await cleanupServiceManager(realManager);
          }
        } catch (error) {
          console.error(
            '[NotebookEditor] Failed to create service manager:',
            error
          );
          // Fallback to mock on error
          if (mounted) {
            console.log(
              '[NotebookEditor] Falling back to mock service manager'
            );
            const mockManager = createMockServiceManager();
            currentManager = mockManager;
            setServiceManager(mockManager);
            setServiceManagerReady(false);
          }
        }
      }
    };

    // Comprehensive cleanup function for service manager
    const cleanupServiceManager = async (manager: ServiceManager.IManager) => {
      if (!manager) return;

      try {
        // Step 1: Shutdown all running kernels first
        if (manager.kernels?.running) {
          const runningKernels = Array.from(
            manager.kernels.running()
          ) as Kernel.IModel[];

          for (const kernel of runningKernels) {
            try {
              const shutdownFn = (kernel as unknown as Record<string, unknown>)
                .shutdown;
              if (typeof shutdownFn === 'function') {
                await (shutdownFn as () => Promise<void>)();
              }
            } catch {
              // Kernel may already be shutdown on server - this is expected
            }
          }
        }

        // Step 2: Close all sessions
        if (manager.sessions?.running) {
          const runningSessions = Array.from(
            manager.sessions.running()
          ) as Kernel.IModel[];

          for (const session of runningSessions) {
            try {
              const shutdownFn = (session as unknown as Record<string, unknown>)
                .shutdown;
              if (typeof shutdownFn === 'function') {
                await (shutdownFn as () => Promise<void>)();
              }
            } catch {
              // Session shutdown failed
            }
          }
        }

        // Step 3: Now dispose the service manager itself
        if (typeof manager.dispose === 'function') {
          manager.dispose();
        }
      } catch (error) {
        // Log but don't throw - cleanup should be best-effort
        console.error(
          '[NotebookEditorSimple] Error during service manager cleanup:',
          error
        );
      }
    };

    createServiceManager();

    return () => {
      mounted = false;
      // Clean up current manager when effect reruns or component unmounts
      if (currentManager) {
        // Use async cleanup but don't await (cleanup function can't be async)
        cleanupServiceManager(currentManager).catch(err => {
          console.error(
            '[NotebookEditorSimple] Cleanup error in effect return:',
            err
          );
        });
      }
    };
  }, [runtimeInfo]);

  // Update Lumino widget when container resizes
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const newHeight = rect.height;
        if (newHeight > 0) {
          const notebookContainer = containerRef.current.querySelector(
            '#dla-Jupyter-Notebook'
          );
          const notebookBox =
            containerRef.current.querySelector('.dla-Box-Notebook');

          if (notebookContainer) {
            (notebookContainer as HTMLElement).style.height = `${newHeight}px`;
          }

          if (notebookBox) {
            (notebookBox as HTMLElement).style.height = `${newHeight}px`;
            (notebookBox as HTMLElement).style.maxHeight = `${newHeight}px`;
          }

          const notebook = notebookStore2.getState().notebooks.get(notebookId);
          if (notebook?.adapter?.panel) {
            notebook.adapter.panel.update();
          }
        }
      }
    };

    const initialTimer = setTimeout(updateHeight, 500);

    let resizeObserver: ResizeObserver | null = null;
    let debounceTimer: NodeJS.Timeout | null = null;

    const setupObserver = setTimeout(() => {
      if (containerRef.current) {
        resizeObserver = new ResizeObserver(entries => {
          if (debounceTimer) {
            clearTimeout(debounceTimer);
          }
          debounceTimer = setTimeout(() => {
            for (const entry of entries) {
              if (entry.contentRect.height > 0) {
                updateHeight();
              }
            }
          }, 50);
        });
        resizeObserver.observe(containerRef.current);
      }
    }, 600);

    window.addEventListener('resize', updateHeight);

    return () => {
      clearTimeout(initialTimer);
      clearTimeout(setupObserver);
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      window.removeEventListener('resize', updateHeight);
    };
  }, [notebookId]);

  // Generate unique key to force complete remount when runtime changes
  const notebookKey = useMemo(() => {
    return `notebook-${notebookId}-runtime-${runtimeInfo?.podName || 'mock'}`;
  }, [notebookId, runtimeInfo?.podName]);

  // Show loading state while service manager is being created
  if (!serviceManager) {
    return (
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <Box sx={{ flexShrink: 0 }}>
          <RuntimeToolbar
            runtimePodName={runtimeInfo?.podName}
            onRuntimeSelected={handleRuntimeSelected}
            leftContent={
              <NotebookControls
                notebookId={notebookId}
                runtimePodName={runtimeInfo?.podName}
              />
            }
          />
        </Box>
        <Box sx={{ p: 4, textAlign: 'center' }}>
          {runtimeInfo
            ? 'Connecting to runtime...'
            : 'Initializing notebook...'}
        </Box>
      </Box>
    );
  }

  // Render notebook with fresh service manager
  return (
    <Box
      sx={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      {/* Toolbar */}
      <Box sx={{ flexShrink: 0 }}>
        <RuntimeToolbar
          runtimePodName={runtimeInfo?.podName}
          onRuntimeSelected={handleRuntimeSelected}
          leftContent={
            <NotebookControls
              notebookId={notebookId}
              runtimePodName={runtimeInfo?.podName}
            />
          }
        />
      </Box>

      {/* Notebook - completely remounts when key changes */}
      <Box
        ref={containerRef}
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          minHeight: 0,
        }}
      >
        <Notebook2
          key={notebookKey}
          id={notebookId}
          height="100%"
          maxHeight="100%"
          serviceManager={serviceManager}
          collaborationProvider={collaborationProvider as unknown as never}
          readonly={false}
          cellSidebarMargin={120}
          startDefaultKernel={serviceManagerReady}
          extensions={[
            new CellSidebarExtension({ factory: CellSidebarButton }),
          ]}
        />
      </Box>
    </Box>
  );
};

export default NotebookEditor;
