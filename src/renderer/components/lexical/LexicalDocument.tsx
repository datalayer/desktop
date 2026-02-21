/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Lexical document editor component with real-time Loro collaboration.
 *
 * @module renderer/components/lexical/LexicalDocument
 */

import React, { useState, useEffect, useRef } from 'react';
import { Box, Text, Spinner } from '@primer/react';
import type { LexicalJSON } from '@datalayer/core/lib/models';
import {
  LexicalCollaborationService,
  type LexicalCollaborationConfig,
} from '../../services/lexicalCollaboration';
import { LexicalEditor } from './LexicalEditor';

interface LexicalDocumentProps {
  document: LexicalJSON;
  onClose?: () => void;
}

/**
 * Lexical document editor with Loro CRDT collaboration.
 * Connects to Main Process via window.loroAPI for WebSocket proxying.
 */
export const LexicalDocument: React.FC<LexicalDocumentProps> = ({
  document,
  onClose,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [collaborationStatus, setCollaborationStatus] = useState<
    'disconnected' | 'connecting' | 'connected' | 'error'
  >('disconnected');
  const [collaborationConfig, setCollaborationConfig] =
    useState<LexicalCollaborationConfig | null>(null);

  const adapterIdRef = useRef<string>(`loro-adapter-${Date.now()}`);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const setup = async () => {
      try {
        // Setup collaboration configuration
        const collabService = LexicalCollaborationService.getInstance();
        const config = await collabService.setupCollaboration(document);

        if (!config) {
          setError('Failed to setup collaboration');
          setLoading(false);
          return;
        }

        setCollaborationConfig(config);

        // Setup Loro adapter event listener
        const handleAdapterEvent = (event: unknown) => {
          const evt = event as {
            type: string;
            adapterId: string;
            data?: { status?: string; message?: string };
          };

          if (evt.adapterId !== adapterIdRef.current) {
            return;
          }

          switch (evt.type) {
            case 'status':
              if (evt.data?.status === 'connected') {
                setCollaborationStatus('connected');
              } else if (evt.data?.status === 'disconnected') {
                setCollaborationStatus('disconnected');
              }
              break;

            case 'error':
              console.error(
                '[LexicalDocument] Adapter error:',
                evt.data?.message
              );
              setCollaborationStatus('error');
              break;

            case 'message':
              // Handle Loro update messages here
              // This is where you'd apply CRDT updates to the editor
              console.log('[LexicalDocument] Received Loro update');
              break;
          }
        };

        window.loroAPI.onAdapterEvent(handleAdapterEvent);

        // Connect to collaboration server
        setCollaborationStatus('connecting');
        await window.loroAPI.connect(config.websocketUrl, adapterIdRef.current);

        // Cleanup function
        cleanupRef.current = () => {
          window.loroAPI.disconnect(adapterIdRef.current);
          window.loroAPI.removeEventListener();
        };

        setLoading(false);
      } catch (err) {
        console.error('[LexicalDocument] Setup error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setLoading(false);
      }
    };

    setup();

    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, [document]);

  if (loading) {
    return (
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          flexDirection: 'column',
          gap: 3,
        }}
      >
        <Spinner size="large" />
        <Text>Loading Lexical document...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box
        sx={{
          p: 4,
          textAlign: 'center',
        }}
      >
        <Text sx={{ color: 'danger.fg', fontSize: 2, mb: 2 }}>
          Error loading document
        </Text>
        <Text sx={{ color: 'fg.muted' }}>{error}</Text>
        {onClose && (
          <Text
            sx={{
              color: 'accent.fg',
              cursor: 'pointer',
              mt: 3,
              textDecoration: 'underline',
            }}
            onClick={onClose}
          >
            Close
          </Text>
        )}
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header with collaboration status */}
      <Box
        sx={{
          p: 3,
          borderBottom: '1px solid',
          borderColor: 'border.default',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <Box>
          <Text sx={{ fontSize: 2, fontWeight: 'semibold' }}>
            {document.name}
          </Text>
          {collaborationConfig && (
            <Text sx={{ fontSize: 1, color: 'fg.muted', mt: 1 }}>
              Editing as {collaborationConfig.username}
            </Text>
          )}
        </Box>

        <Box sx={{ display: 'flex', gap: 3, alignItems: 'center' }}>
          {/* Collaboration status indicator */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor:
                  collaborationStatus === 'connected'
                    ? 'success.fg'
                    : collaborationStatus === 'connecting'
                      ? 'attention.fg'
                      : 'danger.fg',
              }}
            />
            <Text sx={{ fontSize: 1, color: 'fg.muted' }}>
              {collaborationStatus === 'connected'
                ? 'Connected'
                : collaborationStatus === 'connecting'
                  ? 'Connecting...'
                  : collaborationStatus === 'error'
                    ? 'Error'
                    : 'Disconnected'}
            </Text>
          </Box>

          {onClose && (
            <Text
              sx={{
                color: 'accent.fg',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
              onClick={onClose}
            >
              Close
            </Text>
          )}
        </Box>
      </Box>

      {/* Lexical Editor with Loro collaboration */}
      <Box
        sx={{
          flex: 1,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <LexicalEditor
          editable={true}
          collaboration={collaborationConfig || undefined}
        />
      </Box>
    </Box>
  );
};

export default LexicalDocument;
