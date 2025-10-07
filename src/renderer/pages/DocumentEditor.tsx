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
import type { RuntimeJSON } from '@datalayer/core/lib/client/models';
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
  const [allRuntimes, setAllRuntimes] = useState<RuntimeJSON[]>([]);
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

  // Initialize runtime service and fetch runtimes
  useEffect(() => {
    const init = async () => {
      if (!runtimeService) return;

      if (runtimeService.state === 'uninitialized') {
        await runtimeService.initialize();
      }

      const runtimes = await runtimeService.refreshAllRuntimes();
      setAllRuntimes(runtimes as unknown as RuntimeJSON[]);
    };

    init();
  }, [runtimeService]);

  // Watch for runtime expiration
  useEffect(() => {
    if (runtimeInfo) {
      const currentRuntimeExists = allRuntimes.some(
        r => r.podName === runtimeInfo.podName
      );

      if (!currentRuntimeExists) {
        console.log('[DocumentEditor] Runtime expired, clearing selection');
        setRuntimeInfo(null);
        setServiceManager(null);
      }
    }
  }, [allRuntimes, runtimeInfo]);

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
    console.log(
      '[DocumentEditor] Runtime selected:',
      runtime.pod_name || runtime.podName
    );
    setRuntimeInfo({
      id: (runtime.id || runtime.uid) as string,
      podName: (runtime.pod_name || runtime.podName) as string,
      ingress: (runtime.ingress || runtime.ingressUrl) as string,
      token: (runtime.token || runtime.authToken) as string,
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
