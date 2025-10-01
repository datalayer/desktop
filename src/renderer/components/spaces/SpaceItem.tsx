/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Individual space item component with actions (open, download, delete).
 * Displays item information and provides action buttons with custom styling and accessibility features.
 *
 * @module SpaceItem
 */

import React from 'react';
import { Box, Text, ActionList, IconButton, Button } from '@primer/react';
import { PencilIcon, DownloadIcon, TrashIcon } from '@primer/octicons-react';
import { COLORS } from '../../../shared/constants/colors';
import type { DocumentItem } from '../../../shared/types';

/**
 * Props for the SpaceItem component.
 */
export interface SpaceItemProps {
  item: DocumentItem; // Use SDK types directly
  icon: React.ComponentType<{ size?: number }>;
  isSelected: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onDownload: () => void;
  onDelete: () => void;
}

/**
 * Renders a single space item with action buttons
 */
const SpaceItem: React.FC<SpaceItemProps> = ({
  item,
  icon: _Icon,
  isSelected,
  onOpen,
  onEdit,
  onDownload,
  onDelete,
}) => {
  return (
    <ActionList.Item
      key={item.id}
      sx={{
        cursor: 'default',
        py: 3,
        bg: isSelected ? 'accent.subtle' : undefined,
        '&:hover': {
          bg: 'canvas.subtle',
        },
        '&:focus': {
          outline: 'none !important',
          boxShadow: 'inset 0 0 0 2px #117964 !important',
        },
        '&:focus-visible': {
          outline: 'none !important',
          boxShadow: 'inset 0 0 0 2px #117964 !important',
        },
        '&:focus:not(:hover)': {
          outline: 'none !important',
          boxShadow: 'inset 0 0 0 2px #117964 !important',
        },
      }}
    >
      <Box sx={{ flex: 1 }}>
        <Text sx={{ fontWeight: 'semibold', fontSize: 2, mb: 1 }}>
          {item.name}
        </Text>
        {item.description && (
          <Text
            sx={{
              fontSize: 1,
              color: 'fg.subtle',
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '100%',
            }}
          >
            {item.description}
          </Text>
        )}
      </Box>
      <ActionList.TrailingVisual>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <Button
            size="small"
            variant="invisible"
            onClick={e => {
              e.stopPropagation();
              onOpen();
            }}
            sx={{
              color: COLORS.brand.primary + ' !important',
              fontWeight: 'semibold',
              '&:hover': {
                color: COLORS.brand.primaryHover + ' !important',
                backgroundColor: `${COLORS.brand.primary}15`,
              },
            }}
          >
            Open
          </Button>
          <IconButton
            aria-label="Edit"
            icon={PencilIcon}
            size="large"
            variant="invisible"
            sx={{
              '& svg': {
                width: '20px',
                height: '20px',
              },
            }}
            onClick={e => {
              e.stopPropagation();
              onEdit();
            }}
          />
          <IconButton
            aria-label="Download"
            icon={DownloadIcon}
            size="large"
            variant="invisible"
            sx={{
              '& svg': {
                width: '20px',
                height: '20px',
              },
            }}
            onClick={e => {
              e.stopPropagation();
              onDownload();
            }}
          />
          <IconButton
            aria-label="Delete"
            icon={TrashIcon}
            size="large"
            variant="invisible"
            sx={{
              color: COLORS.palette.redPrimary + ' !important',
              '& svg': {
                color: COLORS.palette.redPrimary + ' !important',
                fill: COLORS.palette.redPrimary + ' !important',
                width: '20px',
                height: '20px',
              },
              '&:hover': {
                color: COLORS.palette.redHover + ' !important',
                backgroundColor: `${COLORS.palette.redPrimary}10`,
                '& svg': {
                  color: COLORS.palette.redHover + ' !important',
                  fill: COLORS.palette.redHover + ' !important',
                },
              },
            }}
            onClick={e => {
              e.stopPropagation();
              onDelete();
            }}
          />
        </Box>
      </ActionList.TrailingVisual>
    </ActionList.Item>
  );
};

export default SpaceItem;
