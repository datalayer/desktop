/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Type definitions for the Lexical document editor.
 *
 * @module shared/types/document
 */

import type { LexicalEditor } from 'lexical';
import type { ServiceManager } from '@jupyterlab/services';
import type { RuntimeJSON } from '@datalayer/core/lib/client/models';

/**
 * Document data structure for Lexical documents.
 */
export interface DocumentData {
  id: string;
  name: string;
  path: string;
  cdnUrl?: string;
  description?: string;
}

// Document view props
export interface DocumentViewProps {
  selectedDocument: DocumentData;
  onClose: () => void;
}

// Collaboration status type
export type CollaborationStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

// Custom Lexical Editor props
export interface CustomLexicalEditorProps {
  selectedDocument: DocumentData;
  collaborationEnabled: boolean;
  collaborationStatus: CollaborationStatus;
  onCollaborationStatusChange: (status: CollaborationStatus) => void;
  onEditorInit: (editor: LexicalEditor) => void;
  serviceManager?: ServiceManager.IManager;
}

// Editor Init Plugin props
export interface EditorInitPluginProps {
  onEditorInit: (editor: LexicalEditor) => void;
}

// Document Header props
export interface DocumentHeaderProps {
  selectedDocument: DocumentData;
  serviceManager: ServiceManager.IManager | null;
  documentRuntime: RuntimeJSON | null;
  isTerminatingRuntime: boolean;
  collaborationEnabled: boolean;
  collaborationStatus: CollaborationStatus;
  runtimeError: string | null;
  onStopRuntime: () => void;
  onToggleCollaboration: () => void;
}

// Terminate Runtime Dialog props
export interface DocumentTerminateDialogProps {
  isOpen: boolean;
  isTerminating: boolean;
  runtimeName?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

// Loading State props
export interface DocumentLoadingStateProps {
  isCreatingRuntime: boolean;
  loading: boolean;
  serviceManager: ServiceManager.IManager | null;
}

// Error State props
export interface DocumentErrorStateProps {
  error: string | null;
  runtimeError: string | null;
}
