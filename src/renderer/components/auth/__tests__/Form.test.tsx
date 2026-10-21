/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Tests for the login Form component: a handle and a password by default;
 * the Run URL and the API token under *More options*.
 *
 * @module renderer/components/auth/Form.test
 */

import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Form from '../Form';
import { formatLoginError, validateLoginForm } from '../../../utils/login';
import type {
  LoginFormData,
  LoginFormProps,
  LoginWay,
} from '../../../../shared/types';

const EMPTY: LoginFormData = {
  runUrl: 'https://prod1.datalayer.run',
  handle: '',
  password: '',
  token: '',
};

const props = (overrides: Partial<LoginFormProps> = {}): LoginFormProps => ({
  formData: EMPTY,
  state: { loading: false, error: '' },
  onFormDataChange: vi.fn(),
  onSubmit: vi.fn(),
  onKeyPress: vi.fn(),
  way: 'password',
  onWayChange: vi.fn(),
  ...overrides,
});

/** The form with its data and way kept in state, as the Login page does. */
const Harness: React.FC<{
  initial?: Partial<LoginFormData>;
  onSubmit?: () => void;
  onWayChange?: (way: LoginWay) => void;
}> = ({ initial = {}, onSubmit = vi.fn(), onWayChange }) => {
  const [formData, setFormData] = useState<LoginFormData>({
    ...EMPTY,
    ...initial,
  });
  const [way, setWay] = useState<LoginWay>('password');
  return (
    <Form
      formData={formData}
      state={{ loading: false, error: '' }}
      onFormDataChange={(field, value) =>
        setFormData(prev => ({ ...prev, [field]: value }))
      }
      onSubmit={onSubmit}
      onKeyPress={e => {
        if (e.key === 'Enter') {
          onSubmit();
        }
      }}
      way={way}
      onWayChange={next => {
        onWayChange?.(next);
        setWay(next);
      }}
    />
  );
};

const handleInput = () => screen.getByLabelText(/handle/i);
const passwordInput = () => screen.getByLabelText(/^password/i);
const connect = () => screen.getByRole('button', { name: /connect/i });
const moreOptions = () => screen.getByRole('button', { name: /more options/i });

