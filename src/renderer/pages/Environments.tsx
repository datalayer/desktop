/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Environments page for browsing and selecting compute environments.
 * Supports GPU environment detection and runtime selection.
 *
 * @module renderer/pages/Environments
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Box, Heading, Text } from '@primer/react';
import { useService } from '../contexts/ServiceContext';
import { logger } from '../utils/logger';

import AuthWarning from '../components/environments/AuthWarning';
import LoadingSpinner from '../components/common/LoadingSpinner';
import ErrorState from '../components/environments/ErrorState';
import EmptyState from '../components/environments/EmptyState';
import Card from '../components/environments/Card';
import type { Environment } from '../services/interfaces/IEnvironmentService';

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
  const authService = useService('authService');
  const environmentService = useService('environmentService');

  const [environments, setEnvironments] = useState<Environment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userAuthenticated, setUserAuthenticated] = useState(false);

  // Listen for auth state changes via AuthService
  useEffect(() => {
    if (!authService) return;

    const updateAuthState = async () => {
      try {
        const state = await authService.getAuthState();
        setUserAuthenticated(state.isAuthenticated || !!isAuthenticated);
      } catch (err) {
        logger.error('[Environments] Failed to get auth state:', err);
        setUserAuthenticated(false);
      }
    };

    updateAuthState();

    const unsubscribe = authService.onAuthStateChanged(change => {
      logger.debug('[Environments] Auth state changed:', change.current);
      setUserAuthenticated(change.current.isAuthenticated || !!isAuthenticated);
    });

    return unsubscribe;
  }, [authService, isAuthenticated]);

  const fetchEnvironments = useCallback(async () => {
    if (!environmentService) {
      logger.debug('[Environments] EnvironmentService not ready');
      return;
    }

    if (!userAuthenticated) {
      logger.debug(
        '[Environments] Not authenticated, skipping environments fetch'
      );
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Initialize service if needed
      if (environmentService.state === 'uninitialized') {
        await environmentService.initialize();
      }

      // Fetch environments (uses caching automatically)
      const envs = await environmentService.listEnvironments();
      setEnvironments(envs);
      setLoading(false);

      logger.debug(`[Environments] Loaded ${envs.length} environments`);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to load environments';
      logger.error('[Environments] Failed to fetch:', err);
      setError(errorMessage);
      setLoading(false);
    }
  }, [environmentService, userAuthenticated]);

  useEffect(() => {
    fetchEnvironments();
  }, [fetchEnvironments]);

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
          Available computing environments for your notebooks and runtimes
        </Text>
      </Box>

      {!userAuthenticated && <AuthWarning />}

      {loading && (
        <LoadingSpinner message="Loading environments..." variant="inline" />
      )}

      {error && !loading && (
        <ErrorState error={error} onRetry={fetchEnvironments} />
      )}

      {!loading && environments.length > 0 && (
        <Box>
          {environments.map(env => (
            <Card key={env.uid} environment={{ ...env, name: env.title }} />
          ))}
        </Box>
      )}

      {!loading && environments.length === 0 && !error && <EmptyState />}
    </Box>
  );
};

export default Environments;
