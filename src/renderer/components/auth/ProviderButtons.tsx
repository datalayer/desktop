/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Sign in with a provider (DESKTOP DK-03): GitHub or Google, opened by
 * the main process in the Studio view; the renderer only asks, and shows
 * the sentence a sign-in ended in when it did not sign the person in.
 *
 * @module renderer/components/auth/ProviderButtons
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Box, Button, Text } from '@primer/react';
import { MarkGithubIcon, GlobeIcon } from '@primer/octicons-react';
import type { SignInProvider } from '../../../shared/types/shell.types';

export interface ProviderButtonsProps {
  /** Told the sentence a sign-in ended in. */
  onFailed: (sentence: string) => void;
  /** Nothing is asked while a typed sign-in runs. */
  disabled?: boolean;
}

/** The providers offered, in order. */
export const OFFERED_PROVIDERS: ReadonlyArray<{
  provider: SignInProvider;
  label: string;
}> = [
  { provider: 'github', label: 'Sign in with GitHub' },
  { provider: 'google', label: 'Sign in with Google' },
];

/**
 * The provider buttons and their divider.
 */
const ProviderButtons: React.FC<ProviderButtonsProps> = ({
  onFailed,
  disabled = false,
}) => {
  const [starting, setStarting] = useState<SignInProvider | null>(null);

  useEffect(() => {
    if (!window.signInAPI) {
      return;
    }
    window.signInAPI.onFailed(sentence => {
      setStarting(null);
      onFailed(sentence);
    });
    return () => {
      window.signInAPI?.removeFailedListener();
    };
  }, [onFailed]);

  const start = useCallback(
    async (provider: SignInProvider) => {
      if (!window.signInAPI) {
        onFailed('Sign-in with a provider is not available here.');
        return;
      }
      setStarting(provider);
      const started = await window.signInAPI.start(provider);
      if (!started.ok) {
        setStarting(null);
        onFailed(started.sentence);
      }
    },
    [onFailed]
  );

  return (
    <Box sx={{ mb: 3 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {OFFERED_PROVIDERS.map(({ provider, label }) => (
          <Button
            key={provider}
            size="large"
            block
            disabled={disabled || starting !== null}
            leadingVisual={provider === 'github' ? MarkGithubIcon : GlobeIcon}
            onClick={() => start(provider)}
            aria-label={label}
            data-testid={`sign-in-${provider}`}
          >
            {starting === provider ? 'Opening Datalayer…' : label}
          </Button>
        ))}
      </Box>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          my: 3,
          color: 'fg.muted',
        }}
      >
        <Box
          sx={{ flex: 1, borderTop: '1px solid', borderColor: 'border.muted' }}
        />
        <Text sx={{ fontSize: 0 }}>or with a token</Text>
        <Box
          sx={{ flex: 1, borderTop: '1px solid', borderColor: 'border.muted' }}
        />
      </Box>
    </Box>
  );
};

export default ProviderButtons;
