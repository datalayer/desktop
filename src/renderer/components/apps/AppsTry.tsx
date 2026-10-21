/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * An application's Try, native (DESKTOP DK-02): its chat on the runtime a
 * deployment of it is kept on — the same `AppChat` a session on Datalayer
 * opens in (agent-runtimes' `<Chat>` on the session API's AG-UI route,
 * each thread a session, the token lent by the main process, the
 * deployed version's Appspec deciding), with its approvals decided
 * through the main process. A deployment that cannot be talked to says
 * why; the Preview of a draft (a runtime launched for the editor's
 * version) is the web Apps'.
 *
 * @module renderer/components/apps/AppsTry
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Box, Flash, Text } from '@primer/react';
import type { AppChatChoice, NotebookContext } from '../../../shared/appChat';
import type { PendingApproval } from '../../../shared/types/ipc.types';
import AppChat from '../appChat/AppChat';
import { approvalsForChat, decisionSaid } from '../sessions/approvalsBanner';
import { APPS_WORDS, tryDecisionOf } from '../../pages/appsPage';
import OpenOnWeb from './OpenOnWeb';

/** Props for {@link AppsTry}. */
export interface AppsTryProps {
  appUid: string;
  /** What `app-chat:list-deployments` answered, or null before. */
  choices: AppChatChoice[] | null;
  /** The sentences of this application's deployments that cannot be talked to. */
  closed: string[];
  services: { aiAgentsUrl: string; spacerUrl: string } | null;
  user: { handle: string } | null;
  /** The web Apps' Try of this application (the Preview of a draft). */
  webUrl: string;
}

const noNotebook = async (): Promise<NotebookContext | undefined> => undefined;

const AppsTry: React.FC<AppsTryProps> = ({
  appUid,
  choices,
  closed,
  services,
  user,
  webUrl,
}) => {
  const decision = useMemo(
    () => (choices ? tryDecisionOf(appUid, choices) : null),
    [appUid, choices]
  );
  const [pending, setPending] = useState<PendingApproval[]>([]);
  const [said, setSaid] = useState('');

  useEffect(() => {
    let alive = true;
    window.desktopAPI.approvals
      .pending()
      .then(list => alive && setPending(list))
      .catch(() => undefined);
    const off = window.desktopAPI.approvals.onChanged(list => setPending(list));
    return () => {
      alive = false;
      off();
    };
  }, []);

  const agentId = decision?.kind === 'talk' ? decision.handle.agentId : '';
  const chatApprovals = useMemo(
    () =>
      agentId
        ? approvalsForChat(pending, { place: { kind: 'datalayer' }, agentId })
        : [],
    [pending, agentId]
  );
  const decideApproval = useCallback(
    async (approvalId: string, approved: boolean) => {
      const decided = await window.desktopAPI.approvals.decide({
        place: { kind: 'datalayer' },
        id: approvalId,
        decision: approved ? 'approve' : 'reject',
      });
      setSaid(decisionSaid(decided));
      setPending(await window.desktopAPI.approvals.pending());
    },
    []
  );

  if (!decision) {
    return (
      <Text as="p" sx={{ color: 'fg.muted', fontSize: 1 }}>
        {APPS_WORDS.readingApp}
      </Text>
    );
  }
  if (decision.kind === 'closed' || !services) {
    return (
      <Box sx={{ display: 'grid', gap: 2 }} data-testid="apps-try">
        <Flash variant="warning">
          <Text as="p" sx={{ m: 0 }}>
            {decision.kind === 'closed'
              ? decision.sentence
              : APPS_WORDS.notTalkable}
          </Text>
          {closed.map(sentence => (
            <Text as="p" key={sentence} sx={{ m: 0, mt: 1, fontSize: 1 }}>
              {sentence}
            </Text>
          ))}
        </Flash>
        <Box>
          <OpenOnWeb url={webUrl} label={APPS_WORDS.tryOnWeb} />
        </Box>
      </Box>
    );
  }
  return (
    <Box
      sx={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 1 }}
      data-testid="apps-try"
    >
      {said ? (
        <Text sx={{ fontSize: 0, color: 'fg.muted' }}>{said}</Text>
      ) : null}
      <Box sx={{ flex: 1, minHeight: 480 }}>
        <AppChat
          key={decision.handle.uid}
          handle={decision.handle}
          services={services}
          user={user}
          readNotebook={noNotebook}
          pendingApprovals={chatApprovals}
          decideApproval={decideApproval}
        />
      </Box>
    </Box>
  );
};

export default AppsTry;
