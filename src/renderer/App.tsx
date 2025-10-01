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
import { useCoreStore } from '@datalayer/core/lib/state';
import { useParallelPreload } from './hooks/usePreload';
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

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [authState, setAuthState] = useState<{
    isAuthenticated: boolean;
    user: any | null;
    token: string | null;
    runUrl: string;
  } | null>(null);

  // Support multiple open notebooks and documents
  const [openNotebooks, setOpenNotebooks] = useState<NotebookData[]>([]);
  const [openDocuments, setOpenDocuments] = useState<DocumentData[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('environments');

  const [componentsPreloaded, setComponentsPreloaded] = useState(false);
  const { configuration } = useCoreStore();

  // Handle user data from login - update auth state when login succeeds
  const handleUserDataFetched = useCallback(
    async (userData: Record<string, unknown>) => {
      logger.debug('[Auth] User data received from login:', userData);

      // Since window.electronAPI.onAuthStateChanged may not be available in browser mode,
      // we need to manually update the auth state after successful login
      if (userData) {
        // Get the current auth state from the main process
        try {
          if (window.datalayerClient?.getAuthState) {
            const currentAuthState =
              await window.datalayerClient.getAuthState();
            logger.debug(
              '[Auth] Got auth state after login:',
              currentAuthState
            );

            // Update our local auth state
            if (currentAuthState?.isAuthenticated) {
              setAuthState(currentAuthState);
              setIsAuthenticated(true);

              // User is already a plain JSON object from bridge
              if (currentAuthState.user) {
                setUser(currentAuthState.user);
              }
            }
          }
        } catch (error) {
          logger.error('Failed to get auth state after login:', error);
        }
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
          if (!authState?.isAuthenticated || !authState?.token) {
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
    [authState?.token]
  );

  const { preloadStates, startAllPreloads, isAllPreloaded } =
    useParallelPreload(preloadConfigs);

  useEffect(() => {
    // Set up auth state change listener
    const handleAuthStateChange = (newAuthState: {
      isAuthenticated: boolean;
      user: any | null;
      token: string | null;
      runUrl: string;
    }) => {
      logger.debug('[Auth] Auth state changed:', newAuthState);
      setAuthState(newAuthState);
      setIsAuthenticated(newAuthState.isAuthenticated);

      // User is already a plain JSON object from bridge
      if (newAuthState.user) {
        setUser(newAuthState.user);
      } else {
        setUser(null);
      }
    };

    // Listen for auth state changes from main process
    if (window.electronAPI?.onAuthStateChanged) {
      window.electronAPI.onAuthStateChanged(handleAuthStateChange);
    } else {
      logger.error('[Auth] electronAPI.onAuthStateChanged is not available');
    }

    // Start all operations in parallel for faster startup
    const initializeApp = async () => {
      setIsCheckingAuth(true);

      // Start preloading components immediately
      const preloadPromise = startAllPreloads();

      // Get initial auth state from main process (secure ElectronStorage)
      const authPromise = (async () => {
        try {
          if (window.datalayerClient?.getAuthState) {
            const initialAuthState =
              await window.datalayerClient.getAuthState();
            handleAuthStateChange(initialAuthState);
          } else {
            logger.error(
              '[Auth] datalayerClient.getAuthState is not available'
            );
            handleAuthStateChange({
              isAuthenticated: false,
              user: null,
              token: null,
              runUrl: configuration?.runUrl || '',
            });
          }
        } catch (error) {
          logger.error('Failed to get initial auth state:', error);
          // Set logged out state
          handleAuthStateChange({
            isAuthenticated: false,
            user: null,
            token: null,
            runUrl: '',
          });
        } finally {
          setIsCheckingAuth(false);
        }
      })();

      // Wait for both auth check and preloading to complete
      await Promise.allSettled([authPromise, preloadPromise]);
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
        window.electronAPI.removeAuthStateListener();
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
      // Use secure IPC to logout
      if (window.datalayerClient?.logout) {
        await window.datalayerClient.logout();
      }
      setIsAuthenticated(false);
      setOpenNotebooks([]);
      setOpenDocuments([]);
      setActiveTabId('environments');
    } catch (error) {
      logger.error('Logout failed:', error);
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
        <Box sx={{ display: activeTabId === 'spaces' ? 'block' : 'none' }}>
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
          sx={{ display: activeTabId === 'environments' ? 'block' : 'none' }}
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
              overflow: activeTabId.startsWith('notebook-') ? 'hidden' : 'auto',
              p:
                activeTabId.startsWith('notebook-') ||
                activeTabId.startsWith('document-')
                  ? 0
                  : 3,
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