describe('Form component', () => {
  describe('by default', () => {
    it('shows the handle and the password, and no token nor Run URL', () => {
      render(<Form {...props()} />);

      expect(handleInput()).toBeInTheDocument();
      expect(passwordInput()).toBeInTheDocument();
      expect(screen.queryByLabelText(/run url/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/^api token/i)).not.toBeInTheDocument();
      expect(
        screen.queryByRole('link', { name: /get an api token/i })
      ).not.toBeInTheDocument();
      expect(moreOptions()).toHaveAttribute('aria-expanded', 'false');
    });

    it('gives the password a password field with its autocomplete', () => {
      render(<Form {...props()} />);

      expect(handleInput()).toHaveAttribute('autocomplete', 'username');
      expect(passwordInput()).toHaveAttribute('type', 'password');
      expect(passwordInput()).toHaveAttribute(
        'autocomplete',
        'current-password'
      );
    });

    it('marks the handle and the password as required', () => {
      render(<Form {...props()} />);

      expect(handleInput()).toBeRequired();
      expect(passwordInput()).toBeRequired();
    });

    it('shows pre-filled values', () => {
      render(
        <Form
          {...props({
            formData: { ...EMPTY, handle: 'ada', password: 's3cret' },
          })}
        />
      );

      expect(handleInput()).toHaveValue('ada');
      expect(passwordInput()).toHaveValue('s3cret');
    });

    it('reports typing in the handle and the password', async () => {
      const onFormDataChange = vi.fn();
      const user = userEvent.setup();
      render(<Form {...props({ onFormDataChange })} />);

      await user.type(handleInput(), 'a');
      await user.type(passwordInput(), 'b');

      expect(onFormDataChange).toHaveBeenCalledWith('handle', 'a');
      expect(onFormDataChange).toHaveBeenCalledWith('password', 'b');
    });
  });

  describe('More options', () => {
    it('reveals the Run URL and the token toggle, not yet the token', async () => {
      const user = userEvent.setup();
      render(<Harness />);

      await user.click(moreOptions());

      expect(
        screen.getByRole('button', { name: /fewer options/i })
      ).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByLabelText(/run url/i)).toHaveValue(
        'https://prod1.datalayer.run'
      );
      expect(
        screen.getByRole('button', { name: /sign in with an api token/i })
      ).toBeInTheDocument();
      expect(screen.queryByLabelText(/^api token/i)).not.toBeInTheDocument();
      expect(handleInput()).toBeInTheDocument();
    });

    it('the token way shows the token field and hides handle and password', async () => {
      const onWayChange = vi.fn();
      const user = userEvent.setup();
      render(<Harness onWayChange={onWayChange} />);

      await user.click(moreOptions());
      await user.click(
        screen.getByRole('button', { name: /sign in with an api token/i })
      );

      expect(onWayChange).toHaveBeenLastCalledWith('token');
      const token = screen.getByLabelText(/^api token/i);
      expect(token).toHaveAttribute('type', 'password');
      expect(token).toHaveAttribute('autocomplete', 'current-password');
      expect(token).toBeRequired();
      expect(screen.queryByLabelText(/handle/i)).not.toBeInTheDocument();
      expect(screen.queryByLabelText(/^password/i)).not.toBeInTheDocument();
    });

    it('goes back to the handle and password, keeping the Run URL', async () => {
      const user = userEvent.setup();
      render(<Harness />);

      await user.click(moreOptions());
      const url = screen.getByLabelText(/run url/i);
      await user.clear(url);
      await user.type(url, 'https://r1.datalayer.run');
      await user.click(
        screen.getByRole('button', { name: /sign in with an api token/i })
      );
      await user.click(
        screen.getByRole('button', {
          name: /sign in with a handle and password/i,
        })
      );

      expect(handleInput()).toBeInTheDocument();
      expect(screen.queryByLabelText(/^api token/i)).not.toBeInTheDocument();
      expect(screen.getByLabelText(/run url/i)).toHaveValue(
        'https://r1.datalayer.run'
      );
    });

    it('Fewer options returns to the password way', async () => {
      const onWayChange = vi.fn();
      const user = userEvent.setup();
      render(<Harness onWayChange={onWayChange} />);

      await user.click(moreOptions());
      await user.click(
        screen.getByRole('button', { name: /sign in with an api token/i })
      );
      await user.click(screen.getByRole('button', { name: /fewer options/i }));

      expect(onWayChange).toHaveBeenLastCalledWith('password');
      expect(handleInput()).toBeInTheDocument();
      expect(screen.queryByLabelText(/run url/i)).not.toBeInTheDocument();
    });

    it('links Get a token to datalayer.ai in a new tab', async () => {
      const user = userEvent.setup();
      render(<Harness />);

      await user.click(moreOptions());
      await user.click(
        screen.getByRole('button', { name: /sign in with an api token/i })
      );

      const link = screen.getByText(/get a token/i).closest('a');
      expect(link).toHaveAttribute(
        'href',
        'https://datalayer.ai/settings/iam/tokens'
      );
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('the toggles are not submit buttons', async () => {
      const onSubmit = vi.fn();
      const user = userEvent.setup();
      render(<Harness onSubmit={onSubmit} />);

      await user.click(moreOptions());
      await user.click(
        screen.getByRole('button', { name: /sign in with an api token/i })
      );

      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe('submit', () => {
    it('is disabled until the handle and the password are filled', () => {
      const { rerender } = render(<Form {...props()} />);
      expect(connect()).toBeDisabled();

      rerender(<Form {...props({ formData: { ...EMPTY, handle: 'ada' } })} />);
      expect(connect()).toBeDisabled();

      rerender(
        <Form
          {...props({
            formData: { ...EMPTY, handle: 'ada', password: 's3cret' },
          })}
        />
      );
      expect(connect()).toBeEnabled();
    });

    it('in the token way, is enabled by the token alone', () => {
      const { rerender } = render(
        <Form
          {...props({
            way: 'token',
            formData: { ...EMPTY, handle: 'ada', password: 's3cret' },
          })}
        />
      );
      expect(connect()).toBeDisabled();

      rerender(
        <Form
          {...props({ way: 'token', formData: { ...EMPTY, token: 'tok' } })}
        />
      );
      expect(connect()).toBeEnabled();
    });

    it('is disabled without a Run URL', () => {
      render(
        <Form
          {...props({
            formData: {
              ...EMPTY,
              runUrl: '',
              handle: 'ada',
              password: 's3cret',
            },
          })}
        />
      );
      expect(connect()).toBeDisabled();
    });

    it('calls onSubmit when Connect is clicked', async () => {
      const onSubmit = vi.fn();
      const user = userEvent.setup();
      render(
        <Form
          {...props({
            onSubmit,
            formData: { ...EMPTY, handle: 'ada', password: 's3cret' },
          })}
        />
      );

      await user.click(connect());

      expect(onSubmit).toHaveBeenCalled();
    });

    it('prevents the default form submission', () => {
      render(<Form {...props()} />);
      const form = screen.getByRole('form', {
        name: /datalayer authentication form/i,
      });
      const event = new Event('submit', { bubbles: true, cancelable: true });

      form.dispatchEvent(event);

      expect(event.defaultPrevented).toBe(true);
      expect(form).toHaveAttribute('novalidate');
    });

    it('Enter submits in the password way', async () => {
      const onSubmit = vi.fn();
      const user = userEvent.setup();
      render(<Harness onSubmit={onSubmit} />);

      await user.type(handleInput(), 'ada');
      await user.type(passwordInput(), 's3cret{Enter}');

      expect(onSubmit).toHaveBeenCalled();
    });

    it('Enter submits in the token way', async () => {
      const onSubmit = vi.fn();
      const user = userEvent.setup();
      render(<Harness onSubmit={onSubmit} />);

      await user.click(moreOptions());
      await user.click(
        screen.getByRole('button', { name: /sign in with an api token/i })
      );
      await user.type(screen.getByLabelText(/^api token/i), 'tok{Enter}');

      expect(onSubmit).toHaveBeenCalled();
    });

    it('passes key presses to onKeyPress', async () => {
      const onKeyPress = vi.fn();
      const user = userEvent.setup();
      render(<Form {...props({ onKeyPress })} />);

      await user.type(handleInput(), 'a');
      await user.type(passwordInput(), 'b');

      expect(onKeyPress).toHaveBeenCalledTimes(2);
    });
  });

  describe('loading', () => {
    it('disables the inputs, the toggles and Connect', async () => {
      const user = userEvent.setup();
      const { rerender } = render(<Form {...props({ way: 'token' })} />);
      await user.click(moreOptions());

      rerender(
        <Form
          {...props({ way: 'token', state: { loading: true, error: '' } })}
        />
      );

      expect(screen.getByLabelText(/run url/i)).toBeDisabled();
      expect(screen.getByLabelText(/^api token/i)).toBeDisabled();
      expect(
        screen.getByRole('button', { name: /fewer options/i })
      ).toBeDisabled();
      expect(
        screen.getByRole('button', { name: /authenticating/i })
      ).toBeDisabled();
    });

    it('disables the handle and the password and says Connecting...', () => {
      render(<Form {...props({ state: { loading: true, error: '' } })} />);

      expect(handleInput()).toBeDisabled();
      expect(passwordInput()).toBeDisabled();
      expect(screen.getByText('Connecting...')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('names the form and its fieldset', () => {
      render(<Form {...props()} />);

      expect(
        screen.getByRole('form', { name: /datalayer authentication form/i })
      ).toBeInTheDocument();
      expect(screen.getByText('Login credentials').tagName).toBe('LEGEND');
    });

    it('describes the Run URL and the token by their captions', async () => {
      render(<Form {...props({ way: 'token' })} />);
      await userEvent.setup().click(moreOptions());

      expect(screen.getByLabelText(/run url/i)).toHaveAttribute(
        'aria-describedby',
        expect.stringContaining('run-url-help')
      );
      expect(screen.getByLabelText(/^api token/i)).toHaveAttribute(
        'aria-describedby',
        expect.stringContaining('api-token-help')
      );
      expect(
        screen.getByText(/the url of your datalayer instance/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/your datalayer api token for authentication/i)
      ).toBeInTheDocument();
    });

    it('marks an empty Run URL or token invalid when there is an error', async () => {
      render(
        <Form
          {...props({
            way: 'token',
            formData: { ...EMPTY, runUrl: '' },
            state: { loading: false, error: 'Please provide your API token.' },
          })}
        />
      );
      await userEvent.setup().click(moreOptions());

      expect(screen.getByLabelText(/run url/i)).toHaveAttribute(
        'aria-invalid',
        'true'
      );
      expect(screen.getByLabelText(/^api token/i)).toHaveAttribute(
        'aria-invalid',
        'true'
      );
    });
  });
});

describe('validateLoginForm', () => {
  it('asks for the Run URL first', () => {
    expect(
      validateLoginForm({ ...EMPTY, runUrl: '', handle: 'a', password: 'b' })
    ).toMatch(/run url/i);
  });

  it('the password way needs the handle and the password', () => {
    expect(validateLoginForm({ ...EMPTY, handle: 'a' }, 'password')).toMatch(
      /handle and your password/i
    );
    expect(validateLoginForm({ ...EMPTY, password: 'b' }, 'password')).toMatch(
      /handle and your password/i
    );
    expect(
      validateLoginForm({ ...EMPTY, handle: 'a', password: 'b' }, 'password')
    ).toBe('');
  });

  it('the password way is the default and ignores a token', () => {
    expect(validateLoginForm({ ...EMPTY, token: 'tok' })).toMatch(
      /handle and your password/i
    );
  });

  it('the token way needs the token alone', () => {
    expect(
      validateLoginForm({ ...EMPTY, handle: 'a', password: 'b' }, 'token')
    ).toMatch(/api token/i);
    expect(validateLoginForm({ ...EMPTY, token: 'tok' }, 'token')).toBe('');
  });
});

describe('formatLoginError', () => {
  it("shows the main process's sentence without Electron's prefix", () => {
    expect(
      formatLoginError(
        new Error(
          "Error invoking remote method 'datalayer:login-password': Error: Invalid credentials."
        )
      )
    ).toBe('Invalid credentials.');
  });

  it('keeps a string and falls back for anything else', () => {
    expect(formatLoginError('No network.')).toBe('No network.');
    expect(formatLoginError({})).toMatch(/failed to login/i);
  });
});
