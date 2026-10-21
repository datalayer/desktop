/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Work in a folder (DESKTOP DK-07), the dialog: a folder picked, the
 * folder's runtime started by the main process (`local-runtime:start`),
 * a harness picked from the runtime's catalogue with the machine checked
 * for it (DK-06), an application picked, then the application configured
 * on the folder's runtime (`POST /api/v1/apps/configure`) and a session
 * opened on it (`POST /api/v1/apps/sessions`, agent-runtimes'
 * `appSessionsClient`) — the harness started in it over ACP behind the
 * Shield, the folder's own instructions file kept and said by the runtime
 * in the session's first line (VS-23, 1.5.70). A refusal of the runtime
 * is shown as it said it.
 *
 * @module renderer/components/sessions/WorkInFolderDialog
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Box, Button, Dialog, Flash, Text } from '@primer/react';
import type { HarnessFacts } from '@datalayer/agent-runtimes/lib/portable/localRuntime';
import { type AgUiEvent } from '@datalayer/agent-runtimes/lib/portable/agui';
import { appSessionsClient } from '@datalayer/agent-runtimes/lib/portable/sessions';
import type {
  HarnessCheckResult,
  LocalRuntimeInfo,
} from '../../../shared/types/ipc.types';
import {
  type ChatTarget,
  folderNameOf,
  localPlaceOf,
} from '../../pages/sessionsPage';
import ApplicationPicker from './ApplicationPicker';
import FolderPicker from './FolderPicker';
import HarnessPicker from './HarnessPicker';
import {
  agentIdOf,
  appChoices,
  configureBody,
  runtimeRefusal,
  sessionUidOfEvents,
  WORK_IN_FOLDER_WORDS,
} from './workInFolder';

/** Props for {@link WorkInFolderDialog}. */
export interface WorkInFolderDialogProps {
  /** The folders remembered, the last one first. */
  recent: string[];
  /** Asks the person to type a credential once; resolves once kept, or declined. */
  typeCredential: (name: string) => Promise<void>;
  /** The session started: opened in the chat. */
  onStarted: (target: ChatTarget, runtime: LocalRuntimeInfo) => void;
  onClose: () => void;
}

type Step = 'folder' | 'harness' | 'application';

const message = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * The dialog.
 *
 * @param props - Component props.
 *
 * @returns React element.
 */
