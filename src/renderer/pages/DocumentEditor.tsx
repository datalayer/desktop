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

import React, { useState, useEffect } from 'react';
import { Box } from '@primer/react';
import { Jupyter } from '@datalayer/jupyter-react';
import { DocumentViewProps } from '../../shared/types';
import { useService } from '../contexts/ServiceContext';
import type { Runtime } from '../services/interfaces/IRuntimeService';
import { LexicalEditor } from '../components/lexical/LexicalEditor';
import {
  LexicalCollaborationService,
  type LexicalCollaborationConfig,
} from '../services/lexicalCollaboration';
import { createProxyServiceManager } from '../services/proxyServiceManager';
import { createMockServiceManager } from '../services/mockServiceManager';
import type { ServiceManager } from '@jupyterlab/services';

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
          setServiceManager(null);
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

  // Create service manager when runtime is selected
  useEffect(() => {
    if (!runtimeInfo) {
      setServiceManager(null);
      return;
    }

    const createServiceManager = async () => {
      try {
        const wsUrl = `${runtimeInfo.ingress}/api/kernels`;
        const manager = await createProxyServiceManager(
          wsUrl,
          runtimeInfo.token
        );
        setServiceManager(manager);
      } catch (error) {
        console.error(
          '[DocumentEditor] Failed to create service manager:',
          error
        );
        // Fall back to mock service manager
        const mockManager = createMockServiceManager();
        setServiceManager(mockManager);
      }
    };

    createServiceManager();

    return () => {
      if (serviceManager) {
        serviceManager.dispose();
      }
    };
  }, [runtimeInfo?.id]);

  // Runtime event handlers
  const handleRuntimeSelected = (runtime: Runtime | null) => {
    if (!runtime) {
      console.log('[DocumentEditor] Creating new runtime...');
      return;
    }
    console.log('[DocumentEditor] Runtime selected:', runtime.podName);
    setRuntimeInfo({
      id: runtime.uid,
      podName: runtime.podName,
      ingress: runtime.ingress,
      token: runtime.token,
    });
  };

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Jupyter context wrapper */}
      <Jupyter
        collaborative={false}
        terminals={false}
        serviceManager={serviceManager || undefined}
      >
        {/* Lexical Editor with integrated runtime selector */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <LexicalEditor
            collaboration={collaborationConfig || undefined}
            editable={true}
            showRuntimeSelector={true}
            runtimePodName={runtimeInfo?.podName}
            onRuntimeSelected={handleRuntimeSelected}
          />
        </Box>
      </Jupyter>
    </Box>
  );
};

export default DocumentEditor;
