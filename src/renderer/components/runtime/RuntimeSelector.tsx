/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Dropdown for selecting existing runtimes or creating new ones.
 *
 * @module RuntimeSelector
 */

import React, { useEffect, useState } from 'react';
import { Box, Select, Spinner } from '@primer/react';
import type { Runtime } from '../../services/interfaces/IRuntimeService';
import { useService } from '../../contexts/ServiceContext';

export interface RuntimeSelectorProps {
  /** Currently selected runtime pod name */
  selectedRuntimePodName?: string;
  /** Callback when runtime is selected (null = create new) */
  onRuntimeSelected: (runtime: Runtime | null) => void;
  /** Disable the selector */
  disabled?: boolean;
}

/**
 * Dropdown component for selecting runtimes.
 * Shows all running runtimes with remaining time, plus "Create New" option.
 */
export const RuntimeSelector: React.FC<RuntimeSelectorProps> = ({
  selectedRuntimePodName,
  onRuntimeSelected,
  disabled = false,
}) => {
  const [allRuntimes, setAllRuntimes] = useState<Runtime[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const runtimeService = useService('runtimeService');

  // Fetch runtimes on mount
  useEffect(() => {
    const fetchRuntimes = async () => {
      setIsLoading(true);
      try {
        const runtimes = await window.datalayerClient?.listRuntimes();
        setAllRuntimes((runtimes as unknown as Runtime[]) || []);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRuntimes();
  }, []);

  // Subscribe to runtime list refresh events
  useEffect(() => {
    if (!runtimeService) return;

    const unsubscribe = runtimeService.onRuntimeListRefreshed(runtimes => {
      console.log(
        '[RuntimeSelector] Runtime list refreshed, updating dropdown'
      );
      setAllRuntimes(runtimes);
    });

    return () => unsubscribe();
  }, [runtimeService]);

  // Calculate remaining time for a runtime
  const getRemainingTime = (runtime: Runtime): string => {
    try {
      // RuntimeJSON.expiredAt is already an ISO string
      const expiresAt = new Date(runtime.expiredAt).getTime();
      const now = Date.now();
      const remainingMs = Math.max(0, expiresAt - now);
      const remainingMinutes = Math.floor(remainingMs / 60000);

      if (remainingMinutes < 60) {
        return `${remainingMinutes}m`;
      } else {
        const hours = Math.floor(remainingMinutes / 60);
        const mins = remainingMinutes % 60;
        return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
      }
    } catch {
      return 'Unknown';
    }
  };

  // Format display name for runtime
  const getDisplayName = (runtime: Runtime): string => {
    const name = runtime.givenName || runtime.podName;
    const envTitle = runtime.environmentTitle || 'Unknown Env';
    const remaining = getRemainingTime(runtime);
    return `${name} - ${envTitle} (${remaining})`;
  };

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;

    if (value === '__create_new__') {
      onRuntimeSelected(null);
    } else {
      const selectedRuntime = allRuntimes.find(r => r.podName === value);
      if (selectedRuntime) {
        onRuntimeSelected(selectedRuntime);
      }
    }
  };

  // Get current value for select - always use placeholder if no runtime selected
  const currentValue = selectedRuntimePodName || '__placeholder__';

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 280 }}>
      {isLoading && <Spinner size="small" />}
      <Select
        value={currentValue}
        onChange={handleChange}
        disabled={disabled || isLoading}
        size="small"
        sx={{
          flex: 1,
          height: '32px',
          fontSize: '14px',
        }}
      >
        {/* Only show placeholder when no runtime is selected */}
        {!selectedRuntimePodName && (
          <Select.Option value="__placeholder__" disabled>
            Runtimes
          </Select.Option>
        )}

        {allRuntimes.length > 0 && (
          <Select.OptGroup label="Running Runtimes">
            {allRuntimes.map(runtime => {
              const podName = runtime.podName;
              return (
                <Select.Option key={podName} value={podName}>
                  {getDisplayName(runtime)}
                </Select.Option>
              );
            })}
          </Select.OptGroup>
        )}

        <Select.Option value="__create_new__">Create New Runtime</Select.Option>
      </Select>
    </Box>
  );
};

export default RuntimeSelector;
