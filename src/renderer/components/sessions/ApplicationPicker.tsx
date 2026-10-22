/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * The application the agent runs as (DESKTOP DK-07): the blank harness
 * application by default, then the folder's own Appspecs when the main
 * process lists them.
 *
 * @module renderer/components/sessions/ApplicationPicker
 */

import React from 'react';
import { ActionList, Box, Text } from '@primer/react';
import { type AppChoice, WORK_IN_FOLDER_WORDS } from './workInFolder';

/** Props for {@link ApplicationPicker}. */
export interface ApplicationPickerProps {
  choices: AppChoice[];
  /** The one picked, by its index. */
  picked: number;
  onPick: (index: number) => void;
}

/**
 * The picker.
 *
 * @param props - Component props.
 *
 * @returns React element.
 */
export function ApplicationPicker(
  props: ApplicationPickerProps
): React.JSX.Element {
  const { choices, picked, onPick } = props;
  return (
    <Box data-testid="application-picker">
      <Text as="p" sx={{ mt: 0, color: 'fg.muted' }}>
        {WORK_IN_FOLDER_WORDS.pickApplication}
      </Text>
      <ActionList selectionVariant="single" aria-label="Applications">
        {choices.map((choice, index) => (
          <ActionList.Item
            key={`${choice.path}-${choice.label}`}
            selected={index === picked}
            onSelect={() => onPick(index)}
          >
            {choice.label}
            {choice.description ? (
              <ActionList.Description>
                {choice.description}
              </ActionList.Description>
            ) : null}
            {choice.detail ? (
              <ActionList.Description variant="block">
                {choice.detail}
              </ActionList.Description>
            ) : null}
          </ActionList.Item>
        ))}
      </ActionList>
    </Box>
  );
}

export default ApplicationPicker;
