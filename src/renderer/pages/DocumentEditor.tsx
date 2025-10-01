/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Document editor with Lexical and Jupyter cells.
 * Completely remounts when runtime is selected/changed.
 *
 * @module renderer/pages/DocumentEditor
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Box } from '@primer/react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListNode, ListItemNode } from '@lexical/list';
import { CodeNode, CodeHighlightNode } from '@lexical/code';
import { LinkNode } from '@lexical/link';
import { LoroCollaborationPlugin } from '@datalayer/lexical-loro';
import { createWebsocketProvider } from '@datalayer/lexical-loro';
import { Jupyter, useJupyter } from '@datalayer/jupyter-react';
import {
  ComponentPickerMenuPlugin,
  JupyterInputOutputPlugin,
  DraggableBlockPlugin,
  JupyterInputNode,
  JupyterInputHighlightNode,
  JupyterOutputNode,
} from '@datalayer/jupyter-lexical';
import type { EditorState } from 'lexical';
import { createProxyServiceManager } from '../services/proxyServiceManager';
import { createMockServiceManager } from '../services/mockServiceManager';
import { Notebook2Toolbar } from '../components/notebook/Toolbar';
import { useRuntimeStore } from '../stores/runtimeStore';
import { DocumentViewProps } from '../../shared/types';

/**
 * Document editor that creates a fresh service manager when runtime changes.
 * Each runtime selection completely remounts the editor component.
 */
