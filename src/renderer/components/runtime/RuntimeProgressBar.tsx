/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Runtime progress bar showing remaining time for runtimes.
 * Displays as a thin colored line at the top that depletes over time.
 *
 * @module RuntimeProgressBar
 */

import React, { useState, useEffect, useMemo } from 'react';
import { Box } from '@primer/react';

export interface RuntimeProgressBarProps {
  /** Runtime pod name - used to fetch runtime details */
  runtimePodName?: string;
}

/**
 * Displays a progress bar showing remaining runtime time.
 * Changes color from green to yellow to red as time runs out.
 * Fetches runtime details from the API to get start time and duration.
 */
export const RuntimeProgressBar: React.FC<RuntimeProgressBarProps> = ({
  runtimePodName,
}) => {
  const [percentage, setPercentage] = useState(0);
  const [isExpired, setIsExpired] = useState(false);
  const [runtimeDetails, setRuntimeDetails] = useState<{
    startedAt: Date;
    expiresAt: Date;
  } | null>(null);

  // Fetch runtime details when pod name changes
  useEffect(() => {
    if (!runtimePodName) {
      setRuntimeDetails(null);
      return;
    }

    // Fetch runtime info from API
    // Bridge returns plain JSON object (RuntimeJSON), not SDK model
    window.datalayerClient
      .getRuntime(runtimePodName)
      .then((runtimeJSON: any) => {
        // Bridge already serialized to RuntimeJSON with camelCase and ISO strings
        if (runtimeJSON.startedAt && runtimeJSON.expiredAt) {
          setRuntimeDetails({
            startedAt: new Date(runtimeJSON.startedAt),
            expiresAt: new Date(runtimeJSON.expiredAt),
          });
        }
      })
      .catch((error: Error) => {
        console.error(
          '[RuntimeProgressBar] Failed to fetch runtime details:',
          error
        );
        setRuntimeDetails(null);
      });
  }, [runtimePodName]);

  // Calculate initial time remaining and total duration
  const { initialSeconds, totalSeconds } = useMemo(() => {
    if (!runtimePodName || !runtimeDetails) {
      return { initialSeconds: 0, totalSeconds: 0 };
    }

    const now = Date.now();
    const startedAt = runtimeDetails.startedAt.getTime();
    const expiresAt = runtimeDetails.expiresAt.getTime();

    const totalDuration = Math.floor((expiresAt - startedAt) / 1000);
    const remaining = Math.max(0, Math.floor((expiresAt - now) / 1000));

    return { initialSeconds: remaining, totalSeconds: totalDuration };
  }, [runtimePodName, runtimeDetails]);

  // Set up countdown timer
  useEffect(() => {
    if (!runtimePodName || initialSeconds <= 0) {
      setPercentage(0);
      return;
    }

    // Calculate initial percentage (how much time has been used)
    const elapsedSeconds = totalSeconds - initialSeconds;
    const initialPercentage =
      totalSeconds > 0 ? (elapsedSeconds / totalSeconds) * 100 : 0;

    setPercentage(Math.max(0, Math.min(100, initialPercentage)));

    let currentSeconds = initialSeconds;

    const interval = setInterval(() => {
      currentSeconds = Math.max(0, currentSeconds - 1);

      // Calculate percentage based on elapsed time (fills as time passes)
      const elapsed = totalSeconds - currentSeconds;
      const pct = totalSeconds > 0 ? (elapsed / totalSeconds) * 100 : 100;

      setPercentage(Math.max(0, Math.min(100, pct)));

      if (currentSeconds === 0 && !isExpired) {
        setIsExpired(true);
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [runtimePodName, initialSeconds, totalSeconds, isExpired]);

  // Don't show bar if no runtime
  if (!runtimePodName) {
    return null;
  }

  // Determine bar color based on used percentage
  const getBarColor = () => {
    if (percentage >= 100) return '#DC3545'; // Red - expired
    if (percentage > 90) return '#DC3545'; // Red - critical
    if (percentage > 70) return '#FFA500'; // Orange - warning
    return '#16A085'; // Green - normal (Datalayer brand green)
  };

  return (
    <Box
      sx={{
        width: '100%',
        height: '3px',
        backgroundColor: '#e1e4e8',
        position: 'relative',
      }}
    >
      {/* Animated progress indicator */}
      <Box
        sx={{
          height: '100%',
          width: `${percentage}%`,
          backgroundColor: getBarColor(),
          transition: 'width 1s linear, background-color 0.3s ease',
          position: 'relative',
        }}
      >
        {/* Pulse animation for low time warning */}
        {percentage > 90 && percentage < 100 && (
          <Box
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'inherit',
              animation: 'pulse 2s infinite',
            }}
          />
        )}
      </Box>

      {/* CSS for pulse animation */}
      <style>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.6; }
          100% { opacity: 1; }
        }
      `}</style>
    </Box>
  );
};

export default RuntimeProgressBar;
