/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Navigation tabs container component that manages tab visibility and state.
 *
 * @module renderer/components/app/NavigationTabs
 */

import React from 'react';
import { Header, IconButton, Box } from '@primer/react';
import {
  ServerIcon,
  BookIcon,
  FileIcon,
  XIcon,
  AgentIcon,
  SpaceIcon,
} from '@primer/octicons-react';
import NavigationTab from './NavigationTab';

export interface NavigationTabsProps {
  activeTabId: string;
  openNotebooks: Array<{ id: string; name: string; description?: string }>;
  openDocuments: Array<{ id: string; name: string; description?: string }>;
  onTabChange: (tabId: string) => void;
  onNotebookClose: (notebookId: string) => void;
  onDocumentClose: (documentId: string) => void;
}

/**
 * Container component for navigation tabs with horizontal scrolling.
 * Shows Spaces, Agents, Environments, and all open notebooks/documents.
 */
const NavigationTabs: React.FC<NavigationTabsProps> = ({
  activeTabId,
  openNotebooks,
  openDocuments,
  onTabChange,
  onNotebookClose,
  onDocumentClose,
}) => {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        overflowX: 'auto',
        overflowY: 'hidden',
        flex: 1,
        // Custom scrollbar styles
        '&::-webkit-scrollbar': {
          height: '6px',
        },
        '&::-webkit-scrollbar-thumb': {
          backgroundColor: 'neutral.muted',
          borderRadius: '3px',
        },
        '&::-webkit-scrollbar-track': {
          backgroundColor: 'transparent',
        },
      }}
    >
      {/* Fixed tabs - cannot be closed */}
      <NavigationTab
        label="Spaces"
        icon={SpaceIcon as unknown as React.ComponentType<{ size?: number }>}
        isActive={activeTabId === 'spaces'}
        onClick={() => onTabChange('spaces')}
      />

      <NavigationTab
        label="Agents"
        icon={AgentIcon as unknown as React.ComponentType<{ size?: number }>}
        isActive={activeTabId === 'runtimes'}
        onClick={() => onTabChange('runtimes')}
      />

      <NavigationTab
        label="Environments"
        icon={ServerIcon as unknown as React.ComponentType<{ size?: number }>}
        isActive={activeTabId === 'environments'}
        onClick={() => onTabChange('environments')}
      />

      {/* Dynamic notebook tabs - can be closed */}
      {openNotebooks.map(notebook => (
        <Header.Item key={`notebook-${notebook.id}`}>
          <Header.Link
            href="#"
            onClick={(e: React.MouseEvent) => {
              e.preventDefault();
              onTabChange(`notebook-${notebook.id}`);
            }}
            title={notebook.description}
            sx={{
              fontWeight: 'normal',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              pr: 1,
              color:
                activeTabId === `notebook-${notebook.id}`
                  ? 'accent.fg'
                  : 'fg.default',
              borderBottom:
                activeTabId === `notebook-${notebook.id}`
                  ? '2px solid var(--borderColor-accent-emphasis)'
                  : '2px solid transparent',
              paddingBottom: '4px',
              textDecoration: 'none',
              backgroundColor: 'transparent',
              outline: 'none',
              '&:hover': {
                textDecoration: 'none',
                color: 'accent.fg',
                backgroundColor: 'transparent',
              },
              '&:active, &:visited': {
                color:
                  activeTabId === `notebook-${notebook.id}`
                    ? 'accent.fg'
                    : 'fg.default',
                backgroundColor: 'transparent',
              },
              '&:focus, &:focus-visible': {
                color:
                  activeTabId === `notebook-${notebook.id}`
                    ? 'accent.fg'
                    : 'fg.default',
                backgroundColor: 'transparent',
                outline: '2px solid',
                outlineColor: 'accent.emphasis',
                outlineOffset: '-2px',
              },
              '& span': {
                color: 'inherit',
              },
              '& svg': {
                color: 'inherit',
              },
            }}
          >
            <BookIcon size={16} />
            <span>{notebook.name}</span>
            <IconButton
              icon={XIcon}
              size="small"
              aria-label="Close tab"
              onClick={e => {
                e.preventDefault();
                e.stopPropagation();
                onNotebookClose(notebook.id);
              }}
              sx={{
                width: '18px',
                height: '18px',
                padding: 0,
                ml: 1,
                color: 'fg.muted',
                '&:hover': {
                  backgroundColor: 'neutral.muted',
                  color: 'fg.default',
                },
              }}
            />
          </Header.Link>
        </Header.Item>
      ))}

      {/* Dynamic document tabs - can be closed */}
      {openDocuments.map(document => (
        <Header.Item key={`document-${document.id}`}>
          <Header.Link
            href="#"
            onClick={(e: React.MouseEvent) => {
              e.preventDefault();
              onTabChange(`document-${document.id}`);
            }}
            title={document.description}
            sx={{
              fontWeight: 'normal',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              pr: 1,
              color:
                activeTabId === `document-${document.id}`
                  ? 'accent.fg'
                  : 'fg.default',
              borderBottom:
                activeTabId === `document-${document.id}`
                  ? '2px solid var(--borderColor-accent-emphasis)'
                  : '2px solid transparent',
              paddingBottom: '4px',
              textDecoration: 'none',
              backgroundColor: 'transparent',
              outline: 'none',
              '&:hover': {
                textDecoration: 'none',
                color: 'accent.fg',
                backgroundColor: 'transparent',
              },
              '&:active, &:visited': {
                color:
                  activeTabId === `document-${document.id}`
                    ? 'accent.fg'
                    : 'fg.default',
                backgroundColor: 'transparent',
              },
              '&:focus, &:focus-visible': {
                color:
                  activeTabId === `document-${document.id}`
                    ? 'accent.fg'
                    : 'fg.default',
                backgroundColor: 'transparent',
                outline: '2px solid',
                outlineColor: 'accent.emphasis',
                outlineOffset: '-2px',
              },
              '& span': {
                color: 'inherit',
              },
              '& svg': {
                color: 'inherit',
              },
            }}
          >
            <FileIcon size={16} />
            <span>{document.name}</span>
            <IconButton
              icon={XIcon}
              size="small"
              aria-label="Close tab"
              onClick={e => {
                e.preventDefault();
                e.stopPropagation();
                onDocumentClose(document.id);
              }}
              sx={{
                width: '18px',
                height: '18px',
                padding: 0,
                ml: 1,
                color: 'fg.muted',
                '&:hover': {
                  backgroundColor: 'neutral.muted',
                  color: 'fg.default',
                },
              }}
            />
          </Header.Link>
        </Header.Item>
      ))}

      <Header.Item full />
    </Box>
  );
};

export default NavigationTabs;
