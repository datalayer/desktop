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

import React, { useState, useCallback } from 'react';
import { Box } from '@primer/react';
import iconImage from '../assets/icon.png';
import Header from '../components/login/Header';
import ErrorMessage from '../components/login/ErrorMessage';
import Form from '../components/login/Form';
import Footer from '../components/login/Footer';
import Version from '../components/login/Version';
import { LoginFormData, LoginState } from '../../shared/types';
import { validateLoginForm, formatLoginError } from '../utils/login';

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
  const [formData, setFormData] = useState<LoginFormData>({
    runUrl: 'https://prod1.datalayer.run',
    token: '',
  });

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

  const handleSubmit = useCallback(async () => {
    try {
      const validationError = validateLoginForm(formData);
      if (validationError) {
        setState(prev => ({ ...prev, error: validationError }));
        return;
      }

      setState(prev => ({ ...prev, loading: true, error: '' }));

      // Use secure IPC to login
      await window.datalayerClient.login(formData.token.trim());

      // If login succeeds, fetch user data if callback is provided
      if (onUserDataFetched) {
        try {
          const userData = await window.datalayerClient.whoami();
          // Call the callback which will update auth state in App.tsx
          await onUserDataFetched(userData as any); // User model will be handled in processUserData
        } catch (userError) {
          // Login succeeded but user data fetch failed - not critical
        }
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
    }
  }, [formData, onUserDataFetched]);

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

        <Form
          formData={formData}
          state={state}
          onFormDataChange={handleFormDataChange}
          onSubmit={handleSubmit}
          onKeyPress={handleKeyPress}
        />

        <Footer />
        <Version />
      </Box>
    </Box>
  );
};

export default Login;
