/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * The Studio, native (DESKTOP DK-02): the app's own React page, as the
 * Sessions page is — no web page embedded. On the left the person's
 * applications (Spacer's, through the main process's `studio:apps`), each
 * with what its deployments say; on the right the one picked, on four
 * sections: **Build** (its Appspec read, read-only), **Try** (its chat on
 * the runtime a deployment keeps, `AppChat`), **Activity** (its sessions
 * from the Sessions page's list, with their lineage; a row opens it in
 * Sessions) and **Deployments** (each one's state; pause and resume for
 * the version it runs). What only the web Studio has — editing, Validate,
 * Ship, the Preview of a draft, usage — is opened on datalayer.ai.
 *
 * *Open in the Studio* (a session's menu, the app menu) brings this page
 * to the front on the session's application, on Activity.
 *
 * @module renderer/pages/Studio
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActionList,
  Box,
  Heading,
  IconButton,
  SegmentedControl,
  Text,
} from '@primer/react';
import { SyncIcon } from '@primer/octicons-react';
import {
  NO_FILTER,
  type PlaceGroup,
} from '@datalayer/agent-runtimes/lib/portable/sessionList';
import type { AppChatChoice } from '../../shared/appChat';
import {
  studioWebUrl,
  toggledStateOf,
  type StudioAppDocument,
  type StudioAppsListed,
  type StudioDeployment,
} from '../../shared/studio';
import type { User } from '../../shared/types';
import OpenOnWeb from '../components/studio/OpenOnWeb';
import StudioActivity from '../components/studio/StudioActivity';
import StudioBuild from '../components/studio/StudioBuild';
import StudioDeployments from '../components/studio/StudioDeployments';
import StudioTry from '../components/studio/StudioTry';
import {
  activityRowsOf,
  appRowsOf,
  closedSentencesOf,
  deploymentRowsOf,
  deploymentsOf,
  type DeploymentRow,
  STUDIO_WORDS,
} from './studioPage';
import {
  OPEN_STUDIO_EVENT,
  requestSessionOpen,
  STUDIO_SECTIONS,
  type StudioOpenRequest,
  type StudioSection,
  takeStudioOpen,
} from './studioEvents';

/** Props for {@link Studio}. */
export interface StudioProps {
  isAuthenticated: boolean;
  user: User | null;
}

const message = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/** The web Studio's tab for each section. */
const WEB_TAB = {
  build: 'build',
  try: 'try',
  activity: 'activity',
  deployments: 'ship',
} as const;

