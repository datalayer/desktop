/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Type definitions for main application components.
 *
 * @module shared/types/app.types
 */

export type ViewType = 'notebooks' | 'notebook' | 'document' | 'environments';

import type { UserJSON } from '@datalayer/core/lib/client';
export type User = UserJSON;

export interface LoadingScreenProps {
  isCheckingAuth: boolean;
  isReconnecting: boolean;
}

export interface NavigationTabProps {
  label: string;
  icon: React.ComponentType<any>;
  isActive: boolean;
  onClick: () => void;
  'aria-label'?: string;
  title?: string;
}

export interface NavigationTabsProps {
  currentView: ViewType;
  isNotebookEditorActive: boolean;
  isDocumentEditorActive: boolean;
  onViewChange: (view: ViewType) => void;
  selectedNotebook?: { name: string; description?: string } | null;
  selectedDocument?: { name: string; description?: string } | null;
}

export interface UserMenuProps {
  user: User;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onLogout: () => void;
}

export interface AppHeaderProps {
  currentView: ViewType;
  isNotebookEditorActive: boolean;
  isDocumentEditorActive: boolean;
  isAuthenticated: boolean;
  user: User | null;
  onViewChange: (view: ViewType) => void;
  onLogout: () => void;
  selectedNotebook?: { name: string; description?: string } | null;
  selectedDocument?: { name: string; description?: string } | null;
}

export interface AppLayoutProps {
  children: React.ReactNode;
}
