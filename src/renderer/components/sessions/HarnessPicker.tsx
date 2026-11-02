/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * The coding agent (DESKTOP DK-06, DK-07): the local runtime's catalogue
 * with each harness's terms, the machine checked for the one picked —
 * node, the adapter in the Shield's prefix, the credential (the
 * environment first, the app's keychain second, O-2), the terms — each
 * unmet part said in the register's words, the `agent-shield setup` line
 * shown whole for what it installs, the credential typed once into the
 * keychain.
 *
 * @module renderer/components/sessions/HarnessPicker
 */

import React from 'react';
import { ActionList, Box, Button, Flash, Text } from '@primer/react';
import type { HarnessFacts } from '@datalayer/agent-runtimes/lib/portable/localRuntime';
import type { HarnessCheckResult } from '../../../shared/types/ipc.types';
import { harnessChoices, WORK_IN_FOLDER_WORDS } from './workInFolder';

/** Props for {@link HarnessPicker}. */
export interface HarnessPickerProps {
  /** The catalogue. */
  harnesses: HarnessFacts[];
  /** The one picked, by id; `''` for none yet. */
  picked: string;
  onPick: (id: string) => void;
  /** The machine's check for the one picked; `null` while checking or none picked. */
  check: HarnessCheckResult | null;
  /** Whether the check is running. */
  checking: boolean;
  /** The sentence when the catalogue or the check could not be read. */
  problem: string;
  /** Asks the person to type a credential once. */
  onTypeCredential: (name: string) => void;
  /** Checks again. */
  onCheckAgain: () => void;
}

/**
 * The picker.
 *
 * @param props - Component props.
 *
 * @returns React element.
 */
export function HarnessPicker(props: HarnessPickerProps): React.JSX.Element {
  const {
    harnesses,
    picked,
    onPick,
    check,
    checking,
    problem,
    onTypeCredential,
    onCheckAgain,
  } = props;
  const choices = harnessChoices(harnesses);
  const chosen = harnesses.find(harness => harness.id === picked);
  return (
    <Box data-testid="harness-picker">
      <Text as="p" sx={{ mt: 0, color: 'fg.muted' }}>
        {WORK_IN_FOLDER_WORDS.pickHarness}
      </Text>
      {problem ? (
        <Flash variant="danger" sx={{ mb: 2 }}>
          {problem}
        </Flash>
      ) : null}
      {choices.length === 0 && !problem ? (
        <Text as="p">{WORK_IN_FOLDER_WORDS.noHarness}</Text>
      ) : (
        <ActionList selectionVariant="single" aria-label="Harnesses">
          {choices.map(choice => (
            <ActionList.Item
              key={choice.id}
              selected={choice.id === picked}
              onSelect={() => onPick(choice.id)}
            >
              {choice.label}
              {choice.description ? (
                <ActionList.Description>
                  {choice.description}
                </ActionList.Description>
              ) : null}
              <ActionList.Description variant="block">
                {choice.detail}
              </ActionList.Description>
            </ActionList.Item>
          ))}
        </ActionList>
      )}
      {chosen ? (
        <Box sx={{ mt: 3 }} data-testid="harness-check">
          {checking ? (
            <Text as="p" sx={{ color: 'fg.muted' }}>
              {WORK_IN_FOLDER_WORDS.checking}
            </Text>
          ) : check ? (
            <>
              {check.check.ok ? (
                <Flash variant="success">
                  {chosen.name} is ready on this machine.
                  {check.credentialSaid ? ` ${check.credentialSaid}` : ''}
                </Flash>
              ) : (
                <Flash variant="warning">
                  <Box as="ul" sx={{ m: 0, pl: 3 }}>
                    {check.check.parts.map(part => (
                      <li key={`${part.part}-${part.sentence}`}>
                        {part.sentence}
                      </li>
                    ))}
                  </Box>
                </Flash>
              )}
              {check.check.parts.some(part => part.setup) ? (
                <Box sx={{ mt: 2 }}>
                  <Text as="p" sx={{ my: 1 }}>
                    {WORK_IN_FOLDER_WORDS.setupLine}
                  </Text>
                  <Text
                    as="pre"
                    sx={{ m: 0, p: 2, bg: 'canvas.subtle', fontFamily: 'mono' }}
                  >
                    {check.check.setupCommand}
                  </Text>
                </Box>
              ) : null}
              {check.check.parts.some(part => part.part === 'credential')
                ? chosen.secrets.map(name => (
                    <Box key={name} sx={{ mt: 2 }}>
                      <Text as="p" sx={{ my: 1 }}>
                        {WORK_IN_FOLDER_WORDS.credentialAsked(name)}
                      </Text>
                      <Button onClick={() => onTypeCredential(name)}>
                        Type {name}…
                      </Button>
                    </Box>
                  ))
                : null}
              <Button
                onClick={onCheckAgain}
                variant="invisible"
                size="small"
                sx={{ mt: 2 }}
              >
                {WORK_IN_FOLDER_WORDS.checkAgain}
              </Button>
            </>
          ) : null}
        </Box>
      ) : null}
    </Box>
  );
}

export default HarnessPicker;