export function WorkInFolderDialog(
  props: WorkInFolderDialogProps
): React.JSX.Element {
  const { recent, typeCredential, onStarted, onClose } = props;
  const [step, setStep] = useState<Step>('folder');
  const [folder, setFolder] = useState(recent[0] ?? '');
  const [runtime, setRuntime] = useState<LocalRuntimeInfo | null>(null);
  const [harnesses, setHarnesses] = useState<HarnessFacts[]>([]);
  const [harness, setHarness] = useState('');
  const [check, setCheck] = useState<HarnessCheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [application, setApplication] = useState(0);
  const [busy, setBusy] = useState('');
  const [problem, setProblem] = useState('');

  const chooseAnother = useCallback(async () => {
    const picked = await window.desktopAPI.dialog.openFolder();
    if (picked) {
      setFolder(picked.folder);
    }
  }, []);

  // The folder's runtime, then its catalogue.
  const toHarness = useCallback(async () => {
    if (!folder) {
      return;
    }
    setProblem('');
    setBusy(WORK_IN_FOLDER_WORDS.starting);
    try {
      const started = await window.desktopAPI.localRuntime.start(folder);
      setRuntime(started);
      const listed = await window.desktopAPI.localRuntime.harnesses(folder);
      setHarnesses(listed);
      setHarness(current => current || listed[0]?.id || '');
      setStep('harness');
    } catch (error) {
      setProblem(message(error));
    } finally {
      setBusy('');
    }
  }, [folder]);

  // The machine checked for the harness picked (DK-06).
  const runCheck = useCallback(async () => {
    if (!harness) {
      setCheck(null);
      return;
    }
    setChecking(true);
    setCheck(null);
    try {
      setCheck(await window.desktopAPI.localRuntime.checkHarness(harness));
      setProblem('');
    } catch (error) {
      setProblem(message(error));
    } finally {
      setChecking(false);
    }
  }, [harness]);

  useEffect(() => {
    if (step === 'harness') {
      void runCheck();
    }
  }, [step, runCheck]);

  const chosen = harnesses.find(item => item.id === harness);
  const folderName = folderNameOf(folder);
  const choices = chosen ? appChoices(chosen, folderName, []) : [];

  // Configured on the folder's runtime, then a session opened on it.
  const start = useCallback(async () => {
    if (!runtime || !chosen) {
      return;
    }
    const spec = choices[application]?.spec;
    if (!spec) {
      return;
    }
    setProblem('');
    setBusy(WORK_IN_FOLDER_WORDS.configuring);
    try {
      const configured = await fetch(`${runtime.url}/api/v1/apps/configure`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(configureBody(spec)),
      });
      if (!configured.ok) {
        throw new Error(
          runtimeRefusal(
            'Configuring the application',
            configured.status,
            await configured.text()
          )
        );
      }
      const agent = agentIdOf(await configured.json());
      setBusy(WORK_IN_FOLDER_WORDS.opening);
      const client = appSessionsClient({
        baseUrl: runtime.url,
        getAccessToken: () => undefined,
        fetch: (input, init) => fetch(input, init),
      });
      const events: AgUiEvent[] = [];
      await client.start(
        { agent, opener: '' },
        { onEvent: event => events.push(event) }
      );
      const uid = sessionUidOfEvents(events);
      const name =
        typeof spec.name === 'string' && spec.name ? spec.name : chosen.name;
      onStarted(
        {
          kind: 'local',
          uid,
          agent,
          place: localPlaceOf(runtime),
          title: name,
          state: 'open',
        },
        runtime
      );
    } catch (error) {
      setProblem(message(error));
    } finally {
      setBusy('');
    }
  }, [runtime, chosen, choices, application, onStarted]);

  const blocked = Boolean(
    check && check.check.parts.some(part => part.blocking)
  );

  return (
    <Dialog onClose={onClose} title={WORK_IN_FOLDER_WORDS.title}>
      <Box sx={{ p: 3, minWidth: 480 }} data-testid="work-in-folder">
        {problem ? (
          <Flash variant="danger" sx={{ mb: 3 }}>
            {problem}
          </Flash>
        ) : null}
        {step === 'folder' ? (
          <FolderPicker
            recent={recent}
            picked={folder}
            onPick={setFolder}
            onChooseAnother={() => void chooseAnother()}
          />
        ) : step === 'harness' ? (
          <HarnessPicker
            harnesses={harnesses}
            picked={harness}
            onPick={id => {
              setHarness(id);
              setCheck(null);
            }}
            check={check}
            checking={checking}
            problem=""
            onTypeCredential={name => {
              void typeCredential(name).then(() => runCheck());
            }}
            onCheckAgain={() => void runCheck()}
          />
        ) : (
          <ApplicationPicker
            choices={choices}
            picked={application}
            onPick={setApplication}
          />
        )}
        {busy ? (
          <Text as="p" sx={{ mt: 3, mb: 0, color: 'fg.muted' }}>
            {busy}
          </Text>
        ) : null}
        <Box
          sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2, mt: 3 }}
        >
          <Button onClick={onClose} disabled={Boolean(busy)}>
            {WORK_IN_FOLDER_WORDS.cancel}
          </Button>
          {step !== 'folder' ? (
            <Button
              onClick={() =>
                setStep(step === 'application' ? 'harness' : 'folder')
              }
              disabled={Boolean(busy)}
            >
              {WORK_IN_FOLDER_WORDS.back}
            </Button>
          ) : null}
          {step === 'folder' ? (
            <Button
              variant="primary"
              onClick={() => void toHarness()}
              disabled={!folder || Boolean(busy)}
            >
              {WORK_IN_FOLDER_WORDS.next}
            </Button>
          ) : step === 'harness' ? (
            <Button
              variant="primary"
              onClick={() => setStep('application')}
              disabled={!chosen || checking || blocked || Boolean(busy)}
            >
              {WORK_IN_FOLDER_WORDS.next}
            </Button>
          ) : (
            <Button
              variant="primary"
              onClick={() => void start()}
              disabled={!chosen || Boolean(busy)}
            >
              {WORK_IN_FOLDER_WORDS.start}
            </Button>
          )}
        </Box>
      </Box>
    </Dialog>
  );
}

export default WorkInFolderDialog;
