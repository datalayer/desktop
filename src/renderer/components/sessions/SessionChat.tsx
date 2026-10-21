/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * One chat for both places (DESKTOP decision D-1, DK-08): a session on
 * this machine opens in Agent Runtimes' `<Chat thread sessionActions>` on
 * the local runtime's session API — nothing signed, the runtime is this
 * machine's own — and a session on Datalayer in `AppChat` (A-20's chat on
 * the kept deployment, its lender, its signed user and `host_context`
 * kept whole), the same thread, the same menu drawn from the Reactor
 * registered for the renderer, the same approval banner fed by the main
 * process (DK-13).
 *
 * @module renderer/components/sessions/SessionChat
 */

import React from 'react';
import { Box } from '@primer/react';
import {
  Chat,
  type ChatSessionActions,
} from '@datalayer/agent-runtimes/lib/chat/Chat';
import type { PendingApproval } from '@datalayer/agent-runtimes/lib/chat/tools';
import type { NotebookContext } from '../../../shared/appChat';
import AppChat from '../appChat/AppChat';
import type { ChatTarget } from '../../pages/sessionsPage';
import { localSessionProtocol } from './workInFolder';

/** Props for {@link SessionChat}. */
export interface SessionChatProps {
  /** The session opened, or the new conversation to start. */
  target: ChatTarget;
  /** The ai-agents and Spacer base URLs, for a session on Datalayer. */
  services: { aiAgentsUrl: string; spacerUrl: string } | null;
  /** The person signed in. */
  user: { handle: string } | null;
  /** Reads the notebook last in front; `undefined` when none is open. */
  readNotebook: () => Promise<NotebookContext | undefined>;
  /** What the session's menu may use and is told (DK-10). */
  sessionActions: ChatSessionActions;
  /** The approvals of this chat's place and agent (DK-13). */
  pendingApprovals: PendingApproval[];
  /** Decides one through the main process; resolves once the place answered. */
  decideApproval: (approvalId: string, approved: boolean) => Promise<void>;
  /** Told the person's message was sent, and the agent's answer received. */
  onTurn: (phase: 'sent' | 'answered') => void;
}

/** The sentence when a session on Datalayer is opened before the services are known. */
export const SERVICES_UNKNOWN =
  'The Datalayer services are not known yet: list your applications first.';

/**
 * The chat for the target: the local runtime's, or the kept deployment's.
 *
 * @param props - Component props.
 *
 * @returns React element.
 */
export function SessionChat(props: SessionChatProps): React.JSX.Element {
  const {
    target,
    services,
    user,
    readNotebook,
    sessionActions,
    pendingApprovals,
    decideApproval,
    onTurn,
  } = props;
  if (target.kind === 'datalayer') {
    if (!services) {
      throw new Error(SERVICES_UNKNOWN);
    }
    return (
      <AppChat
        key={`${target.handle.uid} ${target.uid}`}
        handle={target.handle}
        services={services}
        user={user}
        readNotebook={readNotebook}
        openUid={target.uid || undefined}
        sessionActions={sessionActions}
        pendingApprovals={pendingApprovals}
        decideApproval={decideApproval}
        onTurn={onTurn}
      />
    );
  }
  return (
    <Box sx={{ height: '100%', overflow: 'hidden' }}>
      <Chat
        // Another session is another conversation.
        key={`${target.place.url} ${target.agent} ${target.uid}`}
        protocol={localSessionProtocol(target.place.url, target.agent)}
        baseUrl={target.place.url}
        agentId={target.agent}
        thread={{ id: target.uid, messages: [], fromRuntime: true }}
        sessionActions={sessionActions}
        title={target.title || target.uid}
        height="100%"
        showHeader={true}
        showInput={true}
        autoFocus={true}
        autoConnect={true}
        streaming={true}
        clearOnMount={true}
        onMessageSent={() => onTurn('sent')}
        onMessageReceived={() => onTurn('answered')}
        pendingApprovals={pendingApprovals}
        onApproveApproval={approvalId => decideApproval(approvalId, true)}
        onRejectApproval={approvalId => decideApproval(approvalId, false)}
      />
    </Box>
  );
}

export default SessionChat;
