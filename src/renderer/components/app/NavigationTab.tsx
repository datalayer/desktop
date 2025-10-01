/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Individual navigation tab component with active state styling.
 *
 * @module renderer/components/app/NavigationTab
 */

import React from 'react';
import { Header } from '@primer/react';
import { COLORS } from '../../../shared/constants/colors';
import { NavigationTabProps } from '../../../shared/types';

/**
 * Navigation tab component for app header.
 */
const NavigationTab: React.FC<NavigationTabProps> = ({
  label,
  icon: Icon,
  isActive,
  onClick,
  'aria-label': ariaLabel,
  title,
}) => {
  return (
    <Header.Item>
      <Header.Link
        href="#"
        onClick={(e: React.MouseEvent) => {
          e.preventDefault();
          onClick();
        }}
        aria-label={ariaLabel || label}
        title={title}
        sx={{
          fontWeight: 'normal',
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          color: `${isActive ? COLORS.brand.primary : COLORS.text.primary} !important`,
          borderBottom: isActive
            ? `2px solid ${COLORS.brand.primary}`
            : '2px solid transparent',
          paddingBottom: '4px',
          textDecoration: 'none !important',
          backgroundColor: 'transparent !important',
          outline: 'none',
          '&:hover': {
            textDecoration: 'none !important',
            color: `${COLORS.brand.primary} !important`,
            backgroundColor: 'transparent !important',
            borderBottom: isActive
              ? `2px solid ${COLORS.brand.primary}`
              : '2px solid transparent',
          },
          '&:active, &:visited': {
            color: `${isActive ? COLORS.brand.primary : COLORS.text.primary} !important`,
            backgroundColor: 'transparent !important',
          },
          '&:focus, &:focus-visible': {
            color: `${isActive ? COLORS.brand.primary : COLORS.text.primary} !important`,
            backgroundColor: 'transparent !important',
            outline: '2px solid',
            outlineColor: 'accent.emphasis',
            outlineOffset: '-2px',
          },
          '& span': {
            color: 'inherit !important',
          },
          '& svg': {
            color: 'inherit !important',
          },
        }}
      >
        <Icon size={16} />
        <span>{label}</span>
      </Header.Link>
    </Header.Item>
  );
};

export default NavigationTab;
