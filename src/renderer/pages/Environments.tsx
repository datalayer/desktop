/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * @module Environments
 * @description Environments page for browsing and selecting compute environments with GPU support detection
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Box, Heading, Text } from '@primer/react';
import { useCoreStore } from '@datalayer/core/lib/state';
import { useEnvironments } from '../stores/environmentStore';
import { isGPUEnvironment } from '../utils/environments';
import { logger } from '../utils/logger';

import AuthWarning from '../components/environments/AuthWarning';
import LoadingSpinner from '../components/environments/LoadingSpinner';
import ErrorState from '../components/environments/ErrorState';
import EmptyState from '../components/environments/EmptyState';
import Card from '../components/environments/Card';
import SelectionSummary from '../components/environments/SelectionSummary';

interface EnvironmentsProps {
  isAuthenticated?: boolean;
}

/**
 * Environments page component that displays available compute environments for notebooks.
 * Includes environment selection, GPU detection, authentication checks, and caching.
 *
 * @component
 * @param props.isAuthenticated - Optional authentication state override
 * @returns The rendered environments page
 */
const Environments: React.FC<EnvironmentsProps> = ({ isAuthenticated }) => {
  const [selectedEnv, setSelectedEnv] = useState<string | null>(null);
  const [authState, setAuthState] = useState<{
    isAuthenticated: boolean;
    user: any | null;
    token: string | null;
    runUrl: string;
  } | null>(null);
  const { configuration, setConfiguration } = useCoreStore();

  // Use the environment store for caching
  const {
    environments,
    isLoading: loading,
    error,
    fetchIfNeeded,
  } = useEnvironments();

  // Set up auth state listener
  useEffect(() => {
    const handleAuthStateChange = (newAuthState: {
      isAuthenticated: boolean;
      user: any | null;
      token: string | null;
      runUrl: string;
    }) => {
      logger.debug('[Environments] Auth state changed:', newAuthState);
      setAuthState(newAuthState);
    };

    // Listen for auth state changes from main process
    window.electronAPI?.onAuthStateChanged?.(handleAuthStateChange);

    // Get initial auth state
    window.datalayerClient
      ?.getAuthState?.()
      .then(initialAuthState => {
        handleAuthStateChange(initialAuthState);
      })
      .catch(error => {
        logger.error('[Environments] Failed to get initial auth state:', error);
        setAuthState({
          isAuthenticated: false,
          user: null,
          token: null,
          runUrl: '',
        });
      });

    return () => {
      window.electronAPI?.removeAuthStateListener?.();
    };
  }, []);

  const fetchEnvironments = useCallback(async () => {
    try {
      // Check if user is authenticated (prefer event-driven auth state)
      const isUserAuthenticated =
        authState?.isAuthenticated || isAuthenticated || !!configuration?.token;
      if (!isUserAuthenticated) {
        logger.debug(
          '[Environments] Not authenticated, skipping environments fetch'
        );
        return;
      }

      // Use the cached store fetch which handles caching automatically
      await fetchIfNeeded();

      // Set the current environment as selected
      if (configuration.cpuEnvironment) {
        setSelectedEnv(configuration.cpuEnvironment);
      } else if (environments.length > 0) {
        // Default to first environment
        setSelectedEnv(environments[0].name);
      }
    } catch (err) {
      // Failed to fetch environments
      // Error is handled by the store
    }
  }, [
    authState?.isAuthenticated,
    authState?.token,
    isAuthenticated,
    configuration?.token,
    configuration?.cpuEnvironment,
    fetchIfNeeded,
    environments,
  ]);

  useEffect(() => {
    fetchEnvironments();
  }, [fetchEnvironments]);

  const handleSelectEnvironment = async (envName: string) => {
    setSelectedEnv(envName);

    // Update the store configuration
    if (configuration) {
      const isGPUEnv = isGPUEnvironment(envName);

      setConfiguration({
        ...configuration,
        cpuEnvironment: !isGPUEnv ? envName : configuration.cpuEnvironment,
        gpuEnvironment: isGPUEnv ? envName : configuration.gpuEnvironment,
      });
    }
  };

  return (
    <Box
      className="environments-page"
      sx={{ height: '100%', overflowY: 'scroll' }}
    >
      <Box sx={{ mb: 4 }}>
        <Heading as="h2" sx={{ mb: 2 }}>
          Runtime Environments
        </Heading>
        <Text sx={{ color: 'fg.subtle' }}>
          Select a computing environment for your notebooks and runtimes
        </Text>
      </Box>

      {!(
        authState?.isAuthenticated ||
        isAuthenticated ||
        configuration?.token
      ) && <AuthWarning />}

      {loading && <LoadingSpinner />}

      {error && !loading && (
        <ErrorState error={error} onRetry={fetchEnvironments} />
      )}

      {!loading && environments.length > 0 && (
        <Box>
          {environments.map(env => (
            <Card
              key={env.name}
              environment={env}
              isSelected={selectedEnv === env.name}
              onSelect={handleSelectEnvironment}
            />
          ))}
        </Box>
      )}

      {!loading && environments.length === 0 && !error && <EmptyState />}

      {(authState?.isAuthenticated ||
        isAuthenticated ||
        configuration?.token) &&
        environments.length > 0 && (
          <SelectionSummary
            selectedEnv={selectedEnv}
            environmentsCount={environments.length}
          />
        )}
    </Box>
  );
};

export default Environments;
