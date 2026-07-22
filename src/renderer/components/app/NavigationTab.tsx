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
          color: isActive ? 'accent.fg' : 'fg.default',
          borderBottom: isActive
            ? '2px solid var(--borderColor-accent-emphasis)'
            : '2px solid transparent',
          paddingBottom: '4px',
          textDecoration: 'none',
          backgroundColor: 'transparent',
          outline: 'none',
          '&:hover': {
            textDecoration: 'none',
            color: 'accent.fg',
            backgroundColor: 'transparent',
            borderBottom: isActive
              ? '2px solid var(--borderColor-accent-emphasis)'
              : '2px solid transparent',
          },
          '&:active, &:visited': {
            color: isActive ? 'accent.fg' : 'fg.default',
            backgroundColor: 'transparent',
          },
          '&:focus, &:focus-visible': {
            color: isActive ? 'accent.fg' : 'fg.default',
            backgroundColor: 'transparent',
            outline: '2px solid',
            outlineColor: 'accent.emphasis',
            outlineOffset: '-2px',
          },
          '& span': { color: 'inherit' },
          '& svg': { color: 'inherit' },
        }}
      >
        <Icon size={16} />
        <span>{label}</span>
      </Header.Link>
    </Header.Item>
  );
};

export default NavigationTab;
