/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * @module renderer/theme/datalayerTheme
 * @description Custom Primer theme with Datalayer brand colors
 */

import { theme as primerTheme, ThemeProviderProps } from '@primer/react';
import deepmerge from 'deepmerge';
import { DATALAYER_PALETTE } from '../../shared/constants/colors';

/**
 * Custom Primer theme with Datalayer brand colors.
 * Merges default Primer theme with brand green overrides.
 * Uses official Datalayer accessible green (#16A085) which meets WCAG AA standards.
 */
export const datalayerTheme: ThemeProviderProps['theme'] = deepmerge(
  primerTheme,
  {
    colorSchemes: {
      light: {
        colors: {
          // Primary accent colors - replace blue with brand green
          accent: {
            fg: DATALAYER_PALETTE.greenAccessible,
            emphasis: DATALAYER_PALETTE.greenAccessible,
            muted: 'rgba(22, 160, 133, 0.4)',
            subtle: 'rgba(22, 160, 133, 0.1)',
          },
          // Button colors
          btn: {
            primary: {
              bg: DATALAYER_PALETTE.greenAccessible,
              border: DATALAYER_PALETTE.greenAccessible,
              hoverBg: DATALAYER_PALETTE.greenAccessibleHover,
              hoverBorder: DATALAYER_PALETTE.greenAccessibleHover,
              selectedBg: DATALAYER_PALETTE.greenAccessibleDark,
              selectedBorder: DATALAYER_PALETTE.greenAccessibleDark,
              disabledBg: 'rgba(22, 160, 133, 0.5)',
              disabledBorder: 'rgba(22, 160, 133, 0.5)',
              text: '#FFFFFF',
            },
          },
        },
      },
      dark: {
        colors: {
          // Primary accent colors for dark mode
          accent: {
            fg: DATALAYER_PALETTE.greenMain,
            emphasis: DATALAYER_PALETTE.greenMain,
            muted: 'rgba(26, 188, 156, 0.4)',
            subtle: 'rgba(26, 188, 156, 0.15)',
          },
          // Button colors for dark mode
          btn: {
            primary: {
              bg: DATALAYER_PALETTE.greenMain,
              border: DATALAYER_PALETTE.greenMain,
              hoverBg: DATALAYER_PALETTE.greenLight,
              hoverBorder: DATALAYER_PALETTE.greenLight,
              selectedBg: DATALAYER_PALETTE.greenDark,
              selectedBorder: DATALAYER_PALETTE.greenDark,
              disabledBg: 'rgba(26, 188, 156, 0.5)',
              disabledBorder: 'rgba(26, 188, 156, 0.5)',
              text: '#FFFFFF',
            },
          },
        },
      },
    },
  }
);
