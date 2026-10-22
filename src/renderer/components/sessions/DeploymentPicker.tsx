/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * New session on Datalayer (DESKTOP DK-08): the person's applications as
 * ai-agents lists their deployments (A-20's `deploymentChoiceOf`) — one
 * kept always on and live is pickable, every other one closed with its
 * sentence, none talkable said so.
 *
 * @module renderer/components/sessions/DeploymentPicker
 */

import React from 'react';
import { ActionList, Box, Button, Dialog, Flash, Text } from '@primer/react';
import { SyncIcon } from '@primer/octicons-react';
import {
  type AppChatChoice,
  type AppChatHandle,
  noneTalkableSentence,
} from '../../../shared/appChat';

/** Props for {@link DeploymentPicker}. */
export interface DeploymentPickerProps {
  /** The deployments listed, or null while not listed yet. */
  choices: AppChatChoice[] | null;
  /** The sentence when they could not be listed. */
  problem: string;
  onRefresh: () => void;
  onPick: (handle: AppChatHandle) => void;
  onClose: () => void;
}

/**
 * The picker.
 *
 * @param props - Component props.
 *
 * @returns React element.
 */
export function DeploymentPicker(
  props: DeploymentPickerProps
): React.JSX.Element {
  const { choices, problem, onRefresh, onPick, onClose } = props;
  const none = choices ? noneTalkableSentence(choices) : '';
  return (
    <Dialog onClose={onClose} title="New session on Datalayer">
      <Box sx={{ p: 3, minWidth: 480 }} data-testid="deployment-picker">
        {problem ? (
          <Flash variant="danger" sx={{ mb: 3 }}>
            {problem}
          </Flash>
        ) : null}
        {choices === null && !problem ? (
          <Text as="p" sx={{ color: 'fg.muted' }}>
            Listing your applications…
          </Text>
        ) : null}
        {none ? (
          <Text as="p" sx={{ color: 'fg.muted' }}>
            {none}
          </Text>
        ) : null}
        {choices && choices.length > 0 ? (
          <ActionList aria-label="Your applications">
            {choices.map(choice =>
              choice.kind === 'talk' ? (
                <ActionList.Item
                  key={choice.handle.uid}
                  onSelect={() => onPick(choice.handle)}
                >
                  {choice.handle.name}
                  <ActionList.Description variant="block">
                    version {choice.handle.version} · {choice.handle.target}
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
        ) : null}
        <Box
          sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 3 }}
        >
          <Button leadingVisual={SyncIcon} onClick={onRefresh}>
            Refresh
          </Button>
          <Button onClick={onClose}>Close</Button>
        </Box>
      </Box>
    </Dialog>
  );
}

export default DeploymentPicker;
