/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Document editor with Lexical and runtime support.
 * Uses new LexicalEditor component with toolbar and Desktop Loro provider.
 *
 * @module renderer/pages/DocumentEditor
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box } from '@primer/react';
import { DocumentViewProps } from '../../shared/types';
import { useService } from '../contexts/ServiceContext';
import type { Runtime } from '../services/interfaces/IRuntimeService';
import type { ServiceManager, Kernel } from '@jupyterlab/services';
import { LexicalEditor } from '../components/lexical/LexicalEditor';
import {
  LexicalCollaborationService,
  type LexicalCollaborationConfig,
} from '../services/lexicalCollaboration';
import { createProxyServiceManager } from '../services/proxyServiceManager';
import { createMockServiceManager } from '../services/mockServiceManager';

/**
 * Document editor that creates a fresh service manager when runtime changes.
 * Each runtime selection completely remounts the editor component.
 */
const DocumentEditor: React.FC<DocumentViewProps> = ({ selectedDocument }) => {
  const runtimeService = useService('runtimeService');
  const [runtimeInfo, setRuntimeInfo] = useState<{
    id: string;
    podName: string;
    ingress: string;
    token: string;
  } | null>(null);
  const [serviceManager, setServiceManager] =
    useState<ServiceManager.IManager | null>(null);
  const [collaborationConfig, setCollaborationConfig] =
    useState<LexicalCollaborationConfig | null>(null);

  // Initialize runtime service
  useEffect(() => {
    const init = async () => {
      if (!runtimeService) return;

      if (runtimeService.state === 'uninitialized') {
        await runtimeService.initialize();
      }
    };

    init();
  }, [runtimeService]);

  // Listen for global runtime expiration events
  useEffect(() => {
    if (!runtimeService) return;

    const unsubscribe = runtimeService.onRuntimeExpired(expiredPodName => {
      console.log('[DocumentEditor] Runtime expired globally:', expiredPodName);

      // Check current runtime using setState callback to avoid dependency
      setRuntimeInfo(current => {
        if (current?.podName === expiredPodName) {
          console.log(
            '[DocumentEditor] Current runtime expired, switching to mock'
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

  // Setup collaboration
  useEffect(() => {
    const setup = async () => {
      if (!selectedDocument) return;

      try {
        const collabService = LexicalCollaborationService.getInstance();
        // Setup collaboration with document (supports both DocumentData and LexicalJSON)
        const config = await collabService.setupCollaboration(selectedDocument);
        setCollaborationConfig(config || null);
      } catch (err) {
        console.error('[DocumentEditor] Collaboration setup error:', err);
      }
    };

    setup();
  }, [selectedDocument]);

  // Create service manager when runtime info changes
  useEffect(() => {
    let mounted = true;
    let currentManager: ServiceManager.IManager | null = null;

    const createServiceManager = async () => {
      // Immediately clear service manager to prevent race conditions
      setServiceManager(null);

      if (!runtimeInfo) {
        // No runtime - use mock service manager
        console.log(
          '[DocumentEditor] No runtime info, using mock service manager'
        );
        const mockManager = createMockServiceManager();
        currentManager = mockManager;
        if (mounted) {
          setServiceManager(mockManager);
        }
      } else {
        // Runtime selected - create real service manager
        console.log('[DocumentEditor] Creating real service manager with:', {
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
            '[DocumentEditor] Real service manager created successfully'
          );
          currentManager = realManager;
          if (mounted) {
            setServiceManager(realManager);
          } else {
            // Component unmounted, clean up immediately
            await cleanupServiceManager(realManager);
          }
        } catch (error) {
          console.error(
            '[DocumentEditor] Failed to create service manager:',
            error
          );
          // Fallback to mock on error
          if (mounted) {
            console.log(
              '[DocumentEditor] Falling back to mock service manager'
            );
            const mockManager = createMockServiceManager();
            currentManager = mockManager;
            setServiceManager(mockManager);
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
          '[DocumentEditor] Error during service manager cleanup:',
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
            '[DocumentEditor] Cleanup error in effect return:',
            err
          );
        });
      }
    };
  }, [runtimeInfo]);

  // Handle runtime selection - set runtime info which will trigger service manager creation
  const handleRuntimeSelected = useCallback(async (runtime: Runtime | null) => {
    if (!runtime) {
      console.log('[DocumentEditor] Clearing runtime');
      setRuntimeInfo(null);
      return;
    }

    console.log('[DocumentEditor] Runtime selected:', runtime);
    const info = {
      id: runtime.uid,
      podName: runtime.podName,
      ingress: runtime.ingress,
      token: runtime.token,
    };
    console.log('[DocumentEditor] Setting runtime info:', info);
    setRuntimeInfo(info);
  }, []);

  // Generate unique key to force complete remount when runtime changes
  const editorKey = useMemo(() => {
    return `lexical-${selectedDocument?.uid || 'new'}-runtime-${runtimeInfo?.podName || 'mock'}`;
  }, [selectedDocument?.uid, runtimeInfo?.podName]);

  // Show loading state while service manager is being created
  if (!serviceManager) {
    return (
      <Box
        sx={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <Box sx={{ p: 4, textAlign: 'center' }}>
          {runtimeInfo ? 'Connecting to runtime...' : 'Initializing editor...'}
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Lexical Editor with toolbar - completely remounts when key changes */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <LexicalEditor
          key={editorKey}
          collaboration={collaborationConfig || undefined}
          editable={true}
          runtimePodName={runtimeInfo?.podName}
          onRuntimeSelected={handleRuntimeSelected}
        />
      </Box>
    </Box>
  );
};

export default DocumentEditor;
