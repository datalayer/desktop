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
  DatabaseIcon,
  BookIcon,
  FileIcon,
  XIcon,
  CpuIcon,
} from '@primer/octicons-react';
import NavigationTab from './NavigationTab';
import { COLORS } from '../../../shared/constants/colors';

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
 * Shows Environments, Spaces, and all open notebooks/documents.
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
        label="Environments"
        icon={DatabaseIcon as unknown as React.ComponentType<{ size?: number }>}
        isActive={activeTabId === 'environments'}
        onClick={() => onTabChange('environments')}
      />

      <NavigationTab
        label="Spaces"
        icon={BookIcon as unknown as React.ComponentType<{ size?: number }>}
        isActive={activeTabId === 'spaces'}
        onClick={() => onTabChange('spaces')}
      />

      <NavigationTab
        label="Runtimes"
        icon={CpuIcon as unknown as React.ComponentType<{ size?: number }>}
        isActive={activeTabId === 'runtimes'}
        onClick={() => onTabChange('runtimes')}
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
                  ? `${COLORS.brand.primary} !important`
                  : `${COLORS.text.primary} !important`,
              borderBottom:
                activeTabId === `notebook-${notebook.id}`
                  ? `2px solid ${COLORS.brand.primary}`
                  : '2px solid transparent',
              paddingBottom: '4px',
              textDecoration: 'none !important',
              backgroundColor: 'transparent !important',
              outline: 'none',
              '&:hover': {
                textDecoration: 'none !important',
                color: `${COLORS.brand.primary} !important`,
                backgroundColor: 'transparent !important',
              },
              '&:active, &:visited': {
                color:
                  activeTabId === `notebook-${notebook.id}`
                    ? `${COLORS.brand.primary} !important`
                    : `${COLORS.text.primary} !important`,
                backgroundColor: 'transparent !important',
              },
              '&:focus, &:focus-visible': {
                color:
                  activeTabId === `notebook-${notebook.id}`
                    ? `${COLORS.brand.primary} !important`
                    : `${COLORS.text.primary} !important`,
                backgroundColor: 'transparent !important',
                outline: '2px solid',
                outlineColor: 'accent.emphasis',
                outlineOffset: '-2px',
              },
              '& span': {
                color: 'inherit !important',
              },
              '& svg': {
                color: 'inherit !important',
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
                  ? `${COLORS.brand.primary} !important`
                  : `${COLORS.text.primary} !important`,
              borderBottom:
                activeTabId === `document-${document.id}`
                  ? `2px solid ${COLORS.brand.primary}`
                  : '2px solid transparent',
              paddingBottom: '4px',
              textDecoration: 'none !important',
              backgroundColor: 'transparent !important',
              outline: 'none',
              '&:hover': {
                textDecoration: 'none !important',
                color: `${COLORS.brand.primary} !important`,
                backgroundColor: 'transparent !important',
              },
              '&:active, &:visited': {
                color:
                  activeTabId === `document-${document.id}`
                    ? `${COLORS.brand.primary} !important`
                    : `${COLORS.text.primary} !important`,
                backgroundColor: 'transparent !important',
              },
              '&:focus, &:focus-visible': {
                color:
                  activeTabId === `document-${document.id}`
                    ? `${COLORS.brand.primary} !important`
                    : `${COLORS.text.primary} !important`,
                backgroundColor: 'transparent !important',
                outline: '2px solid',
                outlineColor: 'accent.emphasis',
                outlineOffset: '-2px',
              },
              '& span': {
                color: 'inherit !important',
              },
              '& svg': {
                color: 'inherit !important',
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
