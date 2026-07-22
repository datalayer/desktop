/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Application header component with navigation and user menu.
 *
 * @module renderer/components/app/Header
 */

import React, { useState } from 'react';
import { Header } from '@primer/react';
import {
  AppearanceControlsWithStore,
  DatalayerLogoText,
  useSystemColorMode,
} from '@datalayer/primer-addons';
import { useThemeStore } from '../../theme/themeStore';
import NavigationTabs from './NavigationTabs';
import UserMenu from './UserMenu';
import { User } from '../../../shared/types';

export interface AppHeaderProps {
  activeTabId: string;
  openNotebooks: Array<{ id: string; name: string; description?: string }>;
  openDocuments: Array<{ id: string; name: string; description?: string }>;
  isAuthenticated: boolean;
  user: User | null;
  onTabChange: (tabId: string) => void;
  onNotebookClose: (notebookId: string) => void;
  onDocumentClose: (documentId: string) => void;
  onLogout: () => void;
}

/**
 * Application header component with tab navigation.
 */
const AppHeader: React.FC<AppHeaderProps> = ({
  activeTabId,
  openNotebooks,
  openDocuments,
  isAuthenticated,
  user,
  onTabChange,
  onNotebookClose,
  onDocumentClose,
  onLogout,
}) => {
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const colorMode = useThemeStore(state => state.colorMode);
  const themeVariant = useThemeStore(state => state.theme);
  const systemColorMode = useSystemColorMode();
  const resolvedColorMode = colorMode === 'auto' ? systemColorMode : colorMode;

  return (
    <Header
      sx={{
        backgroundColor: 'canvas.default',
        color: 'fg.default',
        borderBottom: '1px solid',
        borderColor: 'border.default',
      }}
    >
      <Header.Item sx={{ mr: 3 }}>
        <DatalayerLogoText
          size={24}
          colorMode={resolvedColorMode}
          variant={themeVariant}
          inverse
          aria-label="Datalayer"
        />
      </Header.Item>

      <NavigationTabs
        activeTabId={activeTabId}
        openNotebooks={openNotebooks}
        openDocuments={openDocuments}
        onTabChange={onTabChange}
        onNotebookClose={onNotebookClose}
        onDocumentClose={onDocumentClose}
      />

      <Header.Item sx={{ mr: 2 }}>
        <AppearanceControlsWithStore useStore={useThemeStore} />
      </Header.Item>

      {isAuthenticated && user && (
        <UserMenu
          user={user}
          isOpen={isUserMenuOpen}
          onOpenChange={setIsUserMenuOpen}
          onLogout={onLogout}
        />
      )}
    </Header>
  );
};

export default AppHeader;
