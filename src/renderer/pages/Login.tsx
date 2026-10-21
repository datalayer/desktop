/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Login page component for authenticating with the Datalayer platform.
 * Handles credential validation, secure storage, and user data fetching.
 *
 * @module renderer/pages/Login
 */

import React, { useState, useCallback, useRef } from 'react';
import { Box } from '@primer/react';
import { useService } from '../contexts/ServiceContext';
import iconImage from '../assets/icon.png';
import Header from '../components/auth/Header';
import ErrorMessage from '../components/common/ErrorMessage';
import Form from '../components/auth/Form';
import ProviderButtons from '../components/auth/ProviderButtons';
import Footer from '../components/auth/Footer';
import Version from '../components/auth/Version';
import { LoginFormData, LoginState, LoginWay } from '../../shared/types';
import { validateLoginForm, formatLoginError } from '../utils/login';
// User payload isn't typed here; treating it as Record<string, unknown>.

interface LoginProps {
  onUserDataFetched?: (userData: Record<string, unknown>) => void;
}

/**
 * Login page component.
 * Provides a form for users to authenticate with the Datalayer platform using API credentials.
 *
 * @param props - Component props
 * @param props.onUserDataFetched - Callback invoked when user data is successfully fetched
 * @returns The login page component
 */
const Login: React.FC<LoginProps> = ({ onUserDataFetched }) => {
  const authService = useService('authService');
  const [formData, setFormData] = useState<LoginFormData>({
    runUrl: 'https://prod1.datalayer.run',
    handle: '',
    password: '',
    token: '',
  });
  // A handle and password by default; the token under More options.
  const [way, setWay] = useState<LoginWay>('password');

  const [state, setState] = useState<LoginState>({
    loading: false,
    error: '',
  });

  const handleFormDataChange = useCallback(
    (field: keyof LoginFormData, value: string) => {
      setFormData(prev => ({
        ...prev,
        [field]: value,
      }));

      if (state.error) {
        setState(prev => ({ ...prev, error: '' }));
      }
    },
    [state.error]
  );

  // Enter in a field and the form's own submit can both fire: one sign-in.
  const submitting = useRef(false);

  const handleSubmit = useCallback(async () => {
    if (submitting.current) {
      return;
    }
    submitting.current = true;
    try {
      const validationError = validateLoginForm(formData, way);
      if (validationError) {
        setState(prev => ({ ...prev, error: validationError }));
        return;
      }

      if (!authService) {
        setState(prev => ({
          ...prev,
          error: 'Authentication service not ready',
        }));
        return;
      }

      setState(prev => ({ ...prev, loading: true, error: '' }));

      // Use AuthService to login
      const user =
        way === 'password'
          ? await authService.loginWithPassword(
              formData.runUrl,
              formData.handle.trim(),
              formData.password
            )
          : await authService.login(formData.runUrl, formData.token.trim());

      // Call the callback if provided (for backwards compatibility)
      if (onUserDataFetched && user) {
        await onUserDataFetched(user as unknown as Record<string, unknown>);
      }

      // Don't set loading to false here - let the auth state update handle navigation
      // This prevents the form from briefly re-enabling before navigation
      // setState(prev => ({ ...prev, loading: false }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: formatLoginError(error),
      }));
    } finally {
      submitting.current = false;
    }
  }, [formData, way, authService, onUserDataFetched]);

  // A sign-in with a provider ended in a sentence (DK-03).
  const handleSignInFailed = useCallback((sentence: string) => {
    setState(prev => ({ ...prev, loading: false, error: sentence }));
  }, []);

  const handleKeyPress = useCallback(
    (event: React.KeyboardEvent) => {
      if (event.key === 'Enter' && !state.loading) {
        handleSubmit();
      }
    },
    [handleSubmit, state.loading]
  );

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        p: 3,
        backgroundColor: 'canvas.default',
      }}
    >
      <Box
        sx={{
          width: '100%',
          maxWidth: '480px',
          backgroundColor: 'canvas.overlay',
          borderRadius: 2,
          border: '1px solid',
          borderColor: 'border.default',
          p: 4,
          boxShadow: 'shadow.medium',
        }}
      >
        <Header iconSrc={iconImage} />

        <ErrorMessage error={state.error} />

        <ProviderButtons
          onFailed={handleSignInFailed}
          disabled={state.loading}
        />

        <Form
          formData={formData}
          state={state}
          onFormDataChange={handleFormDataChange}
          onSubmit={handleSubmit}
          onKeyPress={handleKeyPress}
          way={way}
          onWayChange={setWay}
        />

        <Footer />
        <Version />
      </Box>
    </Box>
  );
};

export default Login;
