/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Real-time collaboration service for Lexical documents in Desktop app.
 * Configures WebSocket connections and user sessions for collaborative editing.
 *
 * @module renderer/services/lexicalCollaboration
 */

import type { LexicalJSON } from '@datalayer/core/lib/models';

/**
 * Configuration for lexical document collaboration.
 */
export interface LexicalCollaborationConfig {
  enabled: boolean;
  websocketUrl: string;
  documentId: string;
  sessionId: string;
  username: string;
  userColor: string;
  token?: string;
}

/**
 * Service for setting up lexical document collaboration in Desktop.
 * Manages WebSocket configuration and user session for real-time editing.
 */
export class LexicalCollaborationService {
  private static instance: LexicalCollaborationService;

  static getInstance(): LexicalCollaborationService {
    if (!LexicalCollaborationService.instance) {
      LexicalCollaborationService.instance = new LexicalCollaborationService();
    }
    return LexicalCollaborationService.instance;
  }

  private constructor() {}

  /**
   * Sets up collaboration configuration for a Datalayer lexical document.
   * Creates WebSocket URL and user session for real-time editing.
   *
   * @param document - Lexical document metadata
   * @returns Collaboration configuration or undefined if setup fails
   */
  async setupCollaboration(
    document:
      | LexicalJSON
      | ({ id: string; uid?: string } & Record<string, unknown>)
  ): Promise<LexicalCollaborationConfig | undefined> {
    // Support both DocumentData (with id) and LexicalJSON (with uid)
    const documentId =
      document.uid || ('id' in document ? document.id : undefined);
    if (!documentId) {
      console.error('[LexicalCollaboration] Document missing UID or ID');
      return undefined;
    }

    try {
      // Get auth state from bridge
      const authState = await window.datalayerClient.getAuthState();

      if (!authState.isAuthenticated) {
        console.error('[LexicalCollaboration] User not authenticated');
        return undefined;
      }

      // Get spacer URL from configuration
      // @ts-expect-error - getSpacerRunUrl exists but TypeScript cache is stale
      const spacerUrl = await window.datalayerClient.getSpacerRunUrl();

      if (!spacerUrl) {
        console.error('[LexicalCollaboration] Spacer URL not configured');
        return undefined;
      }

      // Get authentication token
      const token = authState.token || '';

      // Build websocket URL using document ID
      // Pattern: wss://{spacerUrl}/api/spacer/v1/lexical/ws/{documentId}
      // Note: singular "lexical", matching VS Code extension implementation
      // Token will be passed via WebSocket headers by the Main Process adapter
      const websocketUrl = `${spacerUrl.replace(/^http/, 'ws')}/api/spacer/v1/lexical/ws/${documentId}`;

      // Extract username from auth state
      const user = authState.user as {
        displayName?: string;
        handle?: string;
        email?: string;
        firstName?: string;
        lastName?: string;
      } | null;

      // Build username: prefer full name, fallback to handle/email
      let baseUsername = 'Anonymous';
      if (user?.firstName || user?.lastName) {
        baseUsername = [user.firstName, user.lastName]
          .filter(Boolean)
          .join(' ');
      } else if (user?.displayName) {
        baseUsername = user.displayName;
      } else if (user?.handle) {
        baseUsername = user.handle;
      } else if (user?.email) {
        baseUsername = user.email;
      }

      const username = `${baseUsername} (Desktop)`;

      return {
        enabled: true,
        websocketUrl,
        documentId,
        sessionId: documentId, // Use document ID as session ID
        username,
        userColor: this.generateUserColor(),
        token,
      };
    } catch (error) {
      console.error(
        '[LexicalCollaboration] Failed to setup collaboration:',
        error
      );
      return undefined;
    }
  }

  /**
   * Generates a random hex color for user identification.
   *
   * @returns Random hex color string
   */
  private generateUserColor(): string {
    return '#' + Math.floor(Math.random() * 16777215).toString(16);
  }
}
