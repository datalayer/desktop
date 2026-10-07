/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Your applications (STUDIO A-20): the person's deployments, one live, kept
 * always on, on a running runtime picked and talked to in `AppChat`; each
 * other one listed with its sentence. The main process lists them
 * (`appChatAPI.listDeployments`) and lends the person's token to their
 * runtimes; this page never holds it.
 *
 * The notebook the person last had in front is what the agent is given as
 * the host's `page` (D-10), read from the notebook's model only when the
 * agent calls `host_context`: a second window could not read it, so the
 * agent is a tab of the main window rather than a window of its own.
 *
 * @module renderer/pages/Applications
 */

import React, { useCallback, useEffect, useState } from 'react';
import { ActionList, Box, Button, Heading, Text } from '@primer/react';
import { SyncIcon } from '@primer/octicons-react';
import {
  APP_CHAT_WORDS,
  type AppChatChoice,
  type AppChatHandle,
  cellReadOf,
  notebookContextOf,
  type NotebookContext,
} from '../../shared/appChat';
import type { NotebookData, User } from '../../shared/types';
import AppChat from '../components/appChat/AppChat';

/** Props for {@link Applications}. */
export interface ApplicationsProps {
  /** Whether the person is signed in. */
  isAuthenticated: boolean;
  /** The person signed in. */
  user: User | null;
  /** The notebook the person last had in front, if one is still open. */
  frontNotebook: NotebookData | null;
}

/**
 * Reads a notebook open in Desktop from its model: its path, its cell
 * count, its selected cell.
 *
 * @param notebook - The notebook last in front.
 *
 * @returns What is passed as the host's `page`, or `undefined` when its
 *   model is not loaded.
 */
async function readOpenNotebook(
  notebook: NotebookData
): Promise<NotebookContext | undefined> {
  const { notebookStore } = await import('@datalayer/jupyter-react');
  const widget = notebookStore.getState().notebooks.get(notebook.id)
    ?.adapter?.notebook;
  if (!widget) {
    return undefined;
  }
  const active = widget.activeCell;
  return notebookContextOf({
    path: notebook.path || notebook.name,
    cells: widget.widgets.length,
    ...(active
      ? { cell: cellReadOf(widget.activeCellIndex, active.model.toJSON()) }
      : {}),
  });
}

/**
 * The page: the picker on the left, the chat on the right.
 *
 * @param props - Component props.
 *
 * @returns React element.
 */
const Applications: React.FC<ApplicationsProps> = ({
  isAuthenticated,
  user,
  frontNotebook,
}) => {
  const [choices, setChoices] = useState<AppChatChoice[] | null>(null);
  const [services, setServices] = useState<{
    aiAgentsUrl: string;
    spacerUrl: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [picked, setPicked] = useState<AppChatHandle | null>(null);

  const refresh = useCallback(async () => {
    setError(null);
    try {
      const listed = await window.appChatAPI.listDeployments();
      setChoices(listed.deployments);
      setServices(listed.services);
      setPicked(current =>
        current &&
        listed.deployments.some(
          choice => choice.kind === 'talk' && choice.handle.uid === current.uid
        )
          ? current
          : null
      );
    } catch (failure) {
      setChoices([]);
      setPicked(null);
      setError(failure instanceof Error ? failure.message : String(failure));
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      void refresh();
    } else {
      setChoices(null);
      setPicked(null);
    }
  }, [isAuthenticated, refresh]);

  const readNotebook = useCallback(
    async (): Promise<NotebookContext | undefined> =>
      frontNotebook ? readOpenNotebook(frontNotebook) : undefined,
    [frontNotebook]
  );

  const talkable = (choices ?? []).filter(choice => choice.kind === 'talk');

  return (
    <Box sx={{ display: 'flex', height: '100%', minHeight: 0 }}>
      <Box
        sx={{
          width: 320,
          flexShrink: 0,
          borderRight: '1px solid',
          borderColor: 'border.default',
          overflow: 'auto',
          p: 2,
        }}
      >
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            mb: 2,
          }}
        >
          <Heading as="h2" sx={{ fontSize: 2 }}>
            {APP_CHAT_WORDS.pickerGroup}
          </Heading>
          <Button
            size="small"
            leadingVisual={SyncIcon}
            onClick={() => void refresh()}
          >
            Refresh
          </Button>
        </Box>
        {error && (
          <Text as="p" sx={{ color: 'danger.fg', fontSize: 1 }}>
            {APP_CHAT_WORDS.listFailed}: {error}
          </Text>
        )}
        {choices && !error && talkable.length === 0 && (
          <Text as="p" sx={{ color: 'fg.muted', fontSize: 1 }}>
            {APP_CHAT_WORDS.none}
          </Text>
        )}
        <ActionList>
          {(choices ?? []).map(choice =>
            choice.kind === 'talk' ? (
              <ActionList.Item
                key={choice.handle.uid}
                active={picked?.uid === choice.handle.uid}
                onSelect={() => setPicked(choice.handle)}
              >
                {choice.handle.name}
                <ActionList.Description variant="block">
                  version {choice.handle.version}, {choice.handle.target}
                </ActionList.Description>
              </ActionList.Item>
            ) : (
              <ActionList.Item key={choice.uid} disabled>
                {choice.name}
                <ActionList.Description variant="block">
                  {choice.why}
                </ActionList.Description>
              </ActionList.Item>
            )
          )}
        </ActionList>
      </Box>
      <Box sx={{ flex: 1, minWidth: 0, minHeight: 0 }}>
        {picked && services ? (
          <AppChat
            key={picked.uid}
            handle={picked}
            services={services}
            user={user?.handle ? { handle: user.handle } : null}
            readNotebook={readNotebook}
          />
        ) : null}
      </Box>
    </Box>
  );
};

export default Applications;
