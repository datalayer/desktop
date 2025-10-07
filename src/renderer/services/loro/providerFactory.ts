/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Factory for creating Desktop Loro providers.
 * Provides a consistent interface for creating collaboration providers.
 *
 * @module renderer/services/loro/providerFactory
 */

import { LoroDoc } from 'loro-crdt';
import type { Provider } from '@datalayer/lexical-loro';
import { DesktopLoroProvider } from './loroProvider';

/**
 * Global state storage for the current collaboration session.
 * This is a workaround since LoroCollaborationPlugin doesn't support passing these directly.
 */
let currentAuthToken: string = '';
let currentUsername: string = 'Anonymous';
let currentUserColor: string = '#808080';

/**
 * Set the authentication token for collaboration.
 * Must be called before creating providers.
 */
export function setCollaborationToken(token: string): void {
  currentAuthToken = token;
}

/**
 * Set the user info (username and color) for collaboration.
 * Must be called before creating providers.
 */
export function setCollaborationUser(username: string, color: string): void {
  currentUsername = username;
  currentUserColor = color;
}

/**
 * Creates a Desktop Loro provider for collaborative editing.
 * This factory matches the signature expected by LoroCollaborationPlugin:
 * (id: string, docMap: Map<string, LoroDoc>, websocketUrl?: string) => Provider
 *
 * @param id - Unique identifier for this provider (usually document ID)
 * @param docMap - Map of document IDs to LoroDoc instances (managed by plugin)
 * @param websocketUrl - WebSocket server URL
 * @returns Provider instance for managing collaboration
 */
export function createDesktopLoroProvider(
  id: string,
  docMap: Map<string, LoroDoc>,
  websocketUrl?: string
): Provider {
  console.log('[ProviderFactory] Creating Desktop Loro provider:', {
    id,
    websocketUrl,
    existingDoc: docMap.has(id),
    hasToken: !!currentAuthToken,
  });

  // Get or create LoroDoc for this ID (plugin manages the docMap)
  let doc = docMap.get(id);
  if (doc === undefined) {
    doc = new LoroDoc();
    docMap.set(id, doc);
    console.log('[ProviderFactory] Created new LoroDoc for ID:', id);
  }

  // Generate adapter ID with 'loro-' prefix
  const adapterId = `loro-${id}`;

  // Use global username and color (set by LexicalEditor before provider creation)
  const username = currentUsername;
  const userColor = currentUserColor;

  console.log('[ProviderFactory] Creating DesktopLoroProvider:', {
    adapterId,
    docPeerId: doc.peerId,
    websocketUrl,
    username,
    userColor,
    tokenLength: currentAuthToken.length,
  });

  return new DesktopLoroProvider(
    adapterId,
    doc,
    username,
    userColor,
    websocketUrl,
    currentAuthToken
  );
}
