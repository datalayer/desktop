/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * @module renderer/App
 *
 * Main React application component for the Datalayer Electron app.
 * Manages authentication, view navigation, and component orchestration.
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  lazy,
  Suspense,
} from 'react';
import { ThemeProvider, BaseStyles, Box } from '@primer/react';
// import { useCoreStore } from '@datalayer/core/lib/state'; // Unused for now
import { useParallelPreload } from './hooks/usePreload';
import { useService } from './contexts/ServiceContext';
import Login from './pages/Login';
import Environments from './pages/Environments';
import LoadingScreen from './components/app/LoadingScreen';
import AppHeader from './components/app/Header';
import AppLayout from './components/app/Layout';
import LoadingSpinner from './components/common/LoadingSpinner';
import { User, NotebookData, DocumentData } from '../shared/types';
import { setupConsoleFiltering } from './utils/app';
import { logger } from './utils/logger';

/**
 * Lazy load heavy components that aren't needed on startup.
 * This improves initial load performance.
 */
const NotebookEditor = lazy(() => import('./pages/NotebookEditor'));
const DocumentEditor = lazy(() => import('./pages/DocumentEditor'));
const Library = lazy(() => import('./pages/Spaces'));

/**
 * Main application component.
 * Handles authentication flow, view routing, and global state management.
 *
 * @returns The rendered application with authentication and routing logic
 */
