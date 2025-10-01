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
import { Header, Text } from '@primer/react';
import { COLORS } from '../../../shared/constants/colors';
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

  return (
    <Header
      sx={{
        backgroundColor: COLORS.background.secondary,
        borderBottom: '1px solid',
        borderColor: 'border.default',
      }}
    >
      <Header.Item>
        <Text
          sx={{
            fontSize: 3,
            fontWeight: 'bold',
            color: COLORS.brand.primary,
            mr: 4,
          }}
        >
          Datalayer Desktop
        </Text>
      </Header.Item>

      <NavigationTabs
        activeTabId={activeTabId}
        openNotebooks={openNotebooks}
        openDocuments={openDocuments}
        onTabChange={onTabChange}
        onNotebookClose={onNotebookClose}
        onDocumentClose={onDocumentClose}
      />

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
