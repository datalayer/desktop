/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Component for displaying environment type as a styled label.
 *
 * @module TypeLabel
 */

import React from 'react';
import { Label } from '@primer/react';
import { EnvironmentTypeLabelProps } from '../../../shared/types';
import { getEnvironmentType } from '../../utils/environments';

/**
 * Renders a label showing the environment type (CPU, GPU, etc.).
 */
const TypeLabel: React.FC<EnvironmentTypeLabelProps> = ({
  environment,
  size = 'small',
}) => {
  const environmentType = getEnvironmentType(environment);

  return (
    <Label size={size} variant="default">
      {environmentType}
    </Label>
  );
};

export default TypeLabel;
