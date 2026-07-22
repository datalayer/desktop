/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Component for displaying environment resource information as labels.
 *
 * @module Resources
 */

import React from 'react';
import { Box, Text, Label } from '@primer/react';
import { PackageIcon } from '@primer/octicons-react';
import { EnvironmentResourcesProps } from '../../../shared/types';

const asDefaultValue = (value: unknown): unknown => {
  if (value && typeof value === 'object' && 'default' in value) {
    return (value as { default?: unknown }).default;
  }
  return value;
};

const asDisplayValue = (value: unknown, fallback = 'N/A'): string => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }
  return String(value);
};

/**
 * Renders environment resource specifications as formatted labels.
 */
const Resources: React.FC<EnvironmentResourcesProps> = ({ resources }) => {
  const resourcesRecord = (resources || {}) as Record<string, unknown>;
  const cpu = asDefaultValue(resourcesRecord.cpu);
  const cpuMemory = asDefaultValue(resourcesRecord.memory);
  const gpu =
    asDefaultValue(resourcesRecord.gpu) ??
    asDefaultValue(resourcesRecord['nvidia.com/gpu']);

  return (
    <Box
      sx={{
        mt: 2,
        pt: 2,
        borderTop: '1px solid',
        borderColor: 'border.muted',
      }}
    >
      <Text sx={{ fontSize: 0, fontWeight: 'bold', mb: 1 }}>
        <PackageIcon size={14} /> Resources:
      </Text>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
        <Label size="small">GPU: {asDisplayValue(gpu, '0')}</Label>
        <Label size="small">CPU: {asDisplayValue(cpu)}</Label>
        <Label size="small">CPU memory: {asDisplayValue(cpuMemory)}</Label>
      </Box>
    </Box>
  );
};

export default Resources;
