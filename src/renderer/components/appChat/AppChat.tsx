/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * A deployed application's agent, talked to in Desktop (STUDIO A-20).
 *
 * The conversation is `@datalayer/agent-runtimes`' `<Chat>` over the
 * runtime's session API — an AG-UI run on
 * `<kept runtime>/api/v1/apps/agents/<agent>/ag-ui/`, each thread a session
 * (R-02), as the application's hosted page speaks to it. The view never
 * asks for the person's token: the main process lends it to the requests
 * under the runtimes listed, Tool Approvals and Spacer's items.
 *
 * Before the chat opens, the application's Appspec is read from its Spacer
 * item, and only the version the deployment runs decides — another one is
 * refused in a sentence. One that takes only a signed user (D-21) is opened
 * with a user token ai-agents signs for the person (asked by the main
 * process, `appChatAPI.userToken`), put in each run's body as
 * `forwardedProps.loop.user_token` (`signedRunFetch`) while the chat is
 * open; what its host may pass (D-10) decides whether its
 * agent is given `host_context`, answered with the notebook last in front as
 * `page`. Its approvals (R-05) are ai-agents' Tool Approvals, polled while
 * the chat is open and answered by `<Chat>`'s approval banner; its tool
 * calls are listed as the transcript's lines (A-06) under the chat.
 *
 * @module renderer/components/appChat/AppChat
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Box, Text } from '@primer/react';
import { Chat } from '@datalayer/agent-runtimes/lib/chat/Chat';
import {
  agUiEndpoint,
  APP_CHAT_WORDS,
  appHostOf,
  appItemUrl,
  type AppChatApproval,
  type AppChatHandle,
  type AppHost,
  decideApprovalUrl,
  hostContextTool,
  notebookContextRefusal,
  type NotebookContext,
  pendingApprovalsOf,
  pendingApprovalsUrl,
  revisionRefusal,
  type SignedUser,
  signedRunFetch,
  signedUserFresh,
  takesSignedUser,
  toolLineOf,
  userTokenRefusal,
} from '../../../shared/appChat';

/** How often the approvals the agent waits on are read, while open. */
const APPROVALS_POLL_MS = 3_000;

/** Props for {@link AppChat}. */
export interface AppChatProps {
  /** The deployment talked to. */
  handle: AppChatHandle;
  /** The ai-agents and Spacer base URLs. */
  services: { aiAgentsUrl: string; spacerUrl: string };
  /** The person signed in. */
  user: { handle: string } | null;
  /** Reads the notebook last in front; `undefined` when none is open. */
  readNotebook: () => Promise<NotebookContext | undefined>;
}

/**
 * The detail of a refused answer, or its status.
 *
 * @param response - The answer.
 * @param what - What was asked, for the sentence.
 *
 * @returns The sentence.
 */
async function refusalOf(response: Response, what: string): Promise<string> {
  try {
    const body = (await response.json()) as { detail?: unknown };
    if (typeof body.detail === 'string' && body.detail) {
      return body.detail;
    }
  } catch {
    // The status says it.
  }
  return `${what} was refused (${response.status}).`;
}

/**
 * A deployed application's chat: its Appspec read, then `<Chat>` on its
 * session API with its approvals, `host_context` and the transcript.
 *
 * @param props - Component props.
 *
 * @returns React element.
 */