const DocumentEditor: React.FC<DocumentViewProps> = ({ selectedDocument }) => {
  const { refreshRuntimes, allRuntimes } = useRuntimeStore();
  const [runtimeInfo, setRuntimeInfo] = useState<{
    id: string;
    podName: string;
    ingress: string;
    token: string;
  } | null>(null);
  const [serviceManager, setServiceManager] = useState<any>(null);
  const [spacerUrl, setSpacerUrl] = useState<string>('');

  const documentId = selectedDocument?.id || '';

  // Get spacer URL
  useEffect(() => {
    // TODO: Implement getSpacerUrl method
    // For now, use hardcoded value
    setSpacerUrl('https://run.datalayer.io');
  }, []);

  // Refresh runtimes when document opens
  useEffect(() => {
    refreshRuntimes();
  }, [refreshRuntimes]);

  // Watch for runtime expiration
  useEffect(() => {
    if (runtimeInfo) {
      const currentRuntimeExists = allRuntimes.some(
        r => (r.pod_name || r.podName) === runtimeInfo.podName
      );

      if (!currentRuntimeExists) {
        setRuntimeInfo(null);
      }
    }
  }, [allRuntimes, runtimeInfo]);

  // Handle runtime creation
  const handleRuntimeCreated = useCallback(
    async (runtime: {
      id: string;
      podName: string;
      ingress: string;
      token: string;
    }) => {
      setRuntimeInfo(runtime);
    },
    []
  );

  // Handle runtime selection
  const handleRuntimeSelected = useCallback(
    async (runtime: {
      id: string;
      podName: string;
      ingress: string;
      token: string;
    }) => {
      setRuntimeInfo(runtime);
    },
    []
  );

  const handleRuntimeTerminated = useCallback(() => {
    setRuntimeInfo(null);
  }, []);

  // Create service manager when runtime info changes
  useEffect(() => {
    let mounted = true;
    let currentManager: any = null;

    const createServiceManager = async () => {
      // Clear service manager first
      setServiceManager(null);

      if (!runtimeInfo) {
        // No runtime - use mock service manager
        const mockManager = createMockServiceManager();
        currentManager = mockManager;
        if (mounted) {
          setServiceManager(mockManager);
        }
      } else {
        // Runtime selected - create real service manager
        try {
          const realManager = await createProxyServiceManager(
            runtimeInfo.ingress,
            runtimeInfo.token,
            runtimeInfo.id
          );
          currentManager = realManager;
          if (mounted) {
            setServiceManager(realManager);
          }
        } catch (error) {
          console.error(
            '[DocumentEditor] Failed to create service manager:',
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

    createServiceManager();

    return () => {
      mounted = false;
      if (currentManager) {
        // Cleanup service manager if needed
      }
    };
  }, [runtimeInfo]);

  // Build WebSocket URL for collaboration
  const collaborationWebSocketUrl = useMemo(() => {
    if (!spacerUrl) return null;
    return `${spacerUrl.replace(/^http/, 'ws')}/api/spacer/v1/lexical/ws`;
  }, [spacerUrl]);

  // Lexical editor configuration
  const editorConfig = {
    namespace: 'DocumentEditor',
    theme: {},
    nodes: [
      HeadingNode,
      QuoteNode,
      ListNode,
      ListItemNode,
      CodeNode,
      CodeHighlightNode,
      LinkNode,
      JupyterInputNode,
      JupyterInputHighlightNode,
      JupyterOutputNode,
    ],
    editable: true,
    onError: (err: Error) => {
      console.error('Lexical editor error:', err);
    },
  };

  const handleChange = (_editorState: EditorState) => {
    // Handle editor changes if needed
  };

  const handleInitialization = () => {
    // Lexical editor initialized
  };

  // Generate unique key to force complete remount when runtime changes
  const editorKey = useMemo(() => {
    return `document-${documentId}-runtime-${runtimeInfo?.podName || 'mock'}`;
  }, [documentId, runtimeInfo?.podName]);

  // Handle no document selected
  if (!selectedDocument) {
    return <Box sx={{ p: 4, textAlign: 'center' }}>No document selected</Box>;
  }

  // Show loading state while service manager is being created
  if (!serviceManager || !collaborationWebSocketUrl) {
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
            showNotebookControls={false}
            runtimePodName={runtimeInfo?.podName}
            onRuntimeCreated={handleRuntimeCreated}
            onRuntimeSelected={handleRuntimeSelected}
            onRuntimeTerminated={handleRuntimeTerminated}
          />
        </Box>
        <Box sx={{ p: 4, textAlign: 'center' }}>
          {runtimeInfo ? 'Connecting to runtime...' : 'Initializing editor...'}
        </Box>
      </Box>
    );
  }

  // Render editor with fresh service manager
  return (
    <Jupyter serviceManager={serviceManager} startDefaultKernel={!!runtimeInfo}>
      <DocumentEditorInner
        documentId={documentId}
        editorKey={editorKey}
        editorConfig={editorConfig}
        collaborationWebSocketUrl={collaborationWebSocketUrl}
        runtimeInfo={runtimeInfo}
        handleChange={handleChange}
        handleInitialization={handleInitialization}
        handleRuntimeCreated={handleRuntimeCreated}
        handleRuntimeSelected={handleRuntimeSelected}
        handleRuntimeTerminated={handleRuntimeTerminated}
      />
    </Jupyter>
  );
};

/**
 * Inner component that has access to Jupyter context (kernel)
 */
const DocumentEditorInner: React.FC<{
  documentId: string;
  editorKey: string;
  editorConfig: any;
  collaborationWebSocketUrl: string;
  runtimeInfo: {
    id: string;
    podName: string;
    ingress: string;
    token: string;
  } | null;
  handleChange: (editorState: EditorState) => void;
  handleInitialization: (isInitialized: boolean) => void;
  handleRuntimeCreated: (runtime: {
    id: string;
    podName: string;
    ingress: string;
    token: string;
  }) => void;
  handleRuntimeSelected: (runtime: {
    id: string;
    podName: string;
    ingress: string;
    token: string;
  }) => void;
  handleRuntimeTerminated: () => void;
}> = ({
  documentId,
  editorKey,
  editorConfig,
  collaborationWebSocketUrl,
  runtimeInfo,
  handleChange,
  handleInitialization,
  handleRuntimeCreated,
  handleRuntimeSelected,
  handleRuntimeTerminated,
}) => {
  const { defaultKernel } = useJupyter();
  const [floatingAnchorElem, setFloatingAnchorElem] =
    useState<HTMLDivElement | null>(null);

  const onRef = (_floatingAnchorElem: HTMLDivElement) => {
    if (_floatingAnchorElem !== null) {
      setFloatingAnchorElem(_floatingAnchorElem);
    }
  };

  // Kernel availability check removed to prevent Symbol serialization errors in production

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
          showNotebookControls={false}
          runtimePodName={runtimeInfo?.podName}
          onRuntimeCreated={handleRuntimeCreated}
          onRuntimeSelected={handleRuntimeSelected}
          onRuntimeTerminated={handleRuntimeTerminated}
        />
      </Box>

      {/* Editor - completely remounts when key changes */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          minHeight: 0,
          overflow: 'auto',
        }}
      >
        <LexicalComposer key={editorKey} initialConfig={editorConfig}>
          <div
            ref={onRef}
            style={{
              position: 'relative',
              flex: 1,
              overflow: 'auto',
            }}
          >
            <RichTextPlugin
              contentEditable={
                <ContentEditable
                  style={{
                    minHeight: '100%',
                    outline: 'none',
                    padding: '16px',
                    fontSize: '14px',
                    lineHeight: '1.6',
                    fontFamily:
                      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                  }}
                />
              }
              placeholder={
                <Box
                  sx={{
                    position: 'absolute',
                    top: '16px',
                    left: '16px',
                    color: 'fg.muted',
                    pointerEvents: 'none',
                    fontSize: 1,
                  }}
                >
                  Type / for commands...
                </Box>
              }
              ErrorBoundary={LexicalErrorBoundary}
            />
            <HistoryPlugin />
            <OnChangePlugin onChange={handleChange} />
            <ComponentPickerMenuPlugin kernel={defaultKernel} />
            <JupyterInputOutputPlugin kernel={defaultKernel} />
            {floatingAnchorElem && (
              <DraggableBlockPlugin anchorElem={floatingAnchorElem} />
            )}
            <LoroCollaborationPlugin
              id={documentId}
              shouldBootstrap={true}
              providerFactory={createWebsocketProvider}
              websocketUrl={collaborationWebSocketUrl}
              showCollaborators={true}
              onInitialization={handleInitialization}
            />
          </div>
        </LexicalComposer>
      </Box>
    </Box>
  );
};

export default DocumentEditor;