const Studio: React.FC<StudioProps> = ({ isAuthenticated, user }) => {
  const [listed, setListed] = useState<StudioAppsListed | null>(null);
  const [listProblem, setListProblem] = useState('');
  const [deployments, setDeployments] = useState<StudioDeployment[] | null>(
    null
  );
  const [choices, setChoices] = useState<AppChatChoice[] | null>(null);
  const [services, setServices] = useState<{
    aiAgentsUrl: string;
    spacerUrl: string;
  } | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const [section, setSection] = useState<StudioSection>('build');
  const [document, setDocument] = useState<StudioAppDocument | null>(null);
  const [documentProblem, setDocumentProblem] = useState('');
  const [places, setPlaces] = useState<PlaceGroup[] | null>(null);
  const [activityProblem, setActivityProblem] = useState('');
  const [changing, setChanging] = useState<string | null>(null);
  const [said, setSaid] = useState('');

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      return;
    }
    setListProblem('');
    const [apps, listedDeployments, talkable] = await Promise.allSettled([
      window.desktopAPI.studio.apps(),
      window.desktopAPI.studio.deployments(),
      window.appChatAPI.listDeployments(),
    ]);
    if (apps.status === 'fulfilled') {
      setListed(apps.value);
    } else {
      setListProblem(message(apps.reason));
    }
    if (listedDeployments.status === 'fulfilled') {
      setDeployments(listedDeployments.value);
    } else {
      setDeployments([]);
      setSaid(message(listedDeployments.reason));
    }
    if (talkable.status === 'fulfilled') {
      setChoices(talkable.value.deployments);
      setServices(talkable.value.services);
    } else {
      setChoices([]);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setListed(null);
      setDeployments(null);
      setChoices(null);
      setPicked(null);
      return;
    }
    void refresh();
  }, [isAuthenticated, refresh]);

  // *Open in the Studio*: the application on a section, asked before or
  // while the page is mounted.
  useEffect(() => {
    const open = (request: StudioOpenRequest | null) => {
      if (request) {
        setPicked(request.appUid);
        setSection(request.section);
      }
    };
    open(takeStudioOpen());
    const listener = () => open(takeStudioOpen());
    window.addEventListener(OPEN_STUDIO_EVENT, listener);
    return () => window.removeEventListener(OPEN_STUDIO_EVENT, listener);
  }, []);

  // The application picked, read.
  useEffect(() => {
    setDocument(null);
    setDocumentProblem('');
    if (!picked || !isAuthenticated) {
      return;
    }
    let alive = true;
    window.desktopAPI.studio
      .app(picked)
      .then(read => alive && setDocument(read))
      .catch(error => alive && setDocumentProblem(message(error)));
    return () => {
      alive = false;
    };
  }, [picked, isAuthenticated]);

  // Its sessions, from the Sessions page's list, kept up to date.
  useEffect(() => {
    setPlaces(null);
    setActivityProblem('');
    if (!picked || !isAuthenticated) {
      return;
    }
    let alive = true;
    const read = () =>
      window.desktopAPI.sessions
        .list({ ...NO_FILTER, app: picked })
        .then(list => alive && setPlaces(list.places))
        .catch(error => alive && setActivityProblem(message(error)));
    void read();
    const off = window.desktopAPI.sessions.onChanged(() => void read());
    return () => {
      alive = false;
      off();
    };
  }, [picked, isAuthenticated]);

  const rows = useMemo(
    () => appRowsOf(listed?.apps ?? [], deployments),
    [listed, deployments]
  );
  const pickedApp = listed?.apps.find(app => app.uid === picked) ?? null;
  const own = useMemo(
    () => (picked && deployments ? deploymentsOf(deployments, picked) : []),
    [picked, deployments]
  );
  const activity = useMemo(
    () => (places && picked ? activityRowsOf(places, picked) : null),
    [places, picked]
  );
  const landing = listed?.landing ?? '';
  const webUrl = (of: StudioSection) =>
    picked ? studioWebUrl(landing, picked, WEB_TAB[of]) : '';

  const change = useCallback(async (row: DeploymentRow) => {
    setChanging(row.deployment.uid);
    setSaid('');
    try {
      const changed = await window.desktopAPI.studio.setDeploymentState(
        toggledStateOf(row.deployment)
      );
      setDeployments(current =>
        (current ?? []).map(one => (one.uid === changed.uid ? changed : one))
      );
      setSaid(
        changed.state === 'paused'
          ? STUDIO_WORDS.paused(changed.appName, changed.version)
          : STUDIO_WORDS.resumed(changed.appName, changed.version)
      );
      const talkable = await window.appChatAPI.listDeployments();
      setChoices(talkable.deployments);
    } catch (error) {
      setSaid(message(error));
    } finally {
      setChanging(null);
    }
  }, []);

  return (
    <Box
      sx={{ display: 'flex', height: '100%', minHeight: 0 }}
      data-testid="studio-page"
    >
      <Box
        sx={{
          width: 320,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid',
          borderColor: 'border.default',
          minHeight: 0,
        }}
      >
        <Box sx={{ p: 3, pb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Heading as="h2" sx={{ fontSize: 2, m: 0, flex: 1 }}>
              {STUDIO_WORDS.title}
            </Heading>
            <IconButton
              icon={SyncIcon}
              aria-label={STUDIO_WORDS.refresh}
              size="small"
              variant="invisible"
              disabled={!isAuthenticated}
              onClick={() => void refresh()}
            />
          </Box>
          {landing ? (
            <Box sx={{ mt: 2 }}>
              <OpenOnWeb
                url={studioWebUrl(landing)}
                label={STUDIO_WORDS.newOnWeb}
              />
            </Box>
          ) : null}
        </Box>
        <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
          {!isAuthenticated ? (
            <Text as="p" sx={{ px: 3, color: 'fg.muted', fontSize: 1 }}>
              {STUDIO_WORDS.signedOut}
            </Text>
          ) : listProblem ? (
            <Text as="p" sx={{ px: 3, color: 'danger.fg', fontSize: 1 }}>
              {listProblem}
            </Text>
          ) : !listed ? (
            <Text as="p" sx={{ px: 3, color: 'fg.muted', fontSize: 1 }}>
              {STUDIO_WORDS.loading}
            </Text>
          ) : rows.length === 0 ? (
            <Text as="p" sx={{ px: 3, color: 'fg.muted', fontSize: 1 }}>
              {STUDIO_WORDS.none}
            </Text>
          ) : (
            <ActionList
              aria-label={STUDIO_WORDS.title}
              selectionVariant="single"
            >
              {rows.map(row => (
                <ActionList.Item
                  key={row.app.uid}
                  selected={picked === row.app.uid}
                  onSelect={() => setPicked(row.app.uid)}
                  data-app-row={row.app.uid}
                >
                  {row.app.name}
                  {row.said || row.app.description ? (
                    <ActionList.Description variant="block">
                      {[row.said, row.app.description]
                        .filter(Boolean)
                        .join(' · ')}
                    </ActionList.Description>
                  ) : null}
                </ActionList.Item>
              ))}
            </ActionList>
          )}
        </Box>
      </Box>
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        {!picked ? (
          <Box
            sx={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              p: 4,
            }}
          >
            <Box sx={{ maxWidth: 520 }}>
              <Heading as="h2" sx={{ fontSize: 3, mb: 1 }}>
                {STUDIO_WORDS.pickOne}
              </Heading>
              <Text as="p" sx={{ color: 'fg.muted' }}>
                {STUDIO_WORDS.pickOneSaid}
              </Text>
            </Box>
          </Box>
        ) : (
          <>
            <Box
              sx={{
                p: 3,
                pb: 2,
                borderBottom: '1px solid',
                borderColor: 'border.default',
              }}
            >
              <Heading as="h2" sx={{ fontSize: 3, m: 0 }}>
                {document?.name || pickedApp?.name || picked}
              </Heading>
              {document?.description || pickedApp?.description ? (
                <Text as="p" sx={{ color: 'fg.muted', mt: 1, mb: 0 }}>
                  {document?.description || pickedApp?.description}
                </Text>
              ) : null}
              <SegmentedControl
                aria-label="Section"
                sx={{ mt: 2 }}
                onChange={index => setSection(STUDIO_SECTIONS[index])}
              >
                {STUDIO_SECTIONS.map(one => (
                  <SegmentedControl.Button key={one} selected={section === one}>
                    {STUDIO_WORDS.sections[one]}
                  </SegmentedControl.Button>
                ))}
              </SegmentedControl>
              {said ? (
                <Text
                  as="p"
                  sx={{ mt: 2, mb: 0, fontSize: 1, color: 'fg.muted' }}
                >
                  {said}
                </Text>
              ) : null}
            </Box>
            <Box sx={{ flex: 1, overflow: 'auto', minHeight: 0, p: 3 }}>
              {section === 'build' ? (
                documentProblem ? (
                  <Text as="p" sx={{ color: 'danger.fg' }}>
                    {documentProblem}
                  </Text>
                ) : document ? (
                  <StudioBuild document={document} webUrl={webUrl('build')} />
                ) : (
                  <Text as="p" sx={{ color: 'fg.muted' }}>
                    {STUDIO_WORDS.readingApp}
                  </Text>
                )
              ) : null}
              {section === 'try' ? (
                <StudioTry
                  appUid={picked}
                  choices={choices}
                  closed={closedSentencesOf(choices ?? [], own)}
                  services={services}
                  user={user}
                  webUrl={webUrl('try')}
                />
              ) : null}
              {section === 'activity' ? (
                <StudioActivity
                  rows={activity}
                  problem={activityProblem}
                  onOpen={requestSessionOpen}
                  webUrl={webUrl('activity')}
                />
              ) : null}
              {section === 'deployments' ? (
                <StudioDeployments
                  rows={deploymentRowsOf(own)}
                  changing={changing}
                  onChange={row => void change(row)}
                  webUrl={webUrl('deployments')}
                />
              ) : null}
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
};

export default Studio;
