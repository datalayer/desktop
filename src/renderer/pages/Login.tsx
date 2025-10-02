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
import { useService } from '../contexts/ServiceContext';
import iconImage from '../assets/icon.png';
import Header from '../components/auth/Header';
import ErrorMessage from '../components/common/ErrorMessage';
import Form from '../components/auth/Form';
import Footer from '../components/auth/Footer';
import Version from '../components/auth/Version';
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
  const authService = useService('authService');
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

      if (!authService) {
        setState(prev => ({
          ...prev,
          error: 'Authentication service not ready',
        }));
        return;
      }

      setState(prev => ({ ...prev, loading: true, error: '' }));

      // Use AuthService to login
      const user = await authService.login(
        formData.runUrl,
        formData.token.trim()
      );

      // Call the callback if provided (for backwards compatibility)
      if (onUserDataFetched && user) {
        await onUserDataFetched(user as any);
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
  }, [formData, authService, onUserDataFetched]);

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
