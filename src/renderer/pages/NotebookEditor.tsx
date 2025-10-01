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
import {
  Notebook2,
  notebookStore2,
  CellSidebarExtension,
  CellSidebarButton,
} from '@datalayer/jupyter-react';
import { useCoreStore } from '@datalayer/core/lib/state';
import { createProxyServiceManager } from '../services/proxyServiceManager';
import { createMockServiceManager } from '../services/mockServiceManager';
import { ElectronCollaborationProvider } from '../services/electronCollaborationProvider';
import { Notebook2Toolbar } from '../components/Notebook2Toolbar';
import { useRuntimeStore } from '../stores/runtimeStore';

interface NotebookEditorProps {
  notebookId: string;
}

/**
 * Notebook editor that creates a fresh service manager when runtime changes.
 * Each runtime selection completely remounts the notebook component.
 */
const NotebookEditor: React.FC<NotebookEditorProps> = ({ notebookId }) => {
  const { configuration, setConfiguration } = useCoreStore();
  const { refreshRuntimes, allRuntimes } = useRuntimeStore();
  const [collaborationProvider, setCollaborationProvider] = useState<any>(null);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [runtimeInfo, setRuntimeInfo] = useState<{
    id: string;
    podName: string;
    ingress: string;
    token: string;
  } | null>(null);
  const [serviceManager, setServiceManager] = useState<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Refresh runtimes when notebook opens
  useEffect(() => {
    console.log('[NotebookEditorSimple] Refreshing runtimes on notebook open');
    refreshRuntimes();
  }, [refreshRuntimes]);

  // Watch for runtime expiration - clear runtime selection if current runtime disappears
  useEffect(() => {
    if (runtimeInfo) {
      const currentRuntimeExists = allRuntimes.some(
        r => (r.pod_name || r.podName) === runtimeInfo.podName
      );

      if (!currentRuntimeExists) {
        console.log(
          '[NotebookEditorSimple] Current runtime no longer exists (likely expired), clearing selection'
        );
        setRuntimeInfo(null);
      }
    }
  }, [allRuntimes, runtimeInfo]);

  // Handle runtime creation - set runtime info which will trigger service manager creation
  const handleRuntimeCreated = useCallback(
    async (runtime: {
      id: string;
      podName: string;
      ingress: string;
      token: string;
    }) => {
      console.log('[NotebookEditorSimple] Runtime created:', runtime.podName);
      setRuntimeInfo(runtime);
    },
    []
  );

  // Handle runtime selection - set runtime info which will trigger service manager creation
  const handleRuntimeSelected = useCallback(
    async (runtime: {
      id: string;
      podName: string;
      ingress: string;
      token: string;
    }) => {
      console.log('[NotebookEditorSimple] Runtime selected:', runtime.podName);
      setRuntimeInfo(runtime);
    },
    []
  );

  const handleRuntimeTerminated = useCallback(() => {
    console.log('[NotebookEditorSimple] Runtime terminated, clearing state');
    setRuntimeInfo(null);
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

    setCollaborationProvider(provider);

    return () => {
      if (provider && typeof provider.dispose === 'function') {
        provider.dispose();
      }
    };
  }, [configuration?.runUrl, authToken]);

  // Create service manager when runtime info changes
  useEffect(() => {
    let mounted = true;
    let currentManager: any = null;

    const createServiceManager = async () => {
      console.log(
        '[NotebookEditorSimple] Creating service manager for runtime:',
        runtimeInfo?.podName
      );

      // Immediately clear service manager to prevent race conditions
      // This ensures Notebook2 unmounts before we create a new manager
      setServiceManager(null);

      if (!runtimeInfo) {
        // No runtime - use mock service manager
        console.log(
          '[NotebookEditorSimple] No runtime, creating mock service manager'
        );
        const mockManager = createMockServiceManager();
        currentManager = mockManager;
        if (mounted) {
          setServiceManager(mockManager);
        }
      } else {
        // Runtime selected - create real service manager
        console.log(
          '[NotebookEditorSimple] Loading real service manager for:',
          runtimeInfo.ingress
        );
        try {
          const realManager = await createProxyServiceManager(
            runtimeInfo.ingress,
            runtimeInfo.token,
            runtimeInfo.id
          );
          currentManager = realManager;
          if (mounted) {
            console.log('[NotebookEditorSimple] Service manager ready');
            setServiceManager(realManager);
          } else {
            // Component unmounted, clean up immediately
            await cleanupServiceManager(realManager);
          }
        } catch (error) {
          console.error(
            '[NotebookEditorSimple] Failed to create service manager:',
            error
          );
          // Fallback to mock on error
          if (mounted) {
            const mockManager = createMockServiceManager();
            currentManager = mockManager;
            setServiceManager(mockManager);
          }
        }
      }
    };

    // Comprehensive cleanup function for service manager
    const cleanupServiceManager = async (manager: any) => {
      if (!manager) return;

      console.log(
        '[NotebookEditorSimple] Starting comprehensive service manager cleanup'
      );

      try {
        // Step 1: Shutdown all running kernels first
        if (manager.kernels?.running) {
          const runningKernels = Array.from(manager.kernels.running()) as any[];
          console.log(
            `[NotebookEditorSimple] Shutting down ${runningKernels.length} running kernels`
          );

          for (const kernel of runningKernels) {
            try {
              if (kernel?.shutdown && typeof kernel.shutdown === 'function') {
                await (kernel.shutdown as () => Promise<void>)();
                console.log(
                  `[NotebookEditorSimple] Kernel ${kernel.id} shutdown complete`
                );
              }
            } catch (kernelError) {
              // Kernel may already be shutdown on server - this is expected
              console.log(
                `[NotebookEditorSimple] Kernel shutdown skipped (already stopped):`,
                kernelError
              );
            }
          }
        }

        // Step 2: Close all sessions
        if (manager.sessions?.running) {
          const runningSessions = Array.from(
            manager.sessions.running()
          ) as any[];
          console.log(
            `[NotebookEditorSimple] Shutting down ${runningSessions.length} sessions`
          );

          for (const session of runningSessions) {
            try {
              if (session?.shutdown && typeof session.shutdown === 'function') {
                await (session.shutdown as () => Promise<void>)();
                console.log(
                  `[NotebookEditorSimple] Session ${session.id} shutdown complete`
                );
              }
            } catch (sessionError) {
              console.log(
                `[NotebookEditorSimple] Session shutdown skipped:`,
                sessionError
              );
            }
          }
        }

        // Step 3: Now dispose the service manager itself
        if (typeof manager.dispose === 'function') {
          console.log('[NotebookEditorSimple] Disposing service manager');
          manager.dispose();
        }

        console.log('[NotebookEditorSimple] Service manager cleanup complete');
      } catch (error) {
        // Log but don't throw - cleanup should be best-effort
        console.warn(
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
        console.log(
          '[NotebookEditorSimple] Effect cleanup - disposing service manager'
        );
        // Use async cleanup but don't await (cleanup function can't be async)
        cleanupServiceManager(currentManager).catch(err => {
          console.warn(
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
          <Notebook2Toolbar
            notebookId={notebookId}
            runtimePodName={runtimeInfo?.podName}
            onRuntimeCreated={handleRuntimeCreated}
            onRuntimeSelected={handleRuntimeSelected}
            onRuntimeTerminated={handleRuntimeTerminated}
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
        <Notebook2Toolbar
          notebookId={notebookId}
          runtimePodName={runtimeInfo?.podName}
          onRuntimeCreated={handleRuntimeCreated}
          onRuntimeSelected={handleRuntimeSelected}
          onRuntimeTerminated={handleRuntimeTerminated}
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
          collaborationProvider={collaborationProvider}
          readonly={false}
          cellSidebarMargin={120}
          startDefaultKernel={!!runtimeInfo}
          extensions={[
            new CellSidebarExtension({ factory: CellSidebarButton }),
          ]}
        />
      </Box>
    </Box>
  );
};

export default NotebookEditor;
