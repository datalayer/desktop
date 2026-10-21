/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * An application's Build, native (DESKTOP DK-02): its Appspec read from
 * its Spacer item — the facts, the problems agent-runtimes' reader found,
 * the YAML its writer gives — read-only; editing, validating and shipping
 * are the web Apps', opened on datalayer.ai.
 *
 * @module renderer/components/apps/AppsBuild
 */

import React from 'react';
import { Box, Flash, Heading, Text } from '@primer/react';
import type { AppDocument } from '../../../shared/apps';
import { buildViewOf, APPS_WORDS } from '../../pages/appsPage';
import OpenOnWeb from './OpenOnWeb';

/** Props for {@link AppsBuild}. */
export interface AppsBuildProps {
  document: AppDocument;
  /** The web Apps' Build of this application. */
  webUrl: string;
}

const AppsBuild: React.FC<AppsBuildProps> = ({ document, webUrl }) => {
  const view = buildViewOf(document);
  return (
    <Box sx={{ display: 'grid', gap: 3 }} data-testid="apps-build">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Text sx={{ flex: 1, color: 'fg.muted', fontSize: 1 }}>
          {APPS_WORDS.buildReadOnly}
        </Text>
        <OpenOnWeb url={webUrl} label={APPS_WORDS.openOnWeb} />
      </Box>
      {view.kind === 'none' ? (
        <Flash variant="warning">{view.sentence}</Flash>
      ) : (
        <>
          <Box
            as="dl"
            sx={{
              display: 'grid',
              gridTemplateColumns: 'max-content 1fr',
              columnGap: 3,
              rowGap: 1,
              m: 0,
            }}
          >
            {view.facts.map(fact => (
              <React.Fragment key={fact.label}>
                <Text as="dt" sx={{ color: 'fg.muted', fontSize: 1 }}>
                  {fact.label}
                </Text>
                <Text as="dd" sx={{ m: 0, fontSize: 1 }}>
                  {fact.value}
                </Text>
              </React.Fragment>
            ))}
          </Box>
          {view.problems.length > 0 ? (
            <Flash variant="warning">
              {view.problems.map(problem => (
                <Text as="p" key={problem} sx={{ m: 0 }}>
                  {problem}
                </Text>
              ))}
            </Flash>
          ) : null}
          <Box>
            <Heading as="h3" sx={{ fontSize: 1, mb: 1 }}>
              {APPS_WORDS.yamlTitle}
            </Heading>
            <Box
              as="pre"
              sx={{
                m: 0,
                p: 2,
                fontFamily: 'mono',
                fontSize: 0,
                bg: 'canvas.subtle',
                border: '1px solid',
                borderColor: 'border.default',
                borderRadius: 2,
                overflow: 'auto',
                maxHeight: 480,
              }}
            >
              {view.yaml}
            </Box>
          </Box>
        </>
      )}
    </Box>
  );
};

export default AppsBuild;
