/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Global type augmentation for Node.js main process.
 * Provides proper typing for global extensions.
 *
 * @module main/types/global
 */

declare global {
  // eslint-disable-next-line no-var
  var __datalayerRuntimeCleanup:
    | Map<string, { terminated: boolean }>
    | undefined;
}

export {};
