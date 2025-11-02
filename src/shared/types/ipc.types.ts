/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * IPC communication types for Electron main-renderer bridge.
 * Re-exports SDK types and adds desktop-specific interfaces.
 *
 * @module types/ipc
 */

// Re-export all SDK JSON types for convenience
export type {
  RuntimeJSON,
  EnvironmentJSON,
  NotebookJSON,
  LexicalJSON,
  SpaceJSON,
} from '@datalayer/core/lib/models';
export type { UserJSON } from '@datalayer/core/lib/models/User3';

import type { UserJSON } from '@datalayer/core/lib/models/User3';

/**
 * Authentication state shared between main and renderer processes.
 */
export interface AuthState {
  isAuthenticated: boolean;
  user: UserJSON | null;
  token: string | null;
  runUrl: string;
}

/**
 * Serialized data that can be safely sent over IPC.
 * SDK models handle serialization via toJSON(), so this is just unknown.
 */
export type SerializedData = unknown;