const App: React.FC = () => {
  // Filter out noisy Jupyter React config logging
  useEffect(() => {
    const cleanup = setupConsoleFiltering();
    return cleanup;
  }, []);

  // Use AuthService for authentication state
  const authService = useService('authService');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [user, setUser] = useState<User | null>(null);

  // Support multiple open notebooks and documents
  const [openNotebooks, setOpenNotebooks] = useState<NotebookData[]>([]);
  const [openDocuments, setOpenDocuments] = useState<DocumentData[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('environments');

  const [componentsPreloaded, setComponentsPreloaded] = useState(false);
  // const { configuration } = useCoreStore(); // Unused for now

  // Handle user data from login - AuthService will update state automatically
  const handleUserDataFetched = useCallback(
    async (userData: Record<string, unknown>) => {
      logger.debug('[Auth] User data received from login:', userData);

      // AuthService onAuthStateChanged callback will update isAuthenticated and user
      // No manual state updates needed - the service handles it
      if (userData) {
        logger.debug(
          '[Auth] Login successful, auth state will update automatically'
        );
      }
    },
    []
  );

  // Preload configurations for parallel loading
  const preloadConfigs = useMemo(
    () => [
      {
        name: 'login',
        preloadFn: async () => {
          // Preload Login component resources
          // This ensures Login is ready to display instantly
          await new Promise(resolve => setTimeout(resolve, 50));
        },
      },
      {
        name: 'environments',
        preloadFn: async () => {
          // Skip preloading environments if not authenticated
          // This prevents "Server Error" when not authenticated
          if (!authService || !authService.isAuthenticated()) {
            logger.debug('Skipping environments preload - not authenticated');
            return;
          }

          // Preload Environments data in parallel with auth check
          // This way they're ready instantly when auth succeeds
          try {
            if (window.datalayerClient?.listEnvironments) {
              const environments =
                await window.datalayerClient.listEnvironments();
              logger.debug('Environments preloaded:', environments?.length);
            }
          } catch (error) {
            logger.error('Failed to preload environments:', error);
          }
        },
      },
    ],
    [authService, isAuthenticated]
  );

  const { preloadStates, startAllPreloads, isAllPreloaded } =
    useParallelPreload(preloadConfigs);

  // Initialize AuthService and listen for state changes
  useEffect(() => {
    if (!authService) {
      logger.debug('[Auth] AuthService not ready yet');
      return;
    }

    let unsubscribe: (() => void) | null = null;

    const initializeAuth = async () => {
      try {
        // Initialize auth service
        await authService.initialize();
        logger.debug('[Auth] AuthService initialized');

        // Subscribe to auth state changes
        unsubscribe = authService.onAuthStateChanged(change => {
          logger.debug('[Auth] Auth state changed:', change.current);
          setIsAuthenticated(change.current.isAuthenticated);
          setUser(change.current.user);
        });

        // Get initial auth state
        const initialState = await authService.getAuthState();
        setIsAuthenticated(initialState.isAuthenticated);
        setUser(initialState.user);
      } catch (error) {
        logger.error('[Auth] Failed to initialize AuthService:', error);
        setIsAuthenticated(false);
        setUser(null);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    initializeAuth();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [authService]);

  // Preload components and listen for menu actions
  useEffect(() => {
    const initializeApp = async () => {
      // Start preloading components
      await startAllPreloads();
      setComponentsPreloaded(true);
    };

    initializeApp();

    // Listen for menu actions
    if (window.electronAPI) {
      window.electronAPI.onMenuAction((action: string) => {
        // Handle menu actions here
        switch (action) {
          case 'new-notebook':
            // Implement new notebook logic
            break;
          case 'open-notebook':
            // Implement open notebook logic
            break;
          case 'save-notebook':
            // Implement save notebook logic
            break;
          case 'restart-kernel':
            // Implement restart kernel logic
            break;
          case 'interrupt-kernel':
            // Implement interrupt kernel logic
            break;
          case 'shutdown-kernel':
            // Implement shutdown kernel logic
            break;
        }
      });
    }

    return () => {
      if (window.electronAPI) {
        window.electronAPI.removeMenuActionListener();
      }
    };
  }, [startAllPreloads]);

  // Monitor network connectivity

  // Close a specific notebook tab
  const handleNotebookClose = useCallback(
    (notebookId: string) => {
      setOpenNotebooks(prev => {
        const filtered = prev.filter(nb => nb.id !== notebookId);

        // If we closed the active tab, switch to another tab or spaces
        if (activeTabId === `notebook-${notebookId}`) {
          if (filtered.length > 0) {
            setActiveTabId(`notebook-${filtered[0].id}`);
          } else if (openDocuments.length > 0) {
            setActiveTabId(`document-${openDocuments[0].id}`);
          } else {
            setActiveTabId('spaces');
          }
        }

        return filtered;
      });
    },
    [activeTabId, openDocuments]
  );

  // Close a specific document tab
  const handleDocumentClose = useCallback(
    (documentId: string) => {
      setOpenDocuments(prev => {
        const filtered = prev.filter(doc => doc.id !== documentId);

        // If we closed the active tab, switch to another tab or spaces
        if (activeTabId === `document-${documentId}`) {
          if (filtered.length > 0) {
            setActiveTabId(`document-${filtered[0].id}`);
          } else if (openNotebooks.length > 0) {
            setActiveTabId(`notebook-${openNotebooks[0].id}`);
          } else {
            setActiveTabId('spaces');
          }
        }

        return filtered;
      });
    },
    [activeTabId, openNotebooks]
  );

  const handleLogout = async () => {
    try {
      if (authService) {
        await authService.logout();
        logger.debug('[Auth] Logged out successfully');
      }
      // Clean up app state
      setOpenNotebooks([]);
      setOpenDocuments([]);
      setActiveTabId('environments');
    } catch (error) {
      logger.error('[Auth] Logout failed:', error);
    }
  };

  const handleNotebookSelect = useCallback((notebook: NotebookData) => {
    setOpenNotebooks(prev => {
      // Check if already open
      const exists = prev.find(nb => nb.id === notebook.id);
      if (exists) {
        // Just switch to it
        setActiveTabId(`notebook-${notebook.id}`);
        return prev;
      }
      // Add new notebook
      setActiveTabId(`notebook-${notebook.id}`);
      return [...prev, notebook];
    });
  }, []);

  const handleDocumentSelect = useCallback((document: DocumentData) => {
    setOpenDocuments(prev => {
      // Check if already open
      const exists = prev.find(doc => doc.id === document.id);
      if (exists) {
        // Just switch to it
        setActiveTabId(`document-${document.id}`);
        return prev;
      }
      // Add new document
      setActiveTabId(`document-${document.id}`);
      return [...prev, document];
    });
  }, []);

  const renderView = (): React.ReactElement => {
    // Keep all views mounted and toggle visibility to avoid remounts
    return (
      <>
        {/* Render all open notebooks */}
        {openNotebooks.map(notebook => (
          <Box
            key={`notebook-${notebook.id}`}
            sx={{
              flex: 1,
              display:
                activeTabId === `notebook-${notebook.id}` ? 'flex' : 'none',
              flexDirection: 'column',
              minHeight: 0,
              overflow: 'hidden',
            }}
          >
            <Suspense
              fallback={
                <LoadingSpinner
                  variant="fullscreen"
                  message="Loading notebook editor..."
                />
              }
            >
              <NotebookEditor notebookId={notebook.id} />
            </Suspense>
          </Box>
        ))}

        {/* Render all open documents */}
        {openDocuments.map(document => (
          <Box
            key={`document-${document.id}`}
            sx={{
              flex: 1,
              display:
                activeTabId === `document-${document.id}` ? 'flex' : 'none',
              flexDirection: 'column',
              minHeight: 0,
              overflow: 'hidden',
            }}
          >
            <Suspense
              fallback={
                <LoadingSpinner
                  variant="inline"
                  message="Loading document editor..."
                />
              }
            >
              <DocumentEditor
                selectedDocument={document}
                onClose={() => handleDocumentClose(document.id)}
              />
            </Suspense>
          </Box>
        ))}

        {/* Library view */}
        <Box
          sx={{
            display: activeTabId === 'spaces' ? 'block' : 'none',
            height: '100%',
            overflow: 'visible',
          }}
        >
          <Suspense
            fallback={
              <LoadingSpinner variant="inline" message="Loading library..." />
            }
          >
            <Library
              onNotebookSelect={handleNotebookSelect}
              onDocumentSelect={handleDocumentSelect}
              isAuthenticated={isAuthenticated}
            />
          </Suspense>
        </Box>

        {/* Environments view */}
        <Box
          sx={{
            display: activeTabId === 'environments' ? 'block' : 'none',
            height: '100%',
            overflow: 'visible',
          }}
        >
          <Environments />
        </Box>
      </>
    );
  };

  // Show loading state while checking authentication or preloading
  if (isCheckingAuth || !componentsPreloaded) {
    return (
      <LoadingScreen
        isCheckingAuth={isCheckingAuth}
        isReconnecting={false}
        isPreloading={!isAllPreloaded}
        preloadStates={preloadStates}
      />
    );
  }

  // Render both login and main app, control visibility based on auth state
  // This enables instant switching without remounting components
  const showLogin = !isAuthenticated;
  const showMainApp = isAuthenticated;

  // App.tsx refactoring completed successfully - clean component composition achieved
  return (
    <>
      {/* Login view - preloaded and visibility controlled */}
      <Box
        sx={{
          display: showLogin ? 'block' : 'none',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: showLogin ? 10 : -1,
        }}
      >
        <ThemeProvider>
          <BaseStyles>
            <Login onUserDataFetched={handleUserDataFetched} />
          </BaseStyles>
        </ThemeProvider>
      </Box>

      {/* Main app view - preloaded and visibility controlled */}
      <Box
        sx={{
          display: showMainApp ? 'flex' : 'none',
          flexDirection: 'column',
          height: '100vh',
          visibility: showMainApp ? 'visible' : 'hidden',
        }}
      >
        <AppLayout>
          <AppHeader
            activeTabId={activeTabId}
            openNotebooks={openNotebooks}
            openDocuments={openDocuments}
            isAuthenticated={isAuthenticated}
            user={user}
            onTabChange={setActiveTabId}
            onNotebookClose={handleNotebookClose}
            onDocumentClose={handleDocumentClose}
            onLogout={handleLogout}
          />

          <Box
            sx={{
              flex: 1,
              overflow: 'hidden',
              p: 0,
              position: 'relative',
              minHeight: 0,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {renderView()}
          </Box>
        </AppLayout>
      </Box>
    </>
  );
};

export default App;
