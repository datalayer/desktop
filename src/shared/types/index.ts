/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * @module shared/types
 *
 * Central export point for all type definitions used across the application.
 * This module re-exports types from individual type files for convenient importing.
 *
 * @example
 * ```typescript
 * import { ViewType, GitHubUser, NotebookData } from '../shared/types';
 * ```
 */

// Re-export all type definitions from individual type files

// App types
export * from './app.types';

// Documents types
export * from './documents.types';

// Environments types
export * from './environments.types';

// Login types
export * from './login.types';

// Notebook types
export * from './notebook.types';

// Document types
export * from './document.types';
