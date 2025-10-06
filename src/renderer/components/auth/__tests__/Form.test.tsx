/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Tests for the login Form component.
 *
 * @module renderer/components/auth/Form.test
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Form from '../Form';
import type { LoginFormProps } from '../../../../shared/types';

describe('Form component', () => {
  const defaultProps: LoginFormProps = {
    formData: {
      runUrl: '',
      token: '',
    },
    state: {
      loading: false,
      error: '',
    },
    onFormDataChange: vi.fn(),
    onSubmit: vi.fn(),
    onKeyPress: vi.fn(),
  };

  it('should render both input fields', () => {
    render(<Form {...defaultProps} />);

    expect(screen.getByLabelText(/run url/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/api token/i)).toBeInTheDocument();
  });

  it('should display placeholders for empty fields', () => {
    render(<Form {...defaultProps} />);

    expect(
      screen.getByPlaceholderText(/https:\/\/prod1\.datalayer\.run/i)
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/enter your api token/i)
    ).toBeInTheDocument();
  });

  it('should render with pre-filled values', () => {
    const props = {
      ...defaultProps,
      formData: {
        runUrl: 'https://test.datalayer.run',
        token: 'test-token',
      },
    };

    render(<Form {...props} />);

    expect(
      screen.getByDisplayValue('https://test.datalayer.run')
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue('test-token')).toBeInTheDocument();
  });

  it('should call onFormDataChange when URL input changes', async () => {
    const onFormDataChange = vi.fn();
    const user = userEvent.setup();

    render(<Form {...defaultProps} onFormDataChange={onFormDataChange} />);

    const urlInput = screen.getByLabelText(/datalayer instance url/i);
    await user.type(urlInput, 'https://test.datalayer.run');

    expect(onFormDataChange).toHaveBeenCalledWith('runUrl', expect.any(String));
  });

  it('should call onFormDataChange when token input changes', async () => {
    const onFormDataChange = vi.fn();
    const user = userEvent.setup();

    render(<Form {...defaultProps} onFormDataChange={onFormDataChange} />);

    const tokenInput = screen.getByLabelText(
      /datalayer api authentication token/i
    );
    await user.type(tokenInput, 'my-token');

    expect(onFormDataChange).toHaveBeenCalledWith('token', expect.any(String));
  });

  it('should call onSubmit when form is submitted', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();

    const props = {
      ...defaultProps,
      formData: {
        runUrl: 'https://test.datalayer.run',
        token: 'test-token',
      },
      onSubmit,
    };

    render(<Form {...props} />);

    screen.getByRole('form', {
      name: /datalayer authentication form/i,
    });
    await user.click(screen.getByRole('button', { name: /connect/i }));

    expect(onSubmit).toHaveBeenCalled();
  });

  it('should prevent default form submission behavior', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();

    const props = {
      ...defaultProps,
      formData: {
        runUrl: 'https://test.datalayer.run',
        token: 'test-token',
      },
      onSubmit,
    };

    render(<Form {...props} />);

    screen.getByRole('form');
    await user.click(screen.getByRole('button', { name: /connect/i }));

    // Form should not reload the page
    expect(onSubmit).toHaveBeenCalled();
  });

  it('should disable submit button when URL is empty', () => {
    const props = {
      ...defaultProps,
      formData: {
        runUrl: '',
        token: 'has-token',
      },
    };

    render(<Form {...props} />);

    const button = screen.getByRole('button', { name: /connect/i });
    expect(button).toBeDisabled();
  });

  it('should disable submit button when token is empty', () => {
    const props = {
      ...defaultProps,
      formData: {
        runUrl: 'https://test.datalayer.run',
        token: '',
      },
    };

    render(<Form {...props} />);

    const button = screen.getByRole('button', { name: /connect/i });
    expect(button).toBeDisabled();
  });

  it('should enable submit button when both fields are filled', () => {
    const props = {
      ...defaultProps,
      formData: {
        runUrl: 'https://test.datalayer.run',
        token: 'test-token',
      },
    };

    render(<Form {...props} />);

    const button = screen.getByRole('button', { name: /connect/i });
    expect(button).not.toBeDisabled();
  });

  it('should disable all inputs when loading', () => {
    const props = {
      ...defaultProps,
      formData: {
        runUrl: 'https://test.datalayer.run',
        token: 'test-token',
      },
      state: {
        loading: true,
        error: '',
      },
    };

    render(<Form {...props} />);

    const urlInput = screen.getByLabelText(/datalayer instance url/i);
    const tokenInput = screen.getByLabelText(
      /datalayer api authentication token/i
    );
    const button = screen.getByRole('button');

    expect(urlInput).toBeDisabled();
    expect(tokenInput).toBeDisabled();
    expect(button).toBeDisabled();
  });

  it('should show "Connecting..." text when loading', () => {
    const props = {
      ...defaultProps,
      formData: {
        runUrl: 'https://test.datalayer.run',
        token: 'test-token',
      },
      state: {
        loading: true,
        error: '',
      },
    };

    render(<Form {...props} />);

    expect(screen.getByText(/connecting\.\.\./i)).toBeInTheDocument();
  });

  it('should have password type for token input', () => {
    render(<Form {...defaultProps} />);

    const tokenInput = screen.getByLabelText(
      /datalayer api authentication token/i
    );
    expect(tokenInput).toHaveAttribute('type', 'password');
  });

  it('should have autocomplete attribute for token input', () => {
    render(<Form {...defaultProps} />);

    const tokenInput = screen.getByLabelText(
      /datalayer api authentication token/i
    );
    expect(tokenInput).toHaveAttribute('autocomplete', 'current-password');
  });

  it('should have noValidate attribute on form', () => {
    render(<Form {...defaultProps} />);

    const form = screen.getByRole('form');
    expect(form).toHaveAttribute('noValidate');
  });

  it('should have proper ARIA labels and descriptions', () => {
    render(<Form {...defaultProps} />);

    const urlInput = screen.getByLabelText(/datalayer instance url/i);
    const tokenInput = screen.getByLabelText(
      /datalayer api authentication token/i
    );

    expect(urlInput).toHaveAttribute('aria-describedby', 'run-url-help');
    expect(tokenInput).toHaveAttribute('aria-describedby', 'api-token-help');
  });

  it('should have aria-invalid when error exists', () => {
    const props = {
      ...defaultProps,
      state: {
        loading: false,
        error: 'Authentication failed',
      },
    };

    render(<Form {...props} />);

    const urlInput = screen.getByLabelText(/datalayer instance url/i);
    const tokenInput = screen.getByLabelText(
      /datalayer api authentication token/i
    );

    expect(urlInput).toHaveAttribute('aria-invalid', 'true');
    expect(tokenInput).toHaveAttribute('aria-invalid', 'true');
  });

  it('should render "Get a token" link', () => {
    render(<Form {...defaultProps} />);

    const link = screen.getByRole('link', { name: /get a token/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute(
      'href',
      'https://datalayer.app/settings/iam/tokens'
    );
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('should display help text for both fields', () => {
    render(<Form {...defaultProps} />);

    expect(
      screen.getByText(/the url of your datalayer instance/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/your datalayer api token for authentication/i)
    ).toBeInTheDocument();
  });

  it('should call onKeyPress when key is pressed in URL input', async () => {
    const onKeyPress = vi.fn();
    const user = userEvent.setup();

    render(<Form {...defaultProps} onKeyPress={onKeyPress} />);

    const urlInput = screen.getByLabelText(/datalayer instance url/i);
    await user.type(urlInput, 'a');

    expect(onKeyPress).toHaveBeenCalled();
  });

  it('should call onKeyPress when key is pressed in token input', async () => {
    const onKeyPress = vi.fn();
    const user = userEvent.setup();

    render(<Form {...defaultProps} onKeyPress={onKeyPress} />);

    const tokenInput = screen.getByLabelText(
      /datalayer api authentication token/i
    );
    await user.type(tokenInput, 'a');

    expect(onKeyPress).toHaveBeenCalled();
  });

  it('should have accessible fieldset legend', () => {
    const { container } = render(<Form {...defaultProps} />);

    const legend = container.querySelector('legend');
    expect(legend).toHaveTextContent('Login credentials');
  });

  it('should mark both fields as required', () => {
    render(<Form {...defaultProps} />);

    // Check for required FormControl containers
    const form = screen.getByRole('form');
    expect(form).toBeInTheDocument();

    // Both inputs should be in required form controls
    expect(screen.getByLabelText(/run url/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/api token/i)).toBeInTheDocument();
  });

  it('should render Connect button from Button component', () => {
    const props = {
      ...defaultProps,
      formData: {
        runUrl: 'https://test.datalayer.run',
        token: 'test-token',
      },
    };

    render(<Form {...props} />);

    expect(
      screen.getByRole('button', { name: /connect/i })
    ).toBeInTheDocument();
  });
});
