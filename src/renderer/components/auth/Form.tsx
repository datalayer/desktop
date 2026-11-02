/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Login form: a handle and a password by default; the Run URL and an API
 * token under *More options*.
 *
 * @module Form
 */

import React, { useState } from 'react';
import {
  FormControl,
  TextInput,
  Text,
  Button as PrimerButton,
} from '@primer/react';
import { COLORS } from '../../../shared/constants/colors';
import { LoginFormProps } from '../../../shared/types';
import Button from './Button';

/**
 * Renders the login form: Handle and Password, or (under More options) the
 * Run URL and, in the token way, the API token.
 */
const Form: React.FC<LoginFormProps> = ({
  formData,
  state,
  onFormDataChange,
  onSubmit,
  onKeyPress,
  way,
  onWayChange,
}) => {
  const [moreOptions, setMoreOptions] = useState(false);
  const focusRing = {
    '&:focus-visible': {
      outline: '2px solid',
      outlineColor: COLORS.brand.primary,
      outlineOffset: '2px',
    },
  };
  const ready =
    Boolean(formData.runUrl) &&
    (way === 'password'
      ? Boolean(formData.handle && formData.password)
      : Boolean(formData.token));
  return (
    <form
      onSubmit={e => {
        e.preventDefault();
        onSubmit();
      }}
      noValidate
      aria-label="Datalayer authentication form"
    >
      <fieldset
        disabled={state.loading}
        style={{ border: 'none', padding: 0, margin: 0 }}
      >
        <legend
          style={{
            position: 'absolute',
            width: '1px',
            height: '1px',
            padding: '0',
            margin: '-1px',
            overflow: 'hidden',
            clip: 'rect(0, 0, 0, 0)',
            whiteSpace: 'nowrap',
            border: '0',
          }}
        >
          Login credentials
        </legend>

        {way === 'password' ? (
          <>
            <FormControl sx={{ mb: 2 }} required id="handle-input">
              <FormControl.Label htmlFor="handle-input">
                Handle
              </FormControl.Label>
              <TextInput
                block
                size="large"
                value={formData.handle}
                onChange={e => onFormDataChange('handle', e.target.value)}
                onKeyPress={onKeyPress}
                placeholder="Your Datalayer handle"
                autoComplete="username"
                sx={focusRing}
              />
            </FormControl>
            <FormControl sx={{ mb: 3 }} required id="password-input">
              <FormControl.Label htmlFor="password-input">
                Password
              </FormControl.Label>
              <TextInput
                block
                size="large"
                type="password"
                value={formData.password}
                onChange={e => onFormDataChange('password', e.target.value)}
                onKeyPress={onKeyPress}
                placeholder="Your password"
                autoComplete="current-password"
                sx={focusRing}
              />
            </FormControl>
          </>
        ) : null}

        <PrimerButton
          variant="invisible"
          size="small"
          aria-expanded={moreOptions}
          onClick={() => {
            const next = !moreOptions;
            setMoreOptions(next);
            if (!next) {
              onWayChange('password');
            }
          }}
          sx={{ mb: 2, px: 0 }}
        >
          {moreOptions ? 'Fewer options' : 'More options'}
        </PrimerButton>

        {moreOptions ? (
          <>
            <FormControl sx={{ mb: 2 }} required id="run-url-input">
              <FormControl.Label htmlFor="run-url-input">
                Run URL
              </FormControl.Label>
              <TextInput
                block
                size="large"
                value={formData.runUrl}
                onChange={e => onFormDataChange('runUrl', e.target.value)}
                onKeyPress={onKeyPress}
                placeholder="https://prod1.datalayer.run"
                aria-describedby="run-url-help"
                aria-invalid={
                  !formData.runUrl && state.error ? 'true' : 'false'
                }
                sx={focusRing}
              />
              <FormControl.Caption id="run-url-help">
                The URL of your Datalayer instance (required)
              </FormControl.Caption>
            </FormControl>

            <PrimerButton
              variant="invisible"
              size="small"
              onClick={() =>
                onWayChange(way === 'token' ? 'password' : 'token')
              }
              sx={{ mb: 2, px: 0 }}
            >
              {way === 'token'
                ? 'Sign in with a handle and password instead'
                : 'Sign in with an API token instead'}
            </PrimerButton>
            {way === 'token' ? (
              <FormControl sx={{ mb: 3 }} required id="api-token-input">
                <FormControl.Label htmlFor="api-token-input">
                  API Token
                </FormControl.Label>
                <TextInput
                  block
                  size="large"
                  type="password"
                  value={formData.token}
                  onChange={e => onFormDataChange('token', e.target.value)}
                  onKeyPress={onKeyPress}
                  placeholder="Enter your API token"
                  aria-describedby="api-token-help"
                  aria-invalid={
                    !formData.token && state.error ? 'true' : 'false'
                  }
                  autoComplete="current-password"
                  sx={focusRing}
                />
                <FormControl.Caption id="api-token-help">
                  <Text>
                    Your Datalayer API token for authentication (required).{' '}
                    <PrimerButton
                      as="a"
                      variant="invisible"
                      size="small"
                      href="https://datalayer.ai/settings/iam/tokens"
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Open Datalayer settings to get an API token (opens in new tab)"
                      sx={{
                        p: 0,
                        fontSize: 'inherit',
                        verticalAlign: 'baseline',
                        '&:focus-visible': {
                          outline: '2px solid',
                          outlineColor: COLORS.brand.primary,
                          outlineOffset: '2px',
                          borderRadius: 1,
                        },
                      }}
                    >
                      Get a token
                    </PrimerButton>
                  </Text>
                </FormControl.Caption>
              </FormControl>
            ) : null}
          </>
        ) : null}

        <Button
          loading={state.loading}
          disabled={state.loading || !ready}
          onClick={onSubmit}
        />
      </fieldset>
    </form>
  );
};

export default Form;
