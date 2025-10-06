/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Integration tests for the Datalayer SDK Bridge.
 * Tests token storage, IPC serialization, and SDK method dispatching.
 *
 * @module main/services/datalayer-sdk-bridge.integration.test
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { DatalayerSDKBridge } from './datalayer-sdk-bridge';
import {
  mockUser,
  mockEnvironments,
  mockRuntimes,
} from '../../../tests/fixtures';
import { setupElectronMocks } from '../../../tests/mocks';

// Setup Electron mocks
setupElectronMocks();

// Mock the DatalayerClient
vi.mock('@datalayer/core/lib/client/index', () => ({
  DatalayerClient: vi.fn().mockImplementation(() => ({
    setToken: vi.fn().mockResolvedValue(undefined),
    login: vi.fn().mockResolvedValue({
      toJSON: () => mockUser,
    }),
    logout: vi.fn().mockResolvedValue(undefined),
    whoami: vi.fn().mockResolvedValue({
      toJSON: () => mockUser,
    }),
    listEnvironments: vi.fn().mockResolvedValue(
      mockEnvironments.map(env => ({
        toJSON: () => env,
      }))
    ),
    createRuntime: vi.fn().mockResolvedValue({
      toJSON: () => mockRuntimes[0],
    }),
    listRuntimes: vi.fn().mockResolvedValue(
      mockRuntimes.map(runtime => ({
        toJSON: () => runtime,
      }))
    ),
    getRuntime: vi.fn().mockResolvedValue({
      toJSON: () => mockRuntimes[0],
    }),
    deleteRuntime: vi.fn().mockResolvedValue(undefined),
    getConfig: vi.fn(() => ({
      token: 'mock-token',
      iamRunUrl: 'https://prod1.datalayer.run',
      spacerRunUrl: 'https://prod1.datalayer.run',
    })),
  })),
}));

// Mock filesystem functions
vi.mock('fs', () => ({
  existsSync: vi.fn(() => false),
  readFileSync: vi.fn(() => Buffer.from('encrypted-token')),
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
}));

