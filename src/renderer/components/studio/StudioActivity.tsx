/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * An application's Activity, native (DESKTOP DK-02): its sessions from the
 * Sessions page's own list (`sessions:list`, both places), newest first,
 * each with its state, agent, version, place and lineage; a row opens the
 * session in the Sessions tab's chat.
 *
 * @module renderer/components/studio/StudioActivity
 */

import React from 'react';
import { ActionList, Box, Text } from '@primer/react';
import { type ActivityRow, STUDIO_WORDS } from '../../pages/studioPage';
import OpenOnWeb from './OpenOnWeb';

/** Props for {@link StudioActivity}. */
export interface StudioActivityProps {
  rows: ActivityRow[] | null;
  problem: string;
  onOpen: (uid: string) => void;
  /** The web Studio's Activity of this application (runs, schedules, usage). */
  webUrl: string;
}

const StudioActivity: React.FC<StudioActivityProps> = ({
  rows,
  problem,
  onOpen,
  webUrl,
}) => (
  <Box sx={{ display: 'grid', gap: 2 }} data-testid="studio-activity">
    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
      <OpenOnWeb url={webUrl} label={STUDIO_WORDS.openOnWeb} />
    </Box>
    {problem ? (
      <Text as="p" sx={{ color: 'danger.fg', fontSize: 1 }}>
        {problem}
      </Text>
    ) : null}
    {rows && rows.length === 0 && !problem ? (
      <Text as="p" sx={{ color: 'fg.muted', fontSize: 1 }}>
        {STUDIO_WORDS.noSession}
      </Text>
    ) : null}
    {rows && rows.length > 0 ? (
      <ActionList aria-label={STUDIO_WORDS.sections.activity}>
        {rows.map(row => (
          <ActionList.Item
            key={`${row.said}-${row.entry.row.uid}`}
            onSelect={() => onOpen(row.entry.row.uid)}
            data-activity-row={row.entry.row.uid}
          >
            {row.title}
            <ActionList.Description variant="block">
              {row.said}
              {row.lineage ? ` · ${row.lineage}` : ''}
            </ActionList.Description>
            <ActionList.TrailingVisual>
              <Text sx={{ fontSize: 0, color: 'fg.muted' }}>
                {STUDIO_WORDS.openSession}
              </Text>
            </ActionList.TrailingVisual>
          </ActionList.Item>
        ))}
      </ActionList>
    ) : null}
  </Box>
);

export default StudioActivity;
