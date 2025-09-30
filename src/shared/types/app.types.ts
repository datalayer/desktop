/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * @module shared/types/app.types
 * @description Type definitions for the main application components.
 */

/**
 * Application view types.
 * @typedef {'notebooks' | 'notebook' | 'document' | 'environments'} ViewType
 */
export type ViewType = 'notebooks' | 'notebook' | 'document' | 'environments';

// User type is imported from core library
import type { UserJSON } from '@datalayer/core/lib/client';
export type User = UserJSON;

/**
 * Props for the loading screen component.
 * @interface LoadingScreenProps
 */
export interface LoadingScreenProps {
  /** Whether authentication is being checked */
  isCheckingAuth: boolean;
  /** Whether reconnecting to existing runtimes */
  isReconnecting: boolean;
}

/**
 * Props for navigation tab component.
 * @interface NavigationTabProps
 */
export interface NavigationTabProps {
  /** Tab label text */
  label: string;
  /** Icon component to display */
  icon: React.ComponentType<any>;
  /** Whether this tab is currently active */
  isActive: boolean;
  /** Click handler for tab selection */
  onClick: () => void;
  /** Optional ARIA label for accessibility */
  'aria-label'?: string;
}

/**
 * Props for navigation tabs container.
 * @interface NavigationTabsProps
 */
export interface NavigationTabsProps {
  /** Currently active view */
  currentView: ViewType;
  /** Whether notebook editor is active */
  isNotebookEditorActive: boolean;
  /** Whether document editor is active */
  isDocumentEditorActive: boolean;
  /** Callback for view changes */
  onViewChange: (view: ViewType) => void;
}

/**
 * Props for user menu component.
 * @interface UserMenuProps
 */
export interface UserMenuProps {
  /** User information */
  user: User;
  /** Whether menu is open */
  isOpen: boolean;
  /** Callback for menu open state changes */
  onOpenChange: (open: boolean) => void;
  /** Logout callback */
  onLogout: () => void;
}

/**
 * Props for application header component.
 * @interface AppHeaderProps
 */
export interface AppHeaderProps {
  /** Currently active view */
  currentView: ViewType;
  /** Whether notebook editor is active */
  isNotebookEditorActive: boolean;
  /** Whether document editor is active */
  isDocumentEditorActive: boolean;
  /** User authentication status */
  isAuthenticated: boolean;
  /** User information if authenticated */
  user: User | null;
  /** Callback for view changes */
  onViewChange: (view: ViewType) => void;
  /** Logout callback */
  onLogout: () => void;
}

/**
 * Props for application layout component.
 * @interface AppLayoutProps
 */
export interface AppLayoutProps {
  /** Child components to render */
  children: React.ReactNode;
}
