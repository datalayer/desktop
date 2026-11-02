/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * *Open on datalayer.ai* (DESKTOP DK-02): what the native Apps does not
 * offer, opened in the OS browser on the landing's Apps.
 *
 * @module renderer/components/apps/OpenOnWeb
 */

import React from 'react';
import { Button } from '@primer/react';
import { LinkExternalIcon } from '@primer/octicons-react';

/** Props for {@link OpenOnWeb}. */
export interface OpenOnWebProps {
  /** The web Apps' page. */
  url: string;
  /** The button's words. */
  label: string;
  size?: 'small' | 'medium';
}

/** A button that opens the page in the OS browser. */
const OpenOnWeb: React.FC<OpenOnWebProps> = ({ url, label, size }) => (
  <Button
    size={size ?? 'small'}
    trailingVisual={LinkExternalIcon}
    onClick={() => window.electronAPI?.openExternal(url)}
    data-web-url={url}
  >
    {label}
  </Button>
);

export default OpenOnWeb;
