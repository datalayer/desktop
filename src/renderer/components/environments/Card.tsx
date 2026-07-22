/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Environment card component displaying environment details and selection state.
 *
 * @module renderer/components/environments/Card
 */

import React from 'react';
import { Box, Heading, Label, Text } from '@primer/react';
import { EnvironmentCardProps } from '../../../shared/types';
import Icon from './Icon';
import TypeLabel from './TypeLabel';
import Description from './Description';
import Resources from './Resources';

/**
 * Environment card component displaying environment details.
 */
const Card: React.FC<EnvironmentCardProps> = ({ environment }) => {
  const displayName = (environment.title || environment.name || '').trim();
  const normalizedDisplayName = displayName.toLowerCase();
  const shouldHideTypeLabel =
    normalizedDisplayName === 'ai agents environment gpu' ||
    normalizedDisplayName === 'ai agents environment';
  const burningRate = environment.burningRate ?? environment.burning_rate;

  return (
    <Box
      key={environment.name}
      sx={{
        p: 3,
        mb: 2,
        bg: 'canvas.subtle',
        border: '1px solid',
        borderColor: 'border.default',
        borderRadius: 2,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'start',
          mb: 2,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'start', gap: 2 }}>
          <Icon environment={environment} size={40} />
          <Box sx={{ flex: 1 }}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 2,
                mb: 1,
              }}
            >
              <Heading as="h3" sx={{ fontSize: 2 }}>
                {environment.title || environment.name}
              </Heading>
              {!shouldHideTypeLabel && <TypeLabel environment={environment} />}
            </Box>

            <Description environment={environment} />

            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
              {environment.name && (
                <Label size="small" variant="accent">
                  Profile: {environment.name}
                </Label>
              )}
              {burningRate !== undefined && burningRate !== null && (
                <Label size="small" variant="success">
                  Burning rate: {burningRate} credits/s
                </Label>
              )}
            </Box>

            {environment.image && (
              <Text
                sx={{
                  fontSize: 0,
                  color: 'fg.subtle',
                  fontFamily: 'mono',
                  mt: 1,
                }}
              >
                Image: {environment.image}
              </Text>
            )}
          </Box>
        </Box>
      </Box>

      <Resources resources={environment.resources} />
    </Box>
  );
};

export default Card;
