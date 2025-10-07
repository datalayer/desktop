/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Runtimes page component for managing active compute runtimes.
 * Provides runtime listing, auto-refresh, and termination functionality.
 *
 * @module renderer/pages/Runtimes
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Box } from '@primer/react';
import { useService } from '../contexts/ServiceContext';
import { logger } from '../utils/logger';
import type { Runtime } from '../services/interfaces/IRuntimeService';
import type { RuntimesPageProps } from '../../shared/types/runtimes.types';
import Header from '../components/runtimes/Header';
import RuntimesList from '../components/runtimes/RuntimesList';
import TerminateRuntimeDialog from '../components/runtime/TerminateRuntimeDialog';
import TerminateAllDialog from '../components/runtimes/TerminateAllDialog';
import CreateRuntimeDialog from '../components/runtime/CreateRuntimeDialog';
import ErrorMessage from '../components/common/ErrorMessage';
import {
  createRuntimesHash,
  calculateRuntimeStats,
} from '../components/runtimes/utils';

/**
 * Main Runtimes page component.
 * Manages runtime listing, auto-refresh, and termination operations.
 *
 * @param props - Component props
 * @param props.isAuthenticated - Optional authentication state override
 * @returns The runtimes page component
 */
const Runtimes: React.FC<RuntimesPageProps> = ({ isAuthenticated = false }) => {
  const runtimeService = useService('runtimeService');
  const authService = useService('authService');

  const [runtimes, setRuntimes] = useState<Runtime[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastDataHash, setLastDataHash] = useState<string>('');

  // Dialog states
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showTerminateDialog, setShowTerminateDialog] = useState(false);
  const [showTerminateAllDialog, setShowTerminateAllDialog] = useState(false);
  const [runtimeToTerminate, setRuntimeToTerminate] = useState<Runtime | null>(
    null
  );
  const [isTerminating, setIsTerminating] = useState(false);

  const [userAuthenticated, setUserAuthenticated] = useState(isAuthenticated);

  const autoRefreshTimerRef = useRef<NodeJS.Timeout | null>(null);
  const uiUpdateTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isInitializedRef = useRef(false);
  const [, forceUpdate] = useState({});

  // Initialize RuntimeService
  useEffect(() => {
    if (!runtimeService) return;

    const initService = async () => {
      if (runtimeService.state === 'uninitialized') {
        logger.debug('[Runtimes] Initializing RuntimeService');
        await runtimeService.initialize();
        logger.debug('[Runtimes] RuntimeService initialized');
      }
    };

    initService();
  }, [runtimeService]);

  // Listen for auth state changes
  useEffect(() => {
    if (!authService) return;

    const updateAuthState = async () => {
      try {
        const state = await authService.getAuthState();
        setUserAuthenticated(state.isAuthenticated || !!isAuthenticated);
      } catch (err) {
        logger.error('[Runtimes] Failed to get auth state:', err);
        setUserAuthenticated(false);
      }
    };

    updateAuthState();

    const unsubscribe = authService.onAuthStateChanged(change => {
      logger.debug('[Runtimes] Auth state changed:', change.current);
      setUserAuthenticated(change.current.isAuthenticated || !!isAuthenticated);
    });

    return unsubscribe;
  }, [authService, isAuthenticated]);

  /**
   * Fetch runtimes from the service.
   */
  const fetchRuntimes = useCallback(async () => {
    if (!runtimeService || !userAuthenticated) {
      logger.debug('[Runtimes] Service not ready or not authenticated');
      setLoading(false);
      return;
    }

    try {
      const fetchedRuntimes = await runtimeService.listAllRuntimes();
      const newHash = createRuntimesHash(fetchedRuntimes);

      // Only update if data changed
      if (newHash !== lastDataHash) {
        logger.debug(
          `[Runtimes] Data changed, updating (${fetchedRuntimes.length} runtimes)`
        );
        setRuntimes(fetchedRuntimes);
        setLastDataHash(newHash);
      }

      setError(null);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to load runtimes';
      logger.error('[Runtimes] Failed to fetch:', err);
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [runtimeService, userAuthenticated, lastDataHash]);

  /**
   * Manual refresh - force fetch fresh data.
   */
  const handleManualRefresh = useCallback(async () => {
    if (!runtimeService || !userAuthenticated) {
      return;
    }

    logger.info('[Runtimes] Manual refresh triggered');
    setIsRefreshing(true);

    try {
      const fetchedRuntimes = await runtimeService.refreshAllRuntimes();
      setRuntimes(fetchedRuntimes);
      setLastDataHash(createRuntimesHash(fetchedRuntimes));
      setError(null);
      logger.info(`[Runtimes] Refreshed: ${fetchedRuntimes.length} runtimes`);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to refresh runtimes';
      logger.error('[Runtimes] Refresh failed:', err);
      setError(errorMessage);
    } finally {
      setIsRefreshing(false);
    }
  }, [runtimeService, userAuthenticated]);

  /**
   * Start auto-refresh interval (60 seconds).
   */
  const startAutoRefresh = useCallback(() => {
    if (autoRefreshTimerRef.current) {
      clearInterval(autoRefreshTimerRef.current);
    }

    logger.debug('[Runtimes] Starting auto-refresh (60s interval)');

    autoRefreshTimerRef.current = setInterval(async () => {
      if (!isRefreshing && userAuthenticated) {
        logger.debug('[Runtimes] Auto-refresh tick');
        await fetchRuntimes();
      }
    }, 60000); // 60 seconds
  }, [isRefreshing, userAuthenticated, fetchRuntimes]);

  /**
   * Start UI update timer (1 second) for progress bars and time remaining.
   */
  useEffect(() => {
    if (uiUpdateTimerRef.current) {
      clearInterval(uiUpdateTimerRef.current);
    }

    // Force re-render every second to update progress bars and time
    uiUpdateTimerRef.current = setInterval(() => {
      forceUpdate({});
    }, 1000); // 1 second

    return () => {
      if (uiUpdateTimerRef.current) {
        clearInterval(uiUpdateTimerRef.current);
        uiUpdateTimerRef.current = null;
      }
    };
  }, []);

  /**
   * Initialize component - fetch runtimes and start auto-refresh.
   * Only runs after RuntimeService is ready.
   */
  useEffect(() => {
    if (
      !isInitializedRef.current &&
      userAuthenticated &&
      runtimeService &&
      runtimeService.state === 'ready'
    ) {
      const initializePage = async () => {
        isInitializedRef.current = true;
        logger.info('[Runtimes] Initializing page with ready RuntimeService');

        // Initial fetch - force refresh to get fresh data
        await handleManualRefresh();

        // Mark as loaded after initial fetch
        setLoading(false);

        // Start auto-refresh
        startAutoRefresh();
      };

      initializePage();
    }

    return () => {
      if (autoRefreshTimerRef.current) {
        logger.debug('[Runtimes] Cleaning up auto-refresh timer');
        clearInterval(autoRefreshTimerRef.current);
        autoRefreshTimerRef.current = null;
      }
    };
  }, [
    userAuthenticated,
    runtimeService,
    runtimeService?.state,
    handleManualRefresh,
    startAutoRefresh,
  ]);

  /**
   * Subscribe to runtime list refresh events from the service.
   */
  useEffect(() => {
    if (!runtimeService) return;

    const unsubscribe = runtimeService.onRuntimeListRefreshed(
      (updatedRuntimes: Runtime[]) => {
        logger.debug(
          '[Runtimes] Runtime list refreshed event:',
          updatedRuntimes.length
        );
        setRuntimes(updatedRuntimes);
        setLastDataHash(createRuntimesHash(updatedRuntimes));
      }
    );

    return unsubscribe;
  }, [runtimeService]);

  /**
   * Handle create runtime button click.
   */
  const handleCreateRuntime = useCallback(() => {
    logger.info('[Runtimes] Opening create runtime dialog');
    setShowCreateDialog(true);
  }, []);

  /**
   * Handle runtime created successfully.
   */
  const handleRuntimeCreated = useCallback(
    async (runtime: unknown) => {
      logger.info('[Runtimes] Runtime created successfully:', runtime);

      // Refresh runtime list
      if (runtimeService) {
        await runtimeService.refreshAllRuntimes();
      }

      // Refresh the page
      await handleManualRefresh();
    },
    [runtimeService, handleManualRefresh]
  );

  /**
   * Handle individual runtime termination.
   */
  const handleTerminateRuntime = useCallback(async (runtime: Runtime) => {
    setRuntimeToTerminate(runtime);
    setShowTerminateDialog(true);
  }, []);

  /**
   * Confirm individual runtime termination.
   */
  const confirmTerminateRuntime = useCallback(async () => {
    if (!runtimeToTerminate) return;

    logger.info('[Runtimes] Terminating runtime:', runtimeToTerminate.podName);
    setIsTerminating(true);

    try {
      await window.datalayerClient.deleteRuntime(runtimeToTerminate.podName);

      // Notify RuntimeService to update global state
      if (runtimeService) {
        runtimeService.notifyRuntimeTerminated(runtimeToTerminate.podName);
      }

      // Refresh list
      await handleManualRefresh();

      setShowTerminateDialog(false);
      setRuntimeToTerminate(null);
      logger.info('[Runtimes] Runtime terminated successfully');
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to terminate runtime';
      logger.error('[Runtimes] Termination failed:', err);
      setError(errorMessage);
    } finally {
      setIsTerminating(false);
    }
  }, [runtimeToTerminate, runtimeService, handleManualRefresh]);

  /**
   * Handle terminate all runtimes.
   */
  const handleTerminateAll = useCallback(() => {
    logger.info('[Runtimes] Opening terminate all dialog');
    setShowTerminateAllDialog(true);
  }, []);

  /**
   * Confirm terminate all runtimes.
   */
  const confirmTerminateAll = useCallback(async () => {
    logger.info('[Runtimes] Terminating all runtimes:', runtimes.length);
    logger.debug(
      '[Runtimes] Runtime podNames:',
      runtimes.map(r => r.podName)
    );
    setIsTerminating(true);

    try {
      // Terminate all runtimes using the SDK method
      const results = await window.datalayerClient.terminateAllRuntimes();

      // Log results
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          logger.debug(
            `[Runtimes] Successfully deleted runtime at index ${index}`
          );
        } else {
          logger.error(
            `[Runtimes] Failed to delete runtime at index ${index}:`,
            result.reason
          );
        }
      });

      // Notify RuntimeService for each terminated runtime
      if (runtimeService) {
        runtimes.forEach(runtime => {
          runtimeService.notifyRuntimeTerminated(runtime.podName);
        });
      }

      // Refresh list
      await handleManualRefresh();

      setShowTerminateAllDialog(false);
      logger.info('[Runtimes] All runtimes terminated successfully');
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to terminate all runtimes';
      logger.error('[Runtimes] Terminate all failed:', err);
      setError(errorMessage);
    } finally {
      setIsTerminating(false);
    }
  }, [runtimes, runtimeService, handleManualRefresh]);

  /**
   * Handle keyboard shortcuts.
   */
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Escape - close dialogs
      if (event.key === 'Escape') {
        if (showTerminateDialog) {
          setShowTerminateDialog(false);
          setRuntimeToTerminate(null);
        }
        if (showTerminateAllDialog) {
          setShowTerminateAllDialog(false);
        }
      }

      // Ctrl+R or F5 - refresh
      if (
        (event.key === 'r' || event.key === 'R') &&
        (event.ctrlKey || event.metaKey)
      ) {
        event.preventDefault();
        handleManualRefresh();
      }

      if (event.key === 'F5') {
        event.preventDefault();
        handleManualRefresh();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [showTerminateDialog, showTerminateAllDialog, handleManualRefresh]);

  // Calculate runtime statistics
  const stats = calculateRuntimeStats(runtimes);

  return (
    <Box
      className="runtimes-page"
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        p: 3,
      }}
    >
      {/* Fixed header */}
      <Header
        runtimeCount={runtimes.length}
        stats={stats}
        isRefreshing={isRefreshing}
        onRefresh={handleManualRefresh}
        onTerminateAll={handleTerminateAll}
        onCreateRuntime={handleCreateRuntime}
        disabled={false}
      />

      {/* Scrollable content area */}
      <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', pr: 1 }}>
        {!userAuthenticated && (
          <ErrorMessage warning="Please log in to view active runtimes" />
        )}

        {error && !loading && <ErrorMessage error={error} />}

        <RuntimesList
          runtimes={runtimes}
          loading={loading}
          onTerminate={handleTerminateRuntime}
        />
      </Box>

      {/* Dialogs */}
      <CreateRuntimeDialog
        isOpen={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onRuntimeCreated={handleRuntimeCreated}
      />

      <TerminateRuntimeDialog
        isOpen={showTerminateDialog}
        isTerminating={isTerminating}
        onConfirm={confirmTerminateRuntime}
        onCancel={() => {
          setShowTerminateDialog(false);
          setRuntimeToTerminate(null);
        }}
      />

      <TerminateAllDialog
        isOpen={showTerminateAllDialog}
        runtimeCount={runtimes.length}
        isTerminating={isTerminating}
        onConfirm={confirmTerminateAll}
        onCancel={() => {
          setShowTerminateAllDialog(false);
        }}
      />
    </Box>
  );
};

export default Runtimes;
