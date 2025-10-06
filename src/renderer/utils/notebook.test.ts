/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Tests for notebook utility functions.
 * Tests parsing, validation, caching, and error handling.
 *
 * @module renderer/utils/notebook.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { ServiceManager } from '@jupyterlab/services';
import type { ElectronCollaborationProvider } from '../services/electronCollaborationProvider';
import {
  parseNotebookContent,
  validateNotebookContent,
  isRuntimeTerminated,
  markRuntimeTerminated,
  clearRuntimeTerminationFlag,
  isRuntimeInCleanupRegistry,
  createStableNotebookKey,
  getServiceManagerCacheKey,
  getCachedServiceManager,
  cacheServiceManager,
  removeCachedServiceManager,
  safelyDisposeServiceManager,
  formatErrorMessage,
  createNotebookProps,
} from './notebook';

describe('notebook utilities', () => {
  beforeEach(() => {
    // Clear session storage
    sessionStorage.clear();

    // Clear window cache
    Object.keys(window).forEach(key => {
      if (key.startsWith('serviceManager-')) {
        delete (window as unknown as Record<string, unknown>)[key];
      }
    });

    // Clear cleanup registry
    (window as unknown as Record<string, unknown>).__datalayerRuntimeCleanup =
      new Map();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  describe('parseNotebookContent', () => {
    const validNotebook = {
      nbformat: 4,
      nbformat_minor: 5,
      cells: [
        {
          cell_type: 'code',
          source: ['print("hello")'],
          outputs: [],
          execution_count: null,
          metadata: {},
        },
      ],
      metadata: {},
    };

    it('should parse JSON string', () => {
      const jsonString = JSON.stringify(validNotebook);
      const result = parseNotebookContent(jsonString);

      expect(result).toEqual(validNotebook);
      expect(result.cells).toHaveLength(1);
    });

    it('should parse object directly', () => {
      const result = parseNotebookContent(validNotebook);

      expect(result).toEqual(validNotebook);
    });

    it('should parse byte array', () => {
      const jsonString = JSON.stringify(validNotebook);
      const byteArray = Array.from(jsonString).map(char => char.charCodeAt(0));

      const result = parseNotebookContent(byteArray);

      expect(result).toEqual(validNotebook);
    });

    it('should throw error for invalid JSON string', () => {
      expect(() => {
        parseNotebookContent('invalid json{');
      }).toThrow('Invalid JSON response from server');
    });

    it('should throw error for invalid byte array', () => {
      const invalidByteArray = [123, 34, 105]; // Incomplete JSON bytes

      expect(() => {
        parseNotebookContent(invalidByteArray);
      }).toThrow('Failed to parse notebook content from byte array');
    });

    it('should handle empty notebook', () => {
      const emptyNotebook = {
        nbformat: 4,
        nbformat_minor: 5,
        cells: [],
        metadata: {},
      };
      const result = parseNotebookContent(emptyNotebook);

      expect(result).toEqual(emptyNotebook);
      expect(result.cells).toHaveLength(0);
    });
  });

  describe('validateNotebookContent', () => {
    it('should validate correct notebook structure', () => {
      const validNotebook = {
        nbformat: 4,
        nbformat_minor: 5,
        cells: [],
        metadata: {},
      };

      expect(validateNotebookContent(validNotebook)).toBe(true);
    });

    it('should validate notebook with cells', () => {
      const notebookWithCells = {
        nbformat: 4,
        cells: [{ cell_type: 'code', source: [] }],
      };

      expect(validateNotebookContent(notebookWithCells)).toBe(true);
    });

    it('should reject notebook without cells', () => {
      const invalidNotebook = {
        nbformat: 4,
        metadata: {},
      };

      expect(validateNotebookContent(invalidNotebook)).toBe(false);
    });

    it('should reject notebook without nbformat', () => {
      const invalidNotebook = {
        cells: [],
        metadata: {},
      };

      expect(validateNotebookContent(invalidNotebook)).toBe(false);
    });

    it('should reject notebook with non-array cells', () => {
      const invalidNotebook = {
        nbformat: 4,
        cells: 'not an array',
      };

      expect(validateNotebookContent(invalidNotebook)).toBe(false);
    });

    it('should reject null content', () => {
      expect(validateNotebookContent(null)).toBe(false);
    });

    it('should reject undefined content', () => {
      expect(validateNotebookContent(undefined)).toBe(false);
    });
  });

  describe('runtime termination flags', () => {
    describe('isRuntimeTerminated', () => {
      it('should return false for non-terminated runtime', () => {
        expect(isRuntimeTerminated('notebook-123')).toBe(false);
      });

      it('should return true for terminated runtime', () => {
        markRuntimeTerminated('notebook-123');
        expect(isRuntimeTerminated('notebook-123')).toBe(true);
      });
    });

    describe('markRuntimeTerminated', () => {
      it('should mark runtime as terminated', () => {
        markRuntimeTerminated('notebook-456');

        const flag = sessionStorage.getItem('notebook-notebook-456-terminated');
        expect(flag).toBe('true');
      });

      it('should overwrite existing flag', () => {
        sessionStorage.setItem('notebook-notebook-789-terminated', 'false');
        markRuntimeTerminated('notebook-789');

        expect(isRuntimeTerminated('notebook-789')).toBe(true);
      });
    });

    describe('clearRuntimeTerminationFlag', () => {
      it('should clear termination flag', () => {
        markRuntimeTerminated('notebook-clear');
        expect(isRuntimeTerminated('notebook-clear')).toBe(true);

        clearRuntimeTerminationFlag('notebook-clear');
        expect(isRuntimeTerminated('notebook-clear')).toBe(false);
      });

      it('should not error when clearing non-existent flag', () => {
        expect(() => {
          clearRuntimeTerminationFlag('notebook-nonexistent');
        }).not.toThrow();
      });
    });
  });

  describe('isRuntimeInCleanupRegistry', () => {
    it('should return false when registry does not exist', () => {
      delete (window as unknown as Record<string, unknown>)
        .__datalayerRuntimeCleanup;
      expect(isRuntimeInCleanupRegistry('runtime-123')).toBe(false);
    });

    it('should return false when runtime not in registry', () => {
      expect(isRuntimeInCleanupRegistry('runtime-not-found')).toBe(false);
    });

    it('should return true when runtime is terminated', () => {
      (
        (window as unknown as Record<string, unknown>)
          .__datalayerRuntimeCleanup as Map<string, unknown>
      ).set('runtime-terminated', {
        terminated: true,
      });

      expect(isRuntimeInCleanupRegistry('runtime-terminated')).toBe(true);
    });

    it('should return false when runtime is not terminated', () => {
      (
        (window as unknown as Record<string, unknown>)
          .__datalayerRuntimeCleanup as Map<string, unknown>
      ).set('runtime-active', {
        terminated: false,
      });

      expect(isRuntimeInCleanupRegistry('runtime-active')).toBe(false);
    });

    it('should handle empty runtimeId', () => {
      expect(isRuntimeInCleanupRegistry('')).toBe(false);
    });
  });

  describe('createStableNotebookKey', () => {
    it('should use notebookId when provided', () => {
      const key = createStableNotebookKey(
        'notebook-123',
        'path/to/nb.ipynb',
        'MyNotebook'
      );
      expect(key).toBe('notebook-123');
    });

    it('should use notebookPath when no ID', () => {
      const key = createStableNotebookKey(
        undefined,
        'path/to/nb.ipynb',
        'MyNotebook'
      );
      expect(key).toBe('path/to/nb.ipynb');
    });

    it('should use notebookName when no ID or path', () => {
      const key = createStableNotebookKey(undefined, undefined, 'MyNotebook');
      expect(key).toBe('MyNotebook.ipynb');
    });

    it('should default to "untitled.ipynb" when all undefined', () => {
      const key = createStableNotebookKey(undefined, undefined, undefined);
      expect(key).toBe('untitled.ipynb');
    });

    it('should prefer ID over path and name', () => {
      const key = createStableNotebookKey('id-wins', 'path/nb.ipynb', 'Name');
      expect(key).toBe('id-wins');
    });
  });

  describe('service manager caching', () => {
    describe('getServiceManagerCacheKey', () => {
      it('should generate correct cache key', () => {
        const key = getServiceManagerCacheKey('runtime-123');
        expect(key).toBe('serviceManager-runtime-123');
      });
    });

    describe('cacheServiceManager', () => {
      it('should cache service manager', () => {
        const mockManager = {
          type: 'test-manager',
          sessions: [],
        } as unknown as ServiceManager.IManager;
        cacheServiceManager('runtime-456', mockManager);

        const cached = (window as unknown as Record<string, unknown>)[
          'serviceManager-runtime-456'
        ];
        expect(cached).toEqual(mockManager);
      });

      it('should overwrite existing cache', () => {
        const manager1 = { version: 1 } as unknown as ServiceManager.IManager;
        const manager2 = { version: 2 } as unknown as ServiceManager.IManager;

        cacheServiceManager('runtime-789', manager1);
        cacheServiceManager('runtime-789', manager2);

        expect(getCachedServiceManager('runtime-789')).toEqual(manager2);
      });
    });

    describe('getCachedServiceManager', () => {
      it('should retrieve cached service manager', () => {
        const mockManager = {
          type: 'cached-manager',
        } as unknown as ServiceManager.IManager;
        cacheServiceManager('runtime-get', mockManager);

        const retrieved = getCachedServiceManager('runtime-get');
        expect(retrieved).toEqual(mockManager);
      });

      it('should return undefined for non-cached runtime', () => {
        const retrieved = getCachedServiceManager('runtime-nonexistent');
        expect(retrieved).toBeUndefined();
      });
    });

    describe('removeCachedServiceManager', () => {
      it('should remove cached service manager', () => {
        const mockManager = {
          type: 'to-remove',
        } as unknown as ServiceManager.IManager;
        cacheServiceManager('runtime-remove', mockManager);

        expect(getCachedServiceManager('runtime-remove')).toBeDefined();

        removeCachedServiceManager('runtime-remove');
        expect(getCachedServiceManager('runtime-remove')).toBeUndefined();
      });

      it('should not error when removing non-existent cache', () => {
        expect(() => {
          removeCachedServiceManager('runtime-never-existed');
        }).not.toThrow();
      });
    });
  });

  describe('safelyDisposeServiceManager', () => {
    it('should dispose manager with dispose method', () => {
      const mockDispose = vi.fn();
      const manager = {
        dispose: mockDispose,
        isDisposed: false,
      } as unknown as ServiceManager.IManager;

      safelyDisposeServiceManager(manager);
      expect(mockDispose).toHaveBeenCalledTimes(1);
    });

    it('should not dispose already disposed manager', () => {
      const mockDispose = vi.fn();
      const manager = {
        dispose: mockDispose,
        isDisposed: true,
      } as unknown as ServiceManager.IManager;

      safelyDisposeServiceManager(manager);
      expect(mockDispose).not.toHaveBeenCalled();
    });

    it('should handle manager without dispose method', () => {
      const manager = {
        isDisposed: false,
      } as unknown as ServiceManager.IManager;

      expect(() => {
        safelyDisposeServiceManager(manager);
      }).not.toThrow();
    });

    it('should handle null manager', () => {
      expect(() => {
        safelyDisposeServiceManager(null);
      }).not.toThrow();
    });

    it('should handle undefined manager', () => {
      expect(() => {
        safelyDisposeServiceManager(null);
      }).not.toThrow();
    });

    it('should catch errors during disposal', () => {
      const manager = {
        dispose: () => {
          throw new Error('Disposal failed');
        },
        isDisposed: false,
      } as unknown as ServiceManager.IManager;

      expect(() => {
        safelyDisposeServiceManager(manager);
      }).not.toThrow();
    });
  });

  describe('formatErrorMessage', () => {
    it('should format "Failed to create runtime" error', () => {
      const error = new Error('Failed to create runtime: timeout');
      const formatted = formatErrorMessage(error);

      expect(formatted).toBe(
        'Datalayer runtime service is temporarily unavailable. Please try again later.'
      );
    });

    it('should format "Server Error" message', () => {
      const error = new Error('Server Error: 500 Internal Server Error');
      const formatted = formatErrorMessage(error);

      expect(formatted).toBe(
        'Datalayer infrastructure is experiencing issues. Please try again later.'
      );
    });

    it('should use generic message for other errors', () => {
      const error = new Error('Network connection lost');
      const formatted = formatErrorMessage(error);

      expect(formatted).toBe('Failed to initialize notebook environment');
    });

    it('should handle empty error message', () => {
      const error = new Error('');
      const formatted = formatErrorMessage(error);

      expect(formatted).toBe('Failed to initialize notebook environment');
    });
  });

  describe('createNotebookProps', () => {
    const mockNotebookContent = {
      nbformat: 4,
      nbformat_minor: 5,
      cells: [],
      metadata: {},
    };

    const mockServiceManager = {
      type: 'mock-manager',
    } as unknown as ServiceManager.IManager;
    const mockExtensions = [{ name: 'ext1' }, { name: 'ext2' }];
    const MockToolbar = () => null;

    it('should create props without collaboration', () => {
      const props = createNotebookProps(
        'notebook-123',
        mockNotebookContent,
        mockServiceManager,
        null,
        mockExtensions,
        MockToolbar
      );

      expect(props.id).toBe('notebook-123');
      expect(props.height).toBe('100%');
      expect(props.nbformat).toEqual(mockNotebookContent);
      expect(props.readonly).toBe(false);
      expect(props.serviceManager).toBe(mockServiceManager);
      expect(props.startDefaultKernel).toBe(false);
      expect(props.collaborative).toBe(false);
      expect(props.collaborationEnabled).toBe(false);
      expect(props.collaborationProvider).toBeUndefined();
      expect(props.extensions).toEqual(mockExtensions);
      expect(props.cellSidebarMargin).toBe(60);
      expect(props.Toolbar).toBe(MockToolbar);
    });

    it('should create props with collaboration', () => {
      const mockCollabProvider = {
        type: 'collab-provider',
      } as unknown as ElectronCollaborationProvider;

      const props = createNotebookProps(
        'notebook-collab',
        mockNotebookContent,
        mockServiceManager,
        mockCollabProvider,
        mockExtensions,
        MockToolbar
      );

      expect(props.id).toBe('notebook-collab');
      expect(props.nbformat).toBeUndefined(); // Not passed with collaboration
      expect(props.collaborative).toBe(true);
      expect(props.collaborationEnabled).toBe(true);
      expect(props.collaborationProvider).toBe(mockCollabProvider);
    });

    it('should create props without toolbar', () => {
      const props = createNotebookProps(
        'notebook-no-toolbar',
        mockNotebookContent,
        mockServiceManager,
        null,
        mockExtensions
      );

      expect(props.Toolbar).toBeUndefined();
    });

    it('should handle empty extensions', () => {
      const props = createNotebookProps(
        'notebook-no-ext',
        mockNotebookContent,
        mockServiceManager,
        null,
        []
      );

      expect(props.extensions).toEqual([]);
    });
  });
});
