/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Skeleton loading component for library items.
 * Displays animated placeholder boxes that mimic the structure of actual library items.
 *
 * @module SkeletonItem
 */

import React from 'react';
import { Box, ActionList } from '@primer/react';

/**
 * Props for the SkeletonItem component.
 */
export interface SkeletonItemProps {
  /** Number of skeleton items to render */
  count?: number;
}

/**
 * Renders multiple skeleton placeholder items for loading states
 */
const SkeletonItem: React.FC<SkeletonItemProps> = ({ count = 3 }) => {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <ActionList.Item
          key={`skeleton-${index}`}
          disabled
          sx={{
            cursor: 'default',
            py: 3,
            '&:hover': {
              bg: 'transparent',
            },
          }}
        >
          <Box sx={{ flex: 1 }}>
            {/* Title skeleton */}
            <Box
              sx={{
                height: '16px',
                width: `${60 + Math.random() * 30}%`,
                bg: 'neutral.muted',
                borderRadius: 1,
                mb: 1,
                animation: 'pulse 1.5s ease-in-out infinite',
                animationDelay: '0.1s',
              }}
            />

            {/* Description skeleton */}
            <Box
              sx={{
                height: '14px',
                width: `${70 + Math.random() * 20}%`,
                bg: 'neutral.muted',
                borderRadius: 1,
                opacity: 0.6,
                animation: 'pulse 1.5s ease-in-out infinite',
                animationDelay: '0.2s',
              }}
            />
          </Box>

          <ActionList.TrailingVisual>
            <Box sx={{ display: 'flex', gap: 1 }}>
              {/* Open button skeleton */}
              <Box
                sx={{
                  width: '60px',
                  height: '32px',
                  bg: 'neutral.muted',
                  borderRadius: 1,
                  animation: 'pulse 1.5s ease-in-out infinite',
                  animationDelay: '0.3s',
                }}
              />
              {/* Edit button skeleton */}
              <Box
                sx={{
                  width: '40px',
                  height: '40px',
                  bg: 'neutral.muted',
                  borderRadius: 1,
                  animation: 'pulse 1.5s ease-in-out infinite',
                  animationDelay: '0.4s',
                }}
              />
              {/* Download button skeleton */}
              <Box
                sx={{
                  width: '40px',
                  height: '40px',
                  bg: 'neutral.muted',
                  borderRadius: 1,
                  animation: 'pulse 1.5s ease-in-out infinite',
                  animationDelay: '0.5s',
                }}
              />
              {/* Delete button skeleton */}
              <Box
                sx={{
                  width: '40px',
                  height: '40px',
                  bg: 'neutral.muted',
                  borderRadius: 1,
                  animation: 'pulse 1.5s ease-in-out infinite',
                  animationDelay: '0.6s',
                }}
              />
            </Box>
          </ActionList.TrailingVisual>
        </ActionList.Item>
      ))}
    </>
  );
};

export default SkeletonItem;
