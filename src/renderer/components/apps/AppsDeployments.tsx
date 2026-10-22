/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * An application's Deployments, native (DESKTOP DK-02): each one's
 * target, address, state, version and kept runtime, with the one change
 * the tab makes — pause a live one, resume a paused one, for the version it
 * runs (ai-agents' `PATCH /apps/deployments/{uid}`, through the main
 * process). Shipping a version, rolling back, access and reset are the web
 * Apps' Ship tab.
 *
 * @module renderer/components/apps/AppsDeployments
 */

import React from 'react';
import { Box, Button, Text } from '@primer/react';
import { type DeploymentRow, APPS_WORDS } from '../../pages/appsPage';
import OpenOnWeb from './OpenOnWeb';

/** Props for {@link AppsDeployments}. */
export interface AppsDeploymentsProps {
  rows: DeploymentRow[];
  /** The deployment whose change is in flight. */
  changing: string | null;
  onChange: (row: DeploymentRow) => void;
  /** The web Apps' Ship tab of this application. */
  webUrl: string;
}

const AppsDeployments: React.FC<AppsDeploymentsProps> = ({
  rows,
  changing,
  onChange,
  webUrl,
}) => (
  <Box sx={{ display: 'grid', gap: 2 }} data-testid="apps-deployments">
    <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
      <OpenOnWeb url={webUrl} label={APPS_WORDS.openOnWeb} />
    </Box>
    {rows.length === 0 ? (
      <Text as="p" sx={{ color: 'fg.muted', fontSize: 1 }}>
        {APPS_WORDS.noDeployment}
      </Text>
    ) : (
      <Box
        as="ul"
        aria-label={APPS_WORDS.sections.deployments}
        sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 2 }}
      >
        {rows.map(row => (
          <Box
            as="li"
            key={row.deployment.uid}
            data-deployment-row={row.deployment.uid}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 2,
              p: 2,
              border: '1px solid',
              borderColor: 'border.default',
              borderRadius: 2,
            }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Text sx={{ display: 'block', fontWeight: 'semibold' }}>
                {row.title}
              </Text>
              <Text sx={{ display: 'block', fontSize: 0, color: 'fg.muted' }}>
                {row.said}
              </Text>
            </Box>
            {row.action ? (
              <Button
                size="small"
                disabled={changing !== null}
                onClick={() => onChange(row)}
              >
                {row.action === 'pause' ? APPS_WORDS.pause : APPS_WORDS.resume}
              </Button>
            ) : null}
          </Box>
        ))}
      </Box>
    )}
  </Box>
);

export default AppsDeployments;
