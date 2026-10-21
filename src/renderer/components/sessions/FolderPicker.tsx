/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * The folder a coding agent works in (DESKTOP DK-07): the last ten
 * remembered, or another picked with the OS dialog (the main process's
 * `dialog:open-folder`, which remembers it).
 *
 * @module renderer/components/sessions/FolderPicker
 */

import React from 'react';
import { ActionList, Box, Button, Text } from '@primer/react';
import { FileDirectoryIcon } from '@primer/octicons-react';
import { folderNameOf } from '../../pages/sessionsPage';
import { WORK_IN_FOLDER_WORDS } from './workInFolder';

/** Props for {@link FolderPicker}. */
export interface FolderPickerProps {
  /** The folders remembered, the last one first. */
  recent: string[];
  /** The folder picked now, when one is. */
  picked: string;
  onPick: (folder: string) => void;
  /** Opens the OS dialog. */
  onChooseAnother: () => void;
}

/**
 * The picker.
 *
 * @param props - Component props.
 *
 * @returns React element.
 */
export function FolderPicker(props: FolderPickerProps): React.JSX.Element {
  const { recent, picked, onPick, onChooseAnother } = props;
  return (
    <Box data-testid="folder-picker">
      <Text as="p" sx={{ mt: 0, color: 'fg.muted' }}>
        {WORK_IN_FOLDER_WORDS.pickFolder}
      </Text>
      {recent.length === 0 ? (
        <Text as="p" sx={{ color: 'fg.muted' }}>
          {WORK_IN_FOLDER_WORDS.noRecent}
        </Text>
      ) : (
        <ActionList
          selectionVariant="single"
          aria-label={WORK_IN_FOLDER_WORDS.recent}
        >
          <ActionList.Group>
            <ActionList.GroupHeading>
              {WORK_IN_FOLDER_WORDS.recent}
            </ActionList.GroupHeading>
            {recent.map(folder => (
              <ActionList.Item
                key={folder}
                selected={folder === picked}
                onSelect={() => onPick(folder)}
              >
                <ActionList.LeadingVisual>
                  <FileDirectoryIcon />
                </ActionList.LeadingVisual>
                {folderNameOf(folder)}
                <ActionList.Description variant="block">
                  {folder}
                </ActionList.Description>
              </ActionList.Item>
            ))}
          </ActionList.Group>
        </ActionList>
      )}
      <Button onClick={onChooseAnother} sx={{ mt: 2 }}>
        {WORK_IN_FOLDER_WORDS.chooseAnother}
      </Button>
    </Box>
  );
}

export default FolderPicker;
