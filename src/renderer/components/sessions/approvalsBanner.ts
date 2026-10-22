/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Waiting for you, in the chat (DESKTOP DK-13, the banner's rules): which
 * of the approvals the main process holds — read from either place, one
 * websocket per local runtime, ai-agents polled — belong in the banner of
 * the chat in front (its place's and its agent's), as `<Chat
 * pendingApprovals>` takes them; the count of what waits across the
 * places; and what a decision came to, as the place answered it (done,
 * answered elsewhere on a 409, gone on a 404), shown as the main process
 * said it, never reworded.
 *
 * Pure: no React, no `window`.
 *
 * @module renderer/components/sessions/approvalsBanner
 */

import type { PendingApproval as ChatPendingApproval } from '@datalayer/agent-runtimes/lib/chat/tools';
import {
  placeKey,
  type SessionPlace,
} from '@datalayer/agent-runtimes/lib/portable/sessionList';
import type {
  ApprovalDecided,
  PendingApproval,
} from '../../../shared/types/ipc.types';

/** The chat in front, as the banner reads it. */
export interface ChatInFront {
  place: SessionPlace;
  /** The agent its conversation goes to. */
  agentId: string;
}

/** Whether two places are one. */
export const samePlace = (a: SessionPlace, b: SessionPlace): boolean =>
  placeKey(a) === placeKey(b);

/** The approvals of the chat in front: its place's and its agent's, oldest first. */
export function approvalsForChat(
  pending: readonly PendingApproval[],
  chat: ChatInFront | null
): ChatPendingApproval[] {
  if (!chat) {
    return [];
  }
  return pending
    .filter(
      approval =>
        samePlace(approval.place, chat.place) &&
        approval.agentId === chat.agentId
    )
    .map(approval => ({
      id: approval.id,
      toolName: approval.toolName,
      args: approval.args,
      agentId: approval.agentId,
      requestedAt: approval.requestedAt,
    }))
    .sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));
}

/** How many requests wait for the person, across the places. */
export const waitingCount = (pending: readonly PendingApproval[]): number =>
  pending.length;

/** What a decision came to, in the person's words: the place's sentence, as the main process said it. */
export function decisionSaid(decided: ApprovalDecided): string {
  if (!decided.said) {
    throw new Error(
      'The main process answered a decision with no sentence: it says done, answered elsewhere, gone or refused.'
    );
  }
  return decided.said;
}
