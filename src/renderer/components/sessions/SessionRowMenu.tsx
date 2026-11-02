/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * A row's menu on the list (DESKTOP DK-10): *Open*, then the same entries
 * the chat's `⋯` menu draws — the chat's five (*Switch agent…*, *Clone
 * from here*, *Export*, *Import…*, *Resume*) and the app's own — read from
 * the one `loop.session.action` registry, each entry's `when` deciding
 * whether it applies to the row as it stands; each run against the
 * runtime that answers for the row (the local runtime, or the kept
 * deployment's), its refusal shown as it said it. Nothing of the menu is
 * copied.
 *
 * @module renderer/components/sessions/SessionRowMenu
 */

import React from 'react';
import { ActionList, ActionMenu, IconButton } from '@primer/react';
import { KebabHorizontalIcon } from '@primer/octicons-react';
import { useContributions } from '@datalayer/reactor/react';
import {
  LoopSessionAction,
  type SessionActionContext,
  sessionActionsFor,
} from '@datalayer/agent-runtimes/lib/apps/core';
import type { SessionEntry } from '@datalayer/agent-runtimes/lib/portable/sessionList';

/** Props for {@link SessionRowMenu}. */
export interface SessionRowMenuProps {
  entry: SessionEntry;
  /** Opens the row in the chat. */
  onOpen: () => void;
  /**
   * What an entry may do against the row's runtime; `null` when no runtime
   * answers for the row (a session on Datalayer whose application is not
   * kept always on): then only *Open* is offered, which says why.
   */
  context: SessionActionContext | null;
}

/**
 * The menu.
 *
 * @param props - Component props.
 *
 * @returns React element.
 */
export function SessionRowMenu(props: SessionRowMenuProps): React.JSX.Element {
  const { entry, onOpen, context } = props;
  const entries = useContributions(LoopSessionAction);
  const applicable = context ? sessionActionsFor(entries, entry.row) : [];
  return (
    <ActionMenu>
      <ActionMenu.Anchor>
        <IconButton
          icon={KebabHorizontalIcon}
          aria-label={`Actions for ${entry.row.title || entry.row.uid}`}
          variant="invisible"
          size="small"
          data-testid={`row-menu-${entry.row.uid}`}
        />
      </ActionMenu.Anchor>
      <ActionMenu.Overlay width="small">
        <ActionList>
          <ActionList.Item onSelect={onOpen}>Open</ActionList.Item>
          {applicable.map(action => (
            <React.Fragment key={action.id}>
              {action.divider ? <ActionList.Divider /> : null}
              <ActionList.Item
                data-session-action={action.id}
                onSelect={() => {
                  if (!context) {
                    return;
                  }
                  Promise.resolve(action.run(entry.row, context)).catch(error =>
                    context.say(
                      error instanceof Error ? error.message : String(error)
                    )
                  );
                }}
              >
                {action.label}
              </ActionList.Item>
            </React.Fragment>
          ))}
        </ActionList>
      </ActionMenu.Overlay>
    </ActionMenu>
  );
}

export default SessionRowMenu;