describe('DatalayerSDKBridge - Integration Tests', () => {
  let bridge: DatalayerSDKBridge;

  beforeEach(() => {
    vi.clearAllMocks();
    bridge = new DatalayerSDKBridge();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('initialization', () => {
    it('should initialize bridge successfully', async () => {
      await bridge.initialize();

      expect(bridge.isInitialized()).toBe(true);
    });

    it('should only initialize once', async () => {
      await bridge.initialize();
      await bridge.initialize(); // Second call should be no-op

      expect(bridge.isInitialized()).toBe(true);
    });
  });

  describe('authentication flow', () => {
    beforeEach(async () => {
      await bridge.initialize();
    });

    it('should login and store token', async () => {
      const result = await bridge.call('login', 'test-token');

      expect(result).toEqual(mockUser);
      expect(bridge.isAuthenticated()).toBe(true);
    });

    it('should get current user after login', async () => {
      await bridge.call('login', 'test-token');

      const user = await bridge.call('whoami');

      expect(user).toEqual(mockUser);
    });

    it('should logout and clear token', async () => {
      await bridge.call('login', 'test-token');
      expect(bridge.isAuthenticated()).toBe(true);

      await bridge.call('logout');

      expect(bridge.isAuthenticated()).toBe(false);
    });

    it('should return auth state with user info', async () => {
      await bridge.call('login', 'test-token');

      const authState = bridge.getAuthState();

      expect(authState).toMatchObject({
        isAuthenticated: true,
        user: mockUser,
        token: 'mock-token',
        runUrl: 'https://prod1.datalayer.run',
      });
    });

    it('should update current user on whoami call', async () => {
      await bridge.call('login', 'test-token');

      await bridge.call('whoami');

      const authState = bridge.getAuthState();
      expect(authState.user).toEqual(mockUser);
    });
  });

  describe('method name conversion', () => {
    beforeEach(async () => {
      await bridge.initialize();
      await bridge.call('login', 'test-token');
    });

    it('should convert snake_case to camelCase', async () => {
      const result = await bridge.call('list_environments');

      expect(result).toEqual(mockEnvironments);
    });

    it('should handle camelCase method names directly', async () => {
      const result = await bridge.call('listEnvironments');

      expect(result).toEqual(mockEnvironments);
    });

    it('should convert list_runtimes to listRuntimes', async () => {
      const result = await bridge.call('list_runtimes');

      expect(result).toEqual(mockRuntimes);
    });

    it('should convert get_runtime to getRuntime', async () => {
      const result = await bridge.call('get_runtime', 'runtime-123');

      expect(result).toEqual(mockRuntimes[0]);
    });
  });

  describe('IPC serialization', () => {
    beforeEach(async () => {
      await bridge.initialize();
      await bridge.call('login', 'test-token');
    });

    it('should serialize SDK models with toJSON()', async () => {
      const result = await bridge.call('listEnvironments');

      // Result should be plain objects, not SDK models
      expect(result).toEqual(mockEnvironments);
      expect(result[0]).not.toHaveProperty('toJSON');
    });

    it('should serialize arrays of models', async () => {
      const result = await bridge.call('listRuntimes');

      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual(mockRuntimes);
    });

    it('should handle single model serialization', async () => {
      const result = await bridge.call('getRuntime', 'runtime-123');

      expect(result).toEqual(mockRuntimes[0]);
    });

    it('should handle null/undefined values', async () => {
      const sdk = bridge.getSDK() as any;
      sdk.someMethod = vi.fn().mockResolvedValue(null);

      const result = await bridge.call('someMethod');

      expect(result).toBeNull();
    });
  });

  describe('runtime operations', () => {
    beforeEach(async () => {
      await bridge.initialize();
      await bridge.call('login', 'test-token');
    });

    it('should create runtime with proper parameters', async () => {
      const result = await bridge.call(
        'createRuntime',
        'python-cpu-env',
        'notebook',
        'test-runtime',
        10
      );

      expect(result).toEqual(mockRuntimes[0]);

      const sdk = bridge.getSDK() as any;
      expect(sdk.createRuntime).toHaveBeenCalledWith(
        'python-cpu-env',
        'notebook',
        'test-runtime',
        10,
        undefined
      );
    });

    it('should list all runtimes', async () => {
      const result = await bridge.call('listRuntimes');

      expect(result).toEqual(mockRuntimes);
    });

    it('should delete runtime by pod name', async () => {
      await bridge.call('deleteRuntime', 'pod-name-123');

      const sdk = bridge.getSDK() as any;
      expect(sdk.deleteRuntime).toHaveBeenCalledWith('pod-name-123');
    });
  });

  describe('environment operations', () => {
    beforeEach(async () => {
      await bridge.initialize();
      await bridge.call('login', 'test-token');
    });

    it('should list environments', async () => {
      const result = await bridge.call('listEnvironments');

      expect(result).toHaveLength(mockEnvironments.length);
      expect(result).toEqual(mockEnvironments);
    });

    it('should return environment with proper structure', async () => {
      const result = await bridge.call('listEnvironments');

      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('language');
      expect(result[0]).toHaveProperty('resources');
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await bridge.initialize();
      await bridge.call('login', 'test-token');
    });

    it('should throw error for non-existent method', async () => {
      await expect(bridge.call('nonExistentMethod')).rejects.toThrow(
        /method.*not found/i
      );
    });

    it('should propagate SDK errors', async () => {
      const sdk = bridge.getSDK() as any;
      sdk.listEnvironments = vi.fn().mockRejectedValue(new Error('API Error'));

      await expect(bridge.call('listEnvironments')).rejects.toThrow(
        'API Error'
      );
    });

    it('should handle network errors gracefully', async () => {
      const sdk = bridge.getSDK() as any;
      sdk.createRuntime = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(
        bridge.call('createRuntime', 'env', 'type', 'name', 10)
      ).rejects.toThrow('Network error');
    });
  });

  describe('configuration', () => {
    beforeEach(async () => {
      await bridge.initialize();
    });

    it('should return SDK configuration', () => {
      const config = bridge.getConfig();

      expect(config).toHaveProperty('token');
      expect(config).toHaveProperty('iamRunUrl');
      expect(config).toHaveProperty('spacerRunUrl');
    });

    it('should provide direct SDK access', () => {
      const sdk = bridge.getSDK();

      expect(sdk).toBeDefined();
      expect(typeof sdk.login).toBe('function');
    });
  });

  describe('authentication persistence', () => {
    it('should check authentication state without token', () => {
      const unauthBridge = new DatalayerSDKBridge();

      expect(unauthBridge.isAuthenticated()).toBe(false);
    });

    it('should restore authentication state after initialization', async () => {
      // Mock stored token
      const fs = await import('fs');
      (fs.existsSync as any).mockReturnValue(true);
      (fs.readFileSync as any).mockReturnValue(Buffer.from('stored-token'));

      const newBridge = new DatalayerSDKBridge();
      await newBridge.initialize();

      // Bridge should attempt to restore and validate token
      expect(newBridge.isInitialized()).toBe(true);
    });

    it('should get auth state before login', () => {
      const authState = bridge.getAuthState();

      expect(authState.isAuthenticated).toBe(false);
      expect(authState.user).toBeNull();
    });
  });
});
