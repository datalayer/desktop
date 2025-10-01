/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Utility functions for environment parsing, icons, and descriptions.
 *
 * @module renderer/utils/environments
 */

import {
  Environment,
  EnvironmentType,
  ParsedEnvironmentDescription,
} from '../../shared/types';

// ============================================================================
// Electron Application Environment Detection
// ============================================================================

export type EnvironmentMode = 'development' | 'production' | 'dev-prod';

/**
 * Check if running in development mode.
 * @returns True if NODE_ENV is 'development'
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV === 'development';
}

/**
 * Check if running in production mode.
 * @returns True if NODE_ENV is 'production'
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if running in dev-prod mode.
 * @returns True if ELECTRON_DEV_PROD is 'true'
 */
export function isDevProd(): boolean {
  return process.env.ELECTRON_DEV_PROD === 'true';
}

/**
 * Check if developer tools should be enabled.
 * @returns True in development or dev-prod mode
 */
export function shouldEnableDevTools(): boolean {
  return isDevelopment() || isDevProd();
}

/**
 * Check if production security settings should be used.
 * @returns True in production or dev-prod mode
 */
export function shouldUseProductionSecurity(): boolean {
  return isProduction() || isDevProd();
}

/**
 * Get the current environment mode.
 * @returns Current environment mode
 */
export function getEnvironmentMode(): EnvironmentMode {
  if (isDevProd()) {
    return 'dev-prod';
  }
  if (isProduction()) {
    return 'production';
  }
  return 'development';
}

/**
 * Log the current environment configuration.
 */
export function logEnvironmentConfig(): void {
  // Environment configuration logging (removed)
}

/**
 * Determines the environment type based on name patterns.
 * @param env - Environment object
 * @returns Environment type
 */
export const getEnvironmentType = (env: Environment): EnvironmentType => {
  const isGPU =
    env.name === 'ai-env' ||
    env.name.includes('gpu') ||
    env.name.includes('ai');
  return isGPU ? 'GPU' : 'CPU';
};

/**
 * Checks if environment is GPU type.
 * @param env - Environment object
 * @returns True if GPU environment
 */
export const isGPUEnvironmentType = (env: Environment): boolean => {
  return getEnvironmentType(env) === 'GPU';
};

/**
 * Formats resource information for display.
 * @param resources - Resource object
 * @returns Array of formatted resource strings
 */
export const formatResources = (
  resources: Record<string, unknown>
): string[] => {
  if (!resources) return [];

  const formatted = [];
  if (resources.cpu) {
    formatted.push(`${resources.cpu} CPU cores`);
  }
  if (resources.memory) {
    formatted.push(`${resources.memory} RAM`);
  }
  if (resources.gpu && resources.gpu !== '0') {
    formatted.push(`${resources.gpu} GPU`);
  }
  return formatted;
};

/**
 * Parses HTML description to extract structured data.
 * @param description - HTML description string
 * @returns Parsed description object or null
 */
export const parseEnvironmentDescription = (
  description: string
): ParsedEnvironmentDescription | null => {
  if (!description) return null;

  // Extract image URL
  const imgMatch = description.match(/<img\s+src="([^"]+)"[^>]*>/);
  const imageUrl = imgMatch ? imgMatch[1] : null;

  // Extract main description (bold text)
  const mainDescMatch = description.match(/<b>([^<]+)<\/b>/);
  const mainDescription = mainDescMatch ? mainDescMatch[1] : '';

  // Extract GPU details
  const gpuMatch = description.match(/GPU detail:\s*([^<]+)/);
  const gpuDetail = gpuMatch ? gpuMatch[1].trim() : '';

  // Extract packages
  const packagesMatch = description.match(/Packages:\s*([^<]+)/);
  const packages = packagesMatch
    ? packagesMatch[1].trim().replace(/\.\.\.$/, '')
    : '';

  return {
    imageUrl,
    mainDescription,
    gpuDetail,
    packages: packages ? packages.split(',').map(p => p.trim()) : [],
  };
};

/**
 * Checks if environment is GPU type based on name patterns.
 * @param envName - Environment name
 * @returns True if GPU environment
 */
export const isGPUEnvironment = (envName: string): boolean => {
  return (
    envName === 'ai-env' || envName.includes('gpu') || envName.includes('ai')
  );
};
