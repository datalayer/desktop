/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * @module renderer/components/document/LexicalEditor
 * @description Rich text editor component with Jupyter integration and collaboration support.
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Box, Text } from '@primer/react';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import {
  LoroCollaborationPlugin,
  createWebsocketProvider,
} from '@datalayer/lexical-loro';
import {
  JupyterCellPlugin,
  JupyterInputOutputPlugin,
} from '@datalayer/jupyter-lexical/lib/plugins';
import { useJupyter } from '@datalayer/jupyter-react';
import { useCoreStore } from '@datalayer/core/lib/state';
import { CustomLexicalEditorProps } from '../../../shared/types';
import { logger } from '../../utils/logger';
import EditorInitPlugin from './EditorInitPlugin';
import type { LexicalEditor as LexicalEditorType } from 'lexical';

/**
 * Lexical-based rich text editor component with Jupyter and collaboration features.
 * Supports code execution, real-time collaboration, and document editing.
 * @component
 * @param props - Component props
 * @param props.selectedDocument - The document being edited
 * @param props.collaborationEnabled - Whether collaboration is enabled
 * @param props.onCollaborationStatusChange - Callback for collaboration status changes
 * @param props.onEditorInit - Callback when editor is initialized
 * @param props.serviceManager - Jupyter service manager for code execution
 * @returns Rendered Lexical editor with plugins
 */
const LexicalEditor: React.FC<CustomLexicalEditorProps> = ({
  selectedDocument,
  collaborationEnabled,
  onCollaborationStatusChange,
  onEditorInit,
  serviceManager,
}) => {
  const { configuration } = useCoreStore();
  const { defaultKernel } = useJupyter();

  // Debug kernel availability
  logger.debug('CustomLexicalEditor kernel state:', {
    hasServiceManager: !!serviceManager,
    hasDefaultKernel: !!defaultKernel,
    kernelReady: defaultKernel?.ready,
    kernelId: defaultKernel?.id,
  });

  const [editorRef, setEditorRef] = useState<LexicalEditorType | null>(null);

  // Placeholder component
  const Placeholder = () => (
    <div
      style={{
        position: 'absolute',
        top: '16px',
        left: '16px',
        color: '#999',
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      Start writing your document...
    </div>
  );

  // Initialize editor and call onEditorInit when editor is ready
  const handleEditorRef = useCallback(
    (editor: LexicalEditorType | null) => {
      if (editor && editor !== editorRef) {
        setEditorRef(editor);
        onEditorInit(editor);
      }
    },
    [onEditorInit, editorRef]
  );

  const handleCollaborationInit = useCallback(
    (success: boolean) => {
      logger.debug('Loro collaboration initialization:', {
        success,
        documentId: selectedDocument.id,
      });
      if (!success) {
        onCollaborationStatusChange('error');
      } else {
        onCollaborationStatusChange('connected');
      }
    },
    [selectedDocument.id, onCollaborationStatusChange]
  );

  // Build WebSocket URL for collaboration
  const collaborationWebSocketUrl = useMemo(() => {
    if (!configuration?.spacerRunUrl) return '';

    // Convert http/https to ws/wss and build the path
    const wsUrl = `${configuration.spacerRunUrl.replace(/^http/, 'ws')}/api/spacer/v1/lexical/ws/${selectedDocument.id}`;
    return wsUrl;
  }, [configuration?.spacerRunUrl, selectedDocument.id]);

  return (
    <Box
      sx={{
        height: '100%',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box
        sx={{
          flex: 1,
          overflow: 'auto',
          position: 'relative',
          border: '1px solid',
          borderColor: 'border.default',
          borderRadius: 2,
          m: 2,
        }}
      >
        <RichTextPlugin
          contentEditable={
            <ContentEditable
              style={{
                minHeight: '200px',
                padding: '16px',
                outline: 'none',
                resize: 'none',
                fontSize: '14px',
                fontFamily:
                  'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                lineHeight: '1.5',
                position: 'relative',
              }}
              spellCheck={true}
            />
          }
          placeholder={<Placeholder />}
          ErrorBoundary={LexicalErrorBoundary}
        />

        {/* History Plugin for undo/redo */}
        <HistoryPlugin />

        {/* Jupyter Plugins - re-enabled */}
        {serviceManager && defaultKernel && (
          <>
            <JupyterCellPlugin />
            <JupyterInputOutputPlugin kernel={defaultKernel as any} />
          </>
        )}

        {/* Loro Collaboration Plugin - uses WebSocket provider */}
        {collaborationEnabled && collaborationWebSocketUrl && editorRef && (
          <LoroCollaborationPlugin
            id={selectedDocument.id}
            providerFactory={createWebsocketProvider}
            shouldBootstrap={true}
            websocketUrl={collaborationWebSocketUrl}
            onInitialization={handleCollaborationInit}
          />
        )}

        {/* Editor initialization */}
        <EditorInitPlugin onEditorInit={handleEditorRef} />
      </Box>

      {/* Editor Status Bar */}
      <Box
        sx={{
          borderTop: '1px solid',
          borderColor: 'border.default',
          p: 2,
          fontSize: 1,
          color: 'fg.muted',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Text>Ready to edit • Press Ctrl+Z to undo • Press Ctrl+Y to redo</Text>
        {serviceManager && (
          <Text sx={{ color: 'success.fg' }}>✓ Jupyter kernel ready</Text>
        )}
      </Box>
    </Box>
  );
};

export default LexicalEditor;