export function AppChat(props: AppChatProps): React.JSX.Element {
  const { handle, services, user, readNotebook } = props;
  const [host, setHost] = useState<AppHost | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [approvals, setApprovals] = useState<AppChatApproval[]>([]);
  const [lines, setLines] = useState<string[]>([]);

  // The Appspec, from the application's Spacer item.
  useEffect(() => {
    let live = true;
    setHost(null);
    setProblem(null);
    setLines([]);
    void (async () => {
      try {
        const response = await fetch(
          appItemUrl(services.spacerUrl, handle.appUid)
        );
        if (!response.ok) {
          throw new Error(await refusalOf(response, 'Reading the application'));
        }
        const read = appHostOf(await response.json());
        if (live) {
          setHost(read);
        }
      } catch (error) {
        if (live) {
          setProblem(error instanceof Error ? error.message : String(error));
        }
      }
    })();
    return () => {
      live = false;
    };
  }, [handle.appUid, services.spacerUrl]);

  // Only the version deployed decides who its user is and what is passed.
  const revisionRefused = host ? revisionRefusal(handle, host) : '';
  const signed = Boolean(host && !revisionRefused && takesSignedUser(host));
  const [signedRefused, setSignedRefused] = useState('');
  const [signedReady, setSignedReady] = useState(false);
  const signedUser = useRef<SignedUser | null>(null);

  // A signed application (D-21): the person signed for it by ai-agents,
  // asked by the main process; the user token goes in each run's body.
  const userToken = useCallback(async (): Promise<string> => {
    if (!signedUserFresh(signedUser.current, Date.now() / 1000)) {
      signedUser.current = await window.appChatAPI.userToken(handle.uid);
    }
    return signedUser.current!.token;
  }, [handle.uid]);

  useEffect(() => {
    signedUser.current = null;
    setSignedRefused('');
    setSignedReady(false);
    if (!signed) {
      return;
    }
    let live = true;
    userToken()
      .then(() => {
        if (live) {
          setSignedReady(true);
        }
      })
      .catch(error => {
        if (live) {
          setSignedRefused(
            userTokenRefusal(
              handle.name,
              error instanceof Error ? error.message : String(error)
            )
          );
        }
      });
    const original = window.fetch;
    window.fetch = signedRunFetch(original.bind(window), handle, userToken);
    return () => {
      live = false;
      window.fetch = original;
    };
  }, [signed, handle, userToken]);

  const refused = revisionRefused || signedRefused;
  const waiting = signed && !signedReady && !signedRefused;

  // The approvals its agent waits on, while the chat is open.
  const readApprovals = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch(
        pendingApprovalsUrl(services.aiAgentsUrl, handle.agentId)
      );
      if (response.ok) {
        setApprovals(pendingApprovalsOf(await response.json(), handle.agentId));
      }
    } catch {
      // Read again at the next tick.
    }
  }, [services.aiAgentsUrl, handle.agentId]);

  useEffect(() => {
    if (!host || refused) {
      return;
    }
    void readApprovals();
    const timer = setInterval(() => {
      void readApprovals();
    }, APPROVALS_POLL_MS);
    return () => {
      clearInterval(timer);
    };
  }, [host, refused, readApprovals]);

  const decide = useCallback(
    async (approvalId: string, approved: boolean): Promise<boolean> => {
      const response = await fetch(
        decideApprovalUrl(services.aiAgentsUrl, approvalId, approved),
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({}),
        }
      );
      await readApprovals();
      return response.ok;
    },
    [services.aiAgentsUrl, readApprovals]
  );

  // What Desktop passes as the host (D-10): only the version deployed's
  // terms, never a guess.
  const notebookLine = host ? notebookContextRefusal(handle, host) : '';
  const frontendTools = useMemo(() => {
    if (!host || revisionRefusal(handle, host)) {
      return [];
    }
    const tool = hostContextTool(host, readNotebook, user);
    return tool ? [tool] : [];
  }, [host, handle, readNotebook, user]);

  if (problem || !host || refused || waiting) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          p: 3,
        }}
      >
        <Text
          as="p"
          sx={{
            textAlign: 'center',
            color: problem ? 'danger.fg' : 'fg.default',
          }}
        >
          {problem || refused || APP_CHAT_WORDS.reading}
        </Text>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      <Text
        as="p"
        sx={{
          m: 0,
          px: 2,
          py: 1,
          fontSize: 0,
          color: 'fg.muted',
          borderBottom: '1px solid',
          borderColor: 'border.default',
        }}
      >
        {notebookLine || APP_CHAT_WORDS.passesNotebook}
      </Text>
      <Box sx={{ flex: 1, overflow: 'hidden', minHeight: 0 }}>
        <Chat
          key={handle.uid}
          protocol="ag-ui"
          baseUrl={handle.url}
          endpoint={agUiEndpoint(handle)}
          configEndpoint={`${handle.url}/api/v1/configure`}
          agentId={handle.agentId}
          title={handle.name}
          height="100%"
          showHeader={true}
          showInput={true}
          autoFocus={true}
          autoConnect={true}
          streaming={true}
          clearOnMount={true}
          frontendTools={frontendTools}
          onToolCallStart={({ toolName }) => {
            setLines(said => [
              ...said,
              toolLineOf(handle.name, toolName, host),
            ]);
          }}
          pendingApprovals={approvals}
          onApproveApproval={approvalId => decide(approvalId, true)}
          onRejectApproval={approvalId => decide(approvalId, false)}
        />
      </Box>
      <Box
        as="details"
        sx={{
          px: 2,
          py: 1,
          fontSize: 0,
          borderTop: '1px solid',
          borderColor: 'border.default',
          maxHeight: '30%',
          overflow: 'auto',
          flexShrink: 0,
        }}
      >
        <summary>
          {APP_CHAT_WORDS.transcript} ({lines.length})
        </summary>
        {lines.length === 0 ? (
          <Text as="p" sx={{ my: 1 }}>
            {APP_CHAT_WORDS.noLines}
          </Text>
        ) : (
          lines.map((line, index) => (
            <Text
              as="p"
              key={`${index}-${line}`}
              sx={{ my: 1, fontFamily: 'mono' }}
            >
              {line}
            </Text>
          ))
        )}
      </Box>
    </Box>
  );
}

export default AppChat;
