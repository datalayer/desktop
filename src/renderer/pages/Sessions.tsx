/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Sessions (DESKTOP DK-07, DK-08, DK-09, DK-10, DK-13) — the first view
 * after sign-in: the person's sessions on Datalayer and on this machine in
 * one list on the left (the main process's `sessions:list`, merged and
 * grouped by place then application, filtered, paged), the chat on the
 * right, one session in front. *Work in a folder…* starts a coding agent
 * in a folder of theirs on a local runtime; *New session on Datalayer…*
 * opens one on an application kept always on; a row opens its session in
 * the chat, a paused one resumed on the folder's runtime started if need
 * be, one held in VS Code or a terminal refused until paused (D-12). The
 * verbs are the chat's own entries and the app's, drawn from the one
 * registry in the chat's `⋯` menu and on each row; what they need of the
 * app — a save dialog, an open dialog, a picker, a text asked — goes over
 * IPC. The approvals waiting for the person come from the main process
 * and are decided through it; what each place answered is shown as it
 * said it.
 *
 * @module renderer/pages/Sessions
 */

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActionList,
  Box,
  Button,
  FormControl,
  Heading,
  IconButton,
  SegmentedControl,
  Select,
  Text,
  TextInput,
} from '@primer/react';
import {
  FileDirectoryIcon,
  PlusIcon,
  SyncIcon,
  XIcon,
} from '@primer/octicons-react';
import { useContributions } from '@datalayer/reactor/react';
import {
  LoopSessionAction,
  type SessionActionContext,
} from '@datalayer/agent-runtimes/lib/apps/core';
import { SessionChooseDialog } from '@datalayer/agent-runtimes/lib/apps/plugins/chat/SessionChooseDialog';
import type { ChatSessionActions } from '@datalayer/agent-runtimes/lib/chat/Chat';
import {
  entryDescription,
  NO_FILTER,
  placeLabel,
  rowLabel,
  type SessionEntry,
  type SessionFilter,
  type SessionPlace,
} from '@datalayer/agent-runtimes/lib/portable/sessionList';
import { appSessionsClient } from '@datalayer/agent-runtimes/lib/portable/sessions';
import {
  type AppChatChoice,
  cellReadOf,
  notebookContextOf,
  type NotebookContext,
} from '../../shared/appChat';
import type {
  LocalRuntimeInfo,
  PendingApproval,
  SessionsListed,
} from '../../shared/types/ipc.types';
import type { MenuActionId } from '../../shared/types/shell.types';
import type { NotebookData, User } from '../../shared/types';
import AskTextDialog, {
  type TextQuestion,
} from '../components/sessions/AskTextDialog';
import DeploymentPicker from '../components/sessions/DeploymentPicker';
import SessionChat from '../components/sessions/SessionChat';
import SessionRowMenu from '../components/sessions/SessionRowMenu';
import WorkInFolderDialog from '../components/sessions/WorkInFolderDialog';
import {
  approvalsForChat,
  decisionSaid,
  waitingCount,
} from '../components/sessions/approvalsBanner';
import { WORK_IN_FOLDER_WORDS } from '../components/sessions/workInFolder';
import { setPageSessionWays } from '../plugins/sessionWays';
import {
  acceptedExtensionsOf,
  type ChatTarget,
  drawPlaces,
  entriesByUid,
  localPlaceOf,
  openDecision,
  PAGE_SIZE,
  SESSIONS_WORDS,
} from './sessionsPage';

/** The event App dispatches for a menu action the page answers. */
export const MENU_ACTION_EVENT = 'datalayer:menu-action';

/** Props for {@link Sessions}. */
export interface SessionsProps {
  isAuthenticated: boolean;
  user: User | null;
  /** The notebook the person last had in front, if one is still open. */
  frontNotebook: NotebookData | null;
}

/** A choice asked of the person by a menu entry (*Switch agent…*). */
type Choice = {
  question: Parameters<NonNullable<SessionActionContext['choose']>>[0];
  resolve: (id: string | undefined) => void;
};

/** A text asked of the person. */
type Asked = {
  question: TextQuestion;
  resolve: (text: string | undefined) => void;
};

