/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Environment icon component that displays appropriate icons or images for different environment types.
 *
 * @module Icon
 */

import React, { ComponentType } from 'react';
import { Box } from '@primer/react';
import * as DatalayerIcons from '@datalayer/icons-react';
import { EnvironmentIconProps } from '../../../shared/types';

const toPascalCase = (value: string): string => {
  return value
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
};

type EnvironmentIconComponent = ComponentType<{
  size?: number;
  colored?: boolean;
}>;

const getEnvironmentIconComponent = (
  iconKey?: string
): EnvironmentIconComponent => {
  if (!iconKey) {
    return DatalayerIcons.AlienIcon as EnvironmentIconComponent;
  }
  const componentName = `${toPascalCase(iconKey)}Icon`;
  const iconsByName = DatalayerIcons as unknown as Record<
    string,
    EnvironmentIconComponent
  >;
  return (
    iconsByName[componentName] ??
    (DatalayerIcons.AlienIcon as EnvironmentIconComponent)
  );
};

/**
 * Renders an icon for an environment.
 */
const Icon: React.FC<EnvironmentIconProps> = ({ environment, size = 24 }) => {
  const iconValue =
    (typeof environment.icon === 'string' && environment.icon.trim()) || '';
  const EnvironmentIcon = getEnvironmentIconComponent(iconValue);

  return (
    <Box
      sx={{
        color: 'fg.muted',
        minWidth: size + 16,
        '&:focus-visible': {
          outline: '2px solid',
          outlineColor: 'accent.emphasis',
          outlineOffset: '2px',
          borderRadius: 1,
        },
      }}
    >
      <EnvironmentIcon size={size} />
    </Box>
  );
};

export default Icon;
