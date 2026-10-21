/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * User profile dropdown menu component with GitHub user display and logout.
 *
 * @module renderer/components/app/UserMenu
 */

import React, { useEffect } from 'react';
import { Header, Button, Box, Text } from '@primer/react';
import { EntityAvatar } from '@datalayer/primer-addons';
import { UserMenuProps } from '../../../shared/types';
import { avatarInitialOf, avatarSourceOf } from './userAvatar';

/**
 * User menu dropdown component for the application header.
 */
const UserMenu: React.FC<UserMenuProps> = ({
  user,
  isOpen,
  onOpenChange,
  onLogout,
}) => {
  // Handle Escape key press to close user menu
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        event.preventDefault();
        event.stopPropagation();
        onOpenChange(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey, true);
      return () => {
        document.removeEventListener('keydown', handleEscapeKey, true);
      };
    }

    return undefined;
  }, [isOpen, onOpenChange]);

  // Handle user logout action
  const handleLogout = () => {
    onLogout();
    onOpenChange(false);
  };

  // The picture when it loads, the initial when there is none or it fails.
  const avatar = (
    <EntityAvatar
      src={avatarSourceOf(user.avatarUrl)}
      alt=""
      size={32}
      shape="circle"
      ground="emphasis"
      sx={{ flexShrink: 0 }}
    >
      {avatarInitialOf(user)}
    </EntityAvatar>
  );

  // Toggle user menu visibility
  const handleMenuToggle = () => {
    onOpenChange(!isOpen);
  };

  return (
    <Header.Item sx={{ position: 'relative' }}>
      <Button
        variant="invisible"
        onClick={handleMenuToggle}
        aria-label={`User menu for ${user.displayName || user.handle}`}
        aria-describedby="user-menu-description"
        aria-expanded={isOpen}
        sx={{
          p: 0,
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          borderRadius: '50%',
          cursor: 'pointer',
          '&:hover': {
            opacity: 0.8,
          },
        }}
      >
        {avatar}
      </Button>

      {isOpen && (
        <Box
          sx={{
            position: 'fixed',
            top: '60px',
            right: '16px',
            width: '280px',
            bg: 'canvas.default',
            border: '1px solid',
            borderColor: 'border.default',
            borderRadius: 2,
            boxShadow: 'shadow.large',
            zIndex: 9999,
            overflow: 'hidden',
          }}
          role="menu"
          aria-labelledby="user-menu-description"
        >
          <Box
            sx={{
              p: 3,
              borderBottom: '1px solid',
              borderColor: 'border.default',
              display: 'flex',
              alignItems: 'center',
              gap: 2,
            }}
          >
            {avatar}
            <Box>
              <Text
                sx={{
                  fontWeight: 'semibold',
                  display: 'block',
                  color: 'fg.default',
                }}
              >
                {user.displayName}
              </Text>
              {user.email && (
                <Text
                  sx={{
                    fontSize: 0,
                    color: 'fg.muted',
                    display: 'block',
                    mt: 1,
                  }}
                >
                  {user.email}
                </Text>
              )}
            </Box>
          </Box>

          <Box sx={{ p: 1 }}>
            <Button
              variant="invisible"
              role="menuitem"
              onClick={handleLogout}
              sx={{
                width: '100%',
                justifyContent: 'flex-start',
                color: 'danger.fg',
                '&:hover': {
                  bg: 'canvas.subtle',
                  color: 'danger.fg',
                },
              }}
            >
              Sign out
            </Button>
          </Box>
        </Box>
      )}
    </Header.Item>
  );
};

export default UserMenu;
