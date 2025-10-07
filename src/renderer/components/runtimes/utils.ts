/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Utility functions for runtime display and formatting.
 *
 * @module renderer/components/runtimes/utils
 */

import type { Runtime } from '../../services/interfaces/IRuntimeService';
import type {
  RuntimeStatus,
  RuntimeStats,
} from '../../../shared/types/runtimes.types';

/**
 * Format runtime duration remaining in human-readable format.
 * @param runtime - Runtime object
 * @returns Formatted string like "2h 30m remaining" or "Expired"
 */
export const formatRuntimeDuration = (runtime: Runtime): string => {
  if (!runtime.expiredAt) {
    return 'No expiration';
  }

  const expirationTime = new Date(runtime.expiredAt).getTime();
  const now = Date.now();
  const timeRemaining = expirationTime - now;

  if (timeRemaining <= 0) {
    return 'Expired';
  }

  const hours = Math.floor(timeRemaining / (1000 * 60 * 60));
  const minutes = Math.floor((timeRemaining % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((timeRemaining % (1000 * 60)) / 1000);

  if (hours > 0) {
    return `${hours}h ${minutes}m remaining`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds}s remaining`;
  } else {
    return `${seconds}s remaining`;
  }
};

/**
 * Get runtime status based on expiration time.
 * @param runtime - Runtime object
 * @returns Runtime status: 'running', 'expiring', or 'expired'
 */
export const getRuntimeStatus = (runtime: Runtime): RuntimeStatus => {
  if (!runtime.expiredAt) {
    return 'running';
  }

  const expirationTime = new Date(runtime.expiredAt).getTime();
  const now = Date.now();
  const timeRemaining = expirationTime - now;

  if (timeRemaining <= 0) {
    return 'expired';
  }

  // Expiring soon if less than 5 minutes remaining
  const fiveMinutes = 5 * 60 * 1000;
  if (timeRemaining < fiveMinutes) {
    return 'expiring';
  }

  return 'running';
};

/**
 * Get progress percentage for runtime expiration (0-100).
 * @param runtime - Runtime object
 * @returns Progress percentage (0 = just started, 100 = expired)
 */
export const getRuntimeProgress = (runtime: Runtime): number => {
  if (!runtime.expiredAt || !runtime.startedAt) {
    return 0;
  }

  const startTime = new Date(runtime.startedAt).getTime();
  const expirationTime = new Date(runtime.expiredAt).getTime();
  const now = Date.now();

  const totalDuration = expirationTime - startTime;
  const elapsed = now - startTime;

  const progress = (elapsed / totalDuration) * 100;
  return Math.min(Math.max(progress, 0), 100);
};

/**
 * Create a hash of runtime list for change detection.
 * @param runtimes - Array of runtimes
 * @returns Hash string for comparison
 */
export const createRuntimesHash = (runtimes: Runtime[]): string => {
  if (!runtimes || runtimes.length === 0) {
    return 'empty';
  }

  // Create hash from runtime UIDs and expiration times
  const hashData = runtimes
    .map(r => `${r.uid}:${r.expiredAt}`)
    .sort()
    .join('|');

  // Simple hash function (good enough for change detection)
  let hash = 0;
  for (let i = 0; i < hashData.length; i++) {
    const char = hashData.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  return hash.toString(36);
};

/**
 * Sort runtimes by various criteria.
 * @param runtimes - Array of runtimes
 * @param sortBy - Sort criteria
 * @returns Sorted array
 */
export const sortRuntimes = (
  runtimes: Runtime[],
  sortBy: 'name' | 'environment' | 'time' = 'time'
): Runtime[] => {
  const sorted = [...runtimes];

  switch (sortBy) {
    case 'name':
      return sorted.sort((a, b) =>
        (a.givenName || a.podName).localeCompare(b.givenName || b.podName)
      );

    case 'environment':
      return sorted.sort((a, b) =>
        (a.environmentTitle || '').localeCompare(b.environmentTitle || '')
      );

    case 'time':
      // Sort by expiration time (soonest first)
      return sorted.sort((a, b) => {
        if (!a.expiredAt) return 1;
        if (!b.expiredAt) return -1;
        return (
          new Date(a.expiredAt).getTime() - new Date(b.expiredAt).getTime()
        );
      });

    default:
      return sorted;
  }
};

/**
 * Calculate runtime statistics.
 * @param runtimes - Array of runtimes
 * @returns Runtime statistics
 */
export const calculateRuntimeStats = (runtimes: Runtime[]): RuntimeStats => {
  const stats: RuntimeStats = {
    total: runtimes.length,
    running: 0,
    expiringSoon: 0,
    expired: 0,
  };

  for (const runtime of runtimes) {
    const status = getRuntimeStatus(runtime);

    switch (status) {
      case 'running':
        stats.running++;
        break;
      case 'expiring':
        stats.expiringSoon++;
        break;
      case 'expired':
        stats.expired++;
        break;
    }
  }

  return stats;
};

/**
 * Format runtime name for display.
 * @param runtime - Runtime object
 * @returns Formatted name
 */
export const formatRuntimeName = (runtime: Runtime): string => {
  return runtime.givenName || runtime.podName || 'Unnamed Runtime';
};

/**
 * Get status color based on runtime status.
 * @param status - Runtime status
 * @returns Color string
 */
export const getStatusColor = (status: RuntimeStatus): string => {
  switch (status) {
    case 'running':
      return '#28a745'; // Green
    case 'expiring':
      return '#ffa500'; // Orange
    case 'expired':
      return '#dc3545'; // Red
    default:
      return '#6c757d'; // Gray
  }
};
