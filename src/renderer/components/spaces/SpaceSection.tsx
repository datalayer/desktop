/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Section component for organizing space items by type (notebooks, folders, etc.).
 * Handles loading states, empty states, and renders collections of SpaceItem components.
 *
 * @module SpaceSection
 */

import React from 'react';
import { Box, Heading, Text, ActionList, Button } from '@primer/react';
import { PlusIcon } from '@primer/octicons-react';
import SpaceItem from './SpaceItem';
import SkeletonItem from './SkeletonItem';

import type { DocumentItem } from '../../../shared/types';

/**
 * Props for the SpaceSection component.
 */
export interface SpaceSectionProps {
  title: string;
  icon: React.ComponentType<{ size?: number }>;
  items: DocumentItem[]; // Use SDK types directly
  loading: boolean;
  selectedItemId: string | null;
  emptyMessage: string;
  onItemOpen: (item: DocumentItem) => void;
  onItemEdit: (item: DocumentItem) => void;
  onItemDownload: (item: DocumentItem) => void;
  onItemDelete: (item: DocumentItem) => void;
  getItemIcon?: (item: DocumentItem) => React.ComponentType<{ size?: number }>;
  previousItemCount?: number;
  onCreateNew?: () => void; // Optional create button handler
  createButtonLabel?: string; // Custom label for the create button
}

/**
 * Renders a section of space items with header, loading states, and empty states.
 */
const SpaceSection: React.FC<SpaceSectionProps> = ({
  title,
  icon: SectionIcon,
  items,
  loading,
  selectedItemId,
  emptyMessage,
  onItemOpen,
  onItemEdit,
  onItemDownload,
  onItemDelete,
  getItemIcon,
  previousItemCount = 0,
  onCreateNew,
  createButtonLabel = 'New',
}) => {
  return (
    <Box sx={{ mb: 3 }}>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 2,
          mb: 2,
          pb: 1,
          borderBottom: '1px solid',
          borderColor: 'border.subtle',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <SectionIcon size={20} />
          <Heading as="h3" sx={{ fontSize: 2 }}>
            {title} ({loading ? '...' : items.length})
          </Heading>
        </Box>
        {onCreateNew && (
          <Button
            variant="primary"
            size="small"
            leadingVisual={PlusIcon}
            onClick={onCreateNew}
          >
            {createButtonLabel}
          </Button>
        )}
      </Box>

      {loading ? (
        <Box
          sx={{
            border: '1px solid',
            borderColor: 'border.default',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <ActionList>
            <SkeletonItem count={previousItemCount || 3} />
          </ActionList>
        </Box>
      ) : items.length > 0 ? (
        <Box
          sx={{
            border: '1px solid',
            borderColor: 'border.default',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <ActionList>
            {items.map(item => (
              <SpaceItem
                key={item.id}
                item={item}
                icon={getItemIcon ? getItemIcon(item) : SectionIcon}
                isSelected={selectedItemId === item.id}
                onOpen={() => onItemOpen(item)}
                onEdit={() => onItemEdit(item)}
                onDownload={() => onItemDownload(item)}
                onDelete={() => onItemDelete(item)}
              />
            ))}
          </ActionList>
        </Box>
      ) : (
        <Box
          sx={{
            p: 4,
            textAlign: 'center',
            bg: 'canvas.subtle',
            border: '1px solid',
            borderColor: 'border.default',
            borderRadius: 2,
          }}
        >
          <SectionIcon size={32} />
          <Text sx={{ mt: 2, color: 'fg.muted' }}>{emptyMessage}</Text>
        </Box>
      )}
    </Box>
  );
};

export default SpaceSection;
