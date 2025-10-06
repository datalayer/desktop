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
import { Box, Select, Spinner, Text } from '@primer/react';
import { RocketIcon, CheckIcon } from '@primer/octicons-react';
import { useService } from '../../contexts/ServiceContext';
import type { Runtime } from '../../services/interfaces/IRuntimeService';

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
  const runtimeService = useService('runtimeService');
  const [allRuntimes, setAllRuntimes] = useState<Runtime[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch runtimes on mount and when selectedRuntimePodName changes
  useEffect(() => {
    if (!runtimeService) return;

    const fetchRuntimes = async () => {
      setIsLoading(true);
      try {
        // Initialize service if needed
        if (runtimeService.state === 'uninitialized') {
          await runtimeService.initialize();
        }

        const runtimes = await runtimeService.refreshAllRuntimes();
        setAllRuntimes(runtimes);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRuntimes();
  }, [selectedRuntimePodName, runtimeService]);

  // Calculate remaining time for a runtime
  const getRemainingTime = (runtime: Runtime): string => {
    try {
      const parseTimestamp = (value: string | number) => {
        if (typeof value === 'string' && !value.includes('-')) {
          return new Date(parseFloat(value) * 1000);
        }
        return new Date(value);
      };

      const expiresAt = parseTimestamp(
        (runtime.expired_at || runtime.expiredAt) as string
      ).getTime();
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
    const name =
      runtime.given_name ||
      runtime.givenName ||
      runtime.pod_name ||
      runtime.podName;
    const envTitle =
      runtime.environment_title || runtime.environmentTitle || 'Unknown Env';
    const remaining = getRemainingTime(runtime);
    return `${name} - ${envTitle} (${remaining})`;
  };

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;

    if (value === '__create_new__') {
      onRuntimeSelected(null);
    } else {
      const selectedRuntime = allRuntimes.find(
        r => (r.pod_name || r.podName) === value
      );
      if (selectedRuntime) {
        onRuntimeSelected(selectedRuntime);
      }
    }
  };

  // Get current value for select - always use placeholder if no runtime selected
  const currentValue = selectedRuntimePodName || '__placeholder__';

  // Get display text for the current selection
  const getCurrentDisplayText = () => {
    if (!selectedRuntimePodName) {
      return 'Runtimes';
    }
    const currentRuntime = allRuntimes.find(
      r => (r.pod_name || r.podName) === selectedRuntimePodName
    );
    if (currentRuntime) {
      return getDisplayName(currentRuntime);
    }
    return selectedRuntimePodName;
  };

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
        <Select.Option value="__placeholder__" disabled>
          {getCurrentDisplayText()}
        </Select.Option>

        {allRuntimes.length > 0 && (
          <Select.OptGroup label="Running Runtimes">
            {allRuntimes.map((runtime: any) => {
              const podName = runtime.pod_name || runtime.podName;
              const isActive = podName === selectedRuntimePodName;
              return (
                <Select.Option key={podName} value={podName}>
                  <Box
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      justifyContent: 'space-between',
                    }}
                  >
                    <Text>{getDisplayName(runtime)}</Text>
                    {isActive && <CheckIcon size={16} />}
                  </Box>
                </Select.Option>
              );
            })}
          </Select.OptGroup>
        )}

        <Select.Option value="__create_new__">
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <RocketIcon size={16} />
            <Text>Create New Runtime</Text>
          </Box>
        </Select.Option>
      </Select>
    </Box>
  );
};

export default RuntimeSelector;
