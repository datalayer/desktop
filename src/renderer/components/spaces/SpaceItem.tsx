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
import { Box, Text, ActionList } from '@primer/react';
import {
  PencilIcon,
  GearIcon,
  DownloadIcon,
  TrashIcon,
} from '@primer/octicons-react';
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
  const onActionKeyDown = (
    e: React.KeyboardEvent<HTMLSpanElement>,
    action: () => void
  ) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      action();
    }
  };

  return (
    <ActionList.Item
      as="div"
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
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <Box
          as="span"
          role="button"
          tabIndex={0}
          aria-label="Open"
          onClick={(e: React.MouseEvent<HTMLSpanElement>) => {
            e.stopPropagation();
            onOpen();
          }}
          onKeyDown={(e: React.KeyboardEvent<HTMLSpanElement>) =>
            onActionKeyDown(e, onOpen)
          }
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            cursor: 'pointer',
            color: COLORS.brand.primary + ' !important',
            '& svg': {
              width: '20px',
              height: '20px',
            },
            '&:hover': {
              color: COLORS.brand.primaryHover + ' !important',
              backgroundColor: `${COLORS.brand.primary}15`,
            },
            '&:focus-visible': {
              outline: '2px solid',
              outlineColor: 'accent.emphasis',
              outlineOffset: '2px',
            },
          }}
        >
          <PencilIcon size={20} />
        </Box>
        <Box
          as="span"
          role="button"
          tabIndex={0}
          aria-label="Edit details"
          onClick={(e: React.MouseEvent<HTMLSpanElement>) => {
            e.stopPropagation();
            onEdit();
          }}
          onKeyDown={(e: React.KeyboardEvent<HTMLSpanElement>) =>
            onActionKeyDown(e, onEdit)
          }
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            cursor: 'pointer',
            '& svg': {
              width: '20px',
              height: '20px',
            },
            '&:hover': {
              backgroundColor: 'canvas.subtle',
            },
            '&:focus-visible': {
              outline: '2px solid',
              outlineColor: 'accent.emphasis',
              outlineOffset: '2px',
            },
          }}
        >
          <GearIcon size={20} />
        </Box>
        <Box
          as="span"
          role="button"
          tabIndex={0}
          aria-label="Download"
          onClick={(e: React.MouseEvent<HTMLSpanElement>) => {
            e.stopPropagation();
            onDownload();
          }}
          onKeyDown={(e: React.KeyboardEvent<HTMLSpanElement>) =>
            onActionKeyDown(e, onDownload)
          }
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            cursor: 'pointer',
            '& svg': {
              width: '20px',
              height: '20px',
            },
            '&:hover': {
              backgroundColor: 'canvas.subtle',
            },
            '&:focus-visible': {
              outline: '2px solid',
              outlineColor: 'accent.emphasis',
              outlineOffset: '2px',
            },
          }}
        >
          <DownloadIcon size={20} />
        </Box>
        <Box
          as="span"
          role="button"
          tabIndex={0}
          aria-label="Delete"
          onClick={(e: React.MouseEvent<HTMLSpanElement>) => {
            e.stopPropagation();
            onDelete();
          }}
          onKeyDown={(e: React.KeyboardEvent<HTMLSpanElement>) =>
            onActionKeyDown(e, onDelete)
          }
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            cursor: 'pointer',
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
            '&:focus-visible': {
              outline: '2px solid',
              outlineColor: 'danger.emphasis',
              outlineOffset: '2px',
            },
          }}
        >
          <TrashIcon size={20} />
        </Box>
      </Box>
    </ActionList.Item>
  );
};

export default SpaceItem;
