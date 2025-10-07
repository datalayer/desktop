/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Type definitions for runtimes page and components.
 *
 * @module shared/types/runtimes
 */

import type { Runtime } from '../../renderer/services/interfaces/IRuntimeService';

/**
 * Runtime status based on expiration time.
 */
export type RuntimeStatus = 'running' | 'expiring' | 'expired';

/**
 * Runtime statistics for the header display.
 */
export interface RuntimeStats {
  total: number;
  running: number;
  expiringSoon: number; // < 5 minutes remaining
  expired: number;
}

/**
 * Props for RuntimeItem component.
 */
export interface RuntimeItemProps {
  runtime: Runtime;
  onTerminate: (runtime: Runtime) => void;
}

/**
 * Props for RuntimesList component.
 */
export interface RuntimesListProps {
  runtimes: Runtime[];
  loading: boolean;
  onTerminate: (runtime: Runtime) => void;
}

/**
 * Props for Runtimes page Header component.
 */
export interface RuntimesHeaderProps {
  runtimeCount: number;
  stats: RuntimeStats;
  isRefreshing: boolean;
  onRefresh: () => void;
  onTerminateAll: () => void;
  onCreateRuntime: () => void;
  disabled?: boolean;
}

/**
 * Props for TerminateAllDialog component.
 */
export interface TerminateAllDialogProps {
  isOpen: boolean;
  runtimeCount: number;
  isTerminating: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Props for main Runtimes page component.
 */
export interface RuntimesPageProps {
  isAuthenticated?: boolean;
}