const message = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Reads a notebook open in Desktop from its model: its path, its cell
 * count, its selected cell (A-20, D-10).
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
      ? {
          cell: cellReadOf(
            widget.activeCellIndex,
            active.model as unknown as Parameters<typeof cellReadOf>[1]
          ),
        }
      : {}),
  });
}

/**
 * The page.
 *
 * @param props - Component props.
 *
 * @returns React element.
 */
const Sessions: React.FC<SessionsProps> = ({
  isAuthenticated,
  user,
  frontNotebook,
}) => {
  const [listed, setListed] = useState<SessionsListed | null>(null);
  const [filter, setFilter] = useState<SessionFilter>(NO_FILTER);
  const [shown, setShown] = useState(PAGE_SIZE);
  const [running, setRunning] = useState<LocalRuntimeInfo[]>([]);
  const [deployments, setDeployments] = useState<AppChatChoice[] | null>(null);
  const [services, setServices] = useState<{
    aiAgentsUrl: string;
    spacerUrl: string;
  } | null>(null);
  const [deploymentsProblem, setDeploymentsProblem] = useState('');
  const [pending, setPending] = useState<PendingApproval[]>([]);
  const [target, setTarget] = useState<ChatTarget | null>(null);
  const [said, setSaid] = useState('');
  const [workInFolder, setWorkInFolder] = useState(false);
  const [pickDeployment, setPickDeployment] = useState(false);
  const [asked, setAsked] = useState<Asked | null>(null);
  const [choice, setChoice] = useState<Choice | null>(null);
  const entries = useContributions(LoopSessionAction);

  // The list, read on open, on a change either side says, and by the button.
  const refresh = useCallback(async () => {
    try {
      setListed(await window.desktopAPI.sessions.list(filter));
    } catch (error) {
      setSaid(message(error));
    }
  }, [filter]);

  const readRunning = useCallback(async () => {
    try {
      setRunning(await window.desktopAPI.localRuntime.list());
    } catch (error) {
      setSaid(message(error));
    }
  }, []);

  useEffect(() => {
    void refresh();
    void readRunning();
    const offSessions = window.desktopAPI.sessions.onChanged(() => {
      void refresh();
    });
    const offRuntimes = window.desktopAPI.localRuntime.onChanged(() => {
      void readRunning();
      void refresh();
    });
    return () => {
      offSessions();
      offRuntimes();
    };
  }, [refresh, readRunning]);

  // The person's applications on Datalayer (A-20's list, through the main process).
  const listDeployments = useCallback(async () => {
    if (!isAuthenticated) {
      setDeployments(null);
      setServices(null);
      setDeploymentsProblem('');
      return;
    }
    try {
      const answer = await window.appChatAPI.listDeployments();
      setDeployments(answer.deployments);
      setServices(answer.services);
      setDeploymentsProblem('');
    } catch (error) {
      setDeployments([]);
      setDeploymentsProblem(SESSIONS_WORDS.deploymentsRefused(message(error)));
    }
  }, [isAuthenticated]);

  useEffect(() => {
    void listDeployments();
  }, [listDeployments]);

  // The approvals waiting for the person, both places (DK-13).
  useEffect(() => {
    let live = true;
    window.desktopAPI.approvals
      .pending()
      .then(list => live && setPending(list))
      .catch(error => live && setSaid(message(error)));
    const off = window.desktopAPI.approvals.onChanged(list => setPending(list));
    return () => {
      live = false;
      off();
    };
  }, []);

  const entryOf = useMemo(
    () =>
      listed ? entriesByUid(listed.places) : new Map<string, SessionEntry>(),
    [listed]
  );

  // Opens a row: the decision, the folder's runtime started first when need be.
  const openEntry = useCallback(
    async (entry: SessionEntry) => {
      let decision = openDecision(entry, running, deployments ?? []);
      if (!decision.target && decision.startFolder) {
        setSaid(SESSIONS_WORDS.startingRuntime(decision.startFolder));
        try {
          const started = await window.desktopAPI.localRuntime.start(
            decision.startFolder
          );
          setRunning(current =>
            current.some(runtime => runtime.folder === started.folder)
              ? current
              : [...current, started]
          );
          decision = openDecision(
            entry,
            [...running, started],
            deployments ?? []
          );
        } catch (error) {
          setSaid(message(error));
          return;
        }
      }
      setSaid(decision.said);
      if (decision.target) {
        setTarget(decision.target);
      }
    },
    [running, deployments]
  );

  const openByUid = useCallback(
    (uid: string) => {
      const entry = entryOf.get(uid);
      if (entry) {
        void openEntry(entry);
      } else {
        void refresh();
      }
    },
    [entryOf, openEntry, refresh]
  );

  // A notification or the tray clicked: that session in front (DK-14).
  useEffect(() => window.desktopAPI.attention.onFocus(openByUid), [openByUid]);

  // The session in front, said to the menu and to the main process.
  useEffect(() => {
    void window.menuAPI?.setState({ sessionInFront: Boolean(target) });
    void window.desktopAPI.attention.front(target?.uid || null);
  }, [target]);

  // What the app's entries ask of the page (DK-10).
  const askText = useCallback(
    (title: string, value: string) =>
      new Promise<string | undefined>(resolve => {
        setAsked({
          question: { title, label: 'Title', value, confirm: 'Rename' },
          resolve,
        });
      }),
    []
  );
  useEffect(() => {
    setPageSessionWays({
      placeOf: uid =>
        uid === target?.uid ? target.place : entryOf.get(uid)?.place,
      askText,
    });
    return () => setPageSessionWays(null);
  }, [target, entryOf, askText]);

  // The ways the chat's entries use: the app's dialogs over IPC.
  const download = useCallback((name: string, text: string) => {
    window.desktopAPI.dialog
      .save(name, text)
      .then(saved => saved && setSaid(`Written to ${saved.path}.`))
      .catch(error => setSaid(message(error)));
  }, []);
  const pickFile = useCallback(
    async (accept: string) =>
      (await window.desktopAPI.dialog.openFile(acceptedExtensionsOf(accept)))
        ?.text,
    []
  );
  const choose = useCallback(
    (question: Choice['question']) =>
      new Promise<string | undefined>(resolve =>
        setChoice({ question, resolve })
      ),
    []
  );
  const sessionActions = useMemo<ChatSessionActions>(
    () => ({
      download,
      choose,
      pickFile,
      onSaid: sentence => {
        setSaid(sentence);
        void refresh();
      },
      onOpenThread: uid => {
        setTarget(current => (current ? { ...current, uid } : current));
        void refresh();
      },
    }),
    [download, choose, pickFile, refresh]
  );

  // A row's context: the runtime that answers for it, or none.
  const contextFor = useCallback(
    (entry: SessionEntry): SessionActionContext | null => {
      const baseUrl =
        entry.place.kind === 'local'
          ? entry.place.url
          : (deployments ?? []).flatMap(choice =>
              choice.kind === 'talk' &&
              choice.handle.appUid === entry.row.appUid
                ? [choice.handle.url]
                : []
            )[0];
      if (!baseUrl) {
        return null;
      }
      return {
        client: appSessionsClient({
          baseUrl,
          getAccessToken: () => undefined,
          fetch: (input, init) => fetch(input, init),
        }),
        say: sentence => {
          setSaid(sentence);
          void refresh();
        },
        openThread: uid => {
          void refresh().then(() => {
            const opened = entryOf.get(uid);
            if (opened) {
              void openEntry(opened);
            } else if (target) {
              setTarget({ ...target, uid });
            }
          });
        },
        download,
        choose,
        pickFile,
      };
    },
    [
      deployments,
      refresh,
      entryOf,
      openEntry,
      target,
      download,
      choose,
      pickFile,
    ]
  );

  // The chat in front: its approvals, its decisions through the main process.
  const chatInFront = useMemo(
    () =>
      target
        ? {
            place: target.place as SessionPlace,
            agentId:
              target.kind === 'local' ? target.agent : target.handle.agentId,
          }
        : null,
    [target]
  );
  const chatApprovals = useMemo(
    () => approvalsForChat(pending, chatInFront),
    [pending, chatInFront]
  );
  const decideApproval = useCallback(
    async (approvalId: string, approved: boolean) => {
      if (!chatInFront) {
        return;
      }
      const decided = await window.desktopAPI.approvals.decide({
        place: chatInFront.place,
        id: approvalId,
        decision: approved ? 'approve' : 'reject',
      });
      setSaid(decisionSaid(decided));
      setPending(await window.desktopAPI.approvals.pending());
    },
    [chatInFront]
  );

  const readNotebook = useCallback(
    async (): Promise<NotebookContext | undefined> =>
      frontNotebook ? readOpenNotebook(frontNotebook) : undefined,
    [frontNotebook]
  );

  // The menu's actions (DK-04), dispatched by App.
  const runEntry = useCallback(
    async (id: string) => {
      if (!target) {
        setSaid(SESSIONS_WORDS.pickASession);
        return;
      }
      const entry = entries.find(item => item.value.id === id)?.value;
      const context = contextFor({
        row: {
          uid: target.uid,
          appUid: target.kind === 'datalayer' ? target.handle.appUid : '',
        } as SessionEntry['row'],
        application: { key: '', name: '' },
        workspace: '',
        place: target.place,
        elsewhere: false,
      });
      if (!entry || !context) {
        setSaid(SESSIONS_WORDS.pickASession);
        return;
      }
      try {
        const facts = await context.client.described(target.uid);
        await entry.run(facts, context);
      } catch (error) {
        setSaid(message(error));
      }
    },
    [target, entries, contextFor]
  );
  const targetRef = useRef(target);
  targetRef.current = target;
  useEffect(() => {
    const onAction = (event: Event) => {
      const action = (event as CustomEvent<MenuActionId>).detail;
      switch (action) {
        case 'work-in-folder':
          setWorkInFolder(true);
          break;
        case 'new-datalayer-session':
          setPickDeployment(true);
          break;
        case 'import-session':
          void runEntry('import');
          break;
        case 'export-session':
          void runEntry('export');
          break;
        case 'open-in-studio':
          void runEntry('desktop-open-in-studio');
          break;
        case 'resume-last-session': {
          const first = listed?.places
            .flatMap(place => place.groups)
            .flatMap(group => group.sessions)
            .find(entry => entry.row.state !== 'ended');
          if (first) {
            void openEntry(first);
          } else {
            setSaid(SESSIONS_WORDS.pickASession);
          }
          break;
        }
        case 'stop-local-runtime':
          window.desktopAPI.localRuntime
            .stop()
            .then(() => {
              if (targetRef.current?.kind === 'local') {
                setTarget(null);
              }
            })
            .catch(error => setSaid(message(error)));
          break;
        default:
          break;
      }
    };
    window.addEventListener(MENU_ACTION_EVENT, onAction);
    return () => window.removeEventListener(MENU_ACTION_EVENT, onAction);
  }, [runEntry, listed, openEntry]);

  const typeCredential = useCallback(
    (name: string) =>
      new Promise<void>(resolve => {
        setAsked({
          question: {
            title: `${name}`,
            label: name,
            value: '',
            says: WORK_IN_FOLDER_WORDS.credentialAsked(name),
            secret: true,
            confirm: 'Keep',
          },
          resolve: text => {
            if (text === undefined) {
              resolve();
              return;
            }
            window.desktopAPI.credentials
              .set(name, text)
              .then(() => setSaid(WORK_IN_FOLDER_WORDS.credentialKept(name)))
              .catch(error => setSaid(message(error)))
              .finally(resolve);
          },
        });
      }),
    []
  );

  const drawn = useMemo(
    () => (listed ? drawPlaces(listed.places, shown) : null),
    [listed, shown]
  );

  return (
    <Box
      sx={{ display: 'flex', height: '100%', minHeight: 0 }}
      data-testid="sessions"
    >
      <Box
        sx={{
          width: 380,
          flexShrink: 0,
          borderRight: '1px solid',
          borderColor: 'border.default',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        <Box
          sx={{
            p: 3,
            borderBottom: '1px solid',
            borderColor: 'border.default',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Heading as="h2" sx={{ fontSize: 2, m: 0, flex: 1 }}>
              {SESSIONS_WORDS.title}
            </Heading>
            <IconButton
              icon={SyncIcon}
              aria-label={SESSIONS_WORDS.refresh}
              variant="invisible"
              size="small"
              onClick={() => {
                void refresh();
                void readRunning();
                void listDeployments();
              }}
            />
          </Box>
          <Box sx={{ display: 'flex', gap: 2, mt: 2, flexWrap: 'wrap' }}>
            <Button
              leadingVisual={FileDirectoryIcon}
              size="small"
              onClick={() => setWorkInFolder(true)}
            >
              {SESSIONS_WORDS.workInFolder}
            </Button>
            <Button
              leadingVisual={PlusIcon}
              size="small"
              disabled={!isAuthenticated}
              onClick={() => setPickDeployment(true)}
            >
              {SESSIONS_WORDS.newOnDatalayer}
            </Button>
          </Box>
          <Box sx={{ mt: 2, display: 'grid', gap: 2 }}>
            <SegmentedControl
              aria-label={SESSIONS_WORDS.filters}
              size="small"
              onChange={index =>
                setFilter(current => ({
                  ...current,
                  place: (['', 'datalayer', 'local'] as const)[index],
                }))
              }
            >
              <SegmentedControl.Button selected={filter.place === ''}>
                {SESSIONS_WORDS.anyPlace}
              </SegmentedControl.Button>
              <SegmentedControl.Button selected={filter.place === 'datalayer'}>
                {SESSIONS_WORDS.onDatalayer}
              </SegmentedControl.Button>
              <SegmentedControl.Button selected={filter.place === 'local'}>
                {SESSIONS_WORDS.onThisMachine}
              </SegmentedControl.Button>
            </SegmentedControl>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl sx={{ flex: 1 }}>
                <FormControl.Label visuallyHidden>State</FormControl.Label>
                <Select
                  size="small"
                  value={filter.state}
                  onChange={event =>
                    setFilter(current => ({
                      ...current,
                      state: event.target.value as SessionFilter['state'],
                    }))
                  }
                >
                  <Select.Option value="">
                    {SESSIONS_WORDS.anyState}
                  </Select.Option>
                  <Select.Option value="open">Open</Select.Option>
                  <Select.Option value="paused">Paused</Select.Option>
                  <Select.Option value="ended">Ended</Select.Option>
                </Select>
              </FormControl>
              <FormControl sx={{ flex: 1 }}>
                <FormControl.Label visuallyHidden>
                  {SESSIONS_WORDS.app}
                </FormControl.Label>
                <TextInput
                  size="small"
                  placeholder={SESSIONS_WORDS.app}
                  value={filter.app}
                  onChange={event =>
                    setFilter(current => ({
                      ...current,
                      app: event.target.value,
                    }))
                  }
                />
              </FormControl>
              <FormControl sx={{ flex: 1 }}>
                <FormControl.Label visuallyHidden>
                  {SESSIONS_WORDS.titleFilter}
                </FormControl.Label>
                <TextInput
                  size="small"
                  placeholder={SESSIONS_WORDS.titleFilter}
                  value={filter.title}
                  onChange={event =>
                    setFilter(current => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                />
              </FormControl>
            </Box>
          </Box>
          {pending.length > 0 ? (
            <Text
              as="p"
              sx={{ mt: 2, mb: 0, fontSize: 0, color: 'attention.fg' }}
            >
              {SESSIONS_WORDS.waiting(waitingCount(pending))}
            </Text>
          ) : null}
        </Box>
        <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          {!isAuthenticated ? (
            <Text as="p" sx={{ px: 3, py: 2, color: 'fg.muted', fontSize: 0 }}>
              {SESSIONS_WORDS.signedOut}
            </Text>
          ) : null}
          {drawn ? (
            <ActionList
              aria-label={SESSIONS_WORDS.title}
              selectionVariant="single"
            >
              {drawn.places.map(place => (
                <ActionList.Group key={placeLabel(place.place)}>
                  <ActionList.GroupHeading>
                    {placeLabel(place.place)}
                  </ActionList.GroupHeading>
                  {place.note ? (
                    <ActionList.Item disabled>
                      <Text sx={{ fontSize: 0 }}>{place.note}</Text>
                    </ActionList.Item>
                  ) : null}
                  {place.groups.map(group =>
                    group.sessions.map(entry => (
                      <ActionList.Item
                        key={`${placeLabel(place.place)}-${entry.row.uid}`}
                        selected={target?.uid === entry.row.uid}
                        onSelect={() => void openEntry(entry)}
                        data-session-row={entry.row.uid}
                      >
                        {rowLabel(entry.row)}
                        <ActionList.Description variant="block">
                          {group.application.name} · {entryDescription(entry)}
                        </ActionList.Description>
                        <ActionList.TrailingVisual>
                          <SessionRowMenu
                            entry={entry}
                            onOpen={() => void openEntry(entry)}
                            context={contextFor(entry)}
                          />
                        </ActionList.TrailingVisual>
                      </ActionList.Item>
                    ))
                  )}
                </ActionList.Group>
              ))}
            </ActionList>
          ) : null}
          {drawn && drawn.left > 0 ? (
            <Box sx={{ p: 2 }}>
              <Button
                size="small"
                onClick={() => setShown(current => current + PAGE_SIZE)}
              >
                {SESSIONS_WORDS.showMore(drawn.left)}
              </Button>
            </Box>
          ) : null}
        </Box>
      </Box>
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minWidth: 0,
          minHeight: 0,
        }}
      >
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
          {target ? (
            <SessionChat
              target={target}
              services={services}
              user={user}
              readNotebook={readNotebook}
              sessionActions={sessionActions}
              pendingApprovals={chatApprovals}
              decideApproval={decideApproval}
              onTurn={phase => {
                if (phase === 'answered') {
                  void refresh();
                }
              }}
            />
          ) : (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                p: 3,
              }}
            >
              <Text sx={{ color: 'fg.muted' }}>
                {SESSIONS_WORDS.pickASession}
              </Text>
            </Box>
          )}
        </Box>
        {said ? (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              px: 3,
              py: 1,
              borderTop: '1px solid',
              borderColor: 'border.default',
              fontSize: 0,
            }}
            data-testid="sessions-said"
          >
            <Text sx={{ flex: 1 }}>{said}</Text>
            <IconButton
              icon={XIcon}
              aria-label="Dismiss"
              variant="invisible"
              size="small"
              onClick={() => setSaid('')}
            />
          </Box>
        ) : null}
      </Box>
      {workInFolder ? (
        <WorkInFolderDialog
          recent={listed?.folders.folders ?? []}
          typeCredential={typeCredential}
          onStarted={(started, runtime) => {
            setWorkInFolder(false);
            setRunning(current =>
              current.some(item => item.folder === runtime.folder)
                ? current
                : [...current, runtime]
            );
            setTarget(started);
            setSaid(SESSIONS_WORDS.opened(started.title, 'Open'));
            void refresh();
          }}
          onClose={() => setWorkInFolder(false)}
        />
      ) : null}
      {pickDeployment ? (
        <DeploymentPicker
          choices={deployments}
          problem={deploymentsProblem}
          onRefresh={() => void listDeployments()}
          onPick={handle => {
            setPickDeployment(false);
            setTarget({
              kind: 'datalayer',
              uid: '',
              handle,
              place: { kind: 'datalayer' },
              title: handle.name,
              state: 'open',
            });
            setSaid('');
          }}
          onClose={() => setPickDeployment(false)}
        />
      ) : null}
      {asked ? (
        <AskTextDialog
          question={asked.question}
          onAnswer={text => {
            setAsked(null);
            asked.resolve(text);
          }}
        />
      ) : null}
      {choice ? (
        <SessionChooseDialog
          question={choice.question}
          onPick={id => {
            setChoice(null);
            choice.resolve(id);
          }}
        />
      ) : null}
    </Box>
  );
};

export default Sessions;

/** A running local runtime as a place, for the page's callers. */
export { localPlaceOf };
