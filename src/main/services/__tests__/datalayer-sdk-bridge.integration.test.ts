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
import { DatalayerSDKBridge } from '../datalayer-sdk-bridge';
import { setupElectronMocks } from '../../../../tests/mocks';

const mockData = vi.hoisted(() => ({
  user: {
    email: 'user@example.com',
    firstName: 'Test',
    lastName: 'User',
    avatarUrl: 'https://example.com/avatar.png',
    handle: 'test-user',
  },
  environments: [
    {
      name: 'python-cpu-env',
      language: 'python',
      resources: {},
    },
  ],
  runtimes: [
    {
      uid: 'runtime-123',
      podName: 'pod-name-123',
      ingress: 'https://example.run',
      token: 'runtime-token',
    },
  ],
}));

function createMockSdk() {
  return {
    setToken: vi.fn().mockResolvedValue(undefined),
    login: vi.fn().mockResolvedValue({
      toJSON: () => mockData.user,
    }),
    logout: vi.fn().mockResolvedValue(undefined),
    whoami: vi.fn().mockResolvedValue({
      toJSON: () => mockData.user,
    }),
    listEnvironments: vi.fn().mockResolvedValue(
      mockData.environments.map(env => ({
        toJSON: () => env,
      }))
    ),
    createRuntime: vi.fn().mockResolvedValue({
      toJSON: () => mockData.runtimes[0],
    }),
    listRuntimes: vi.fn().mockResolvedValue(
      mockData.runtimes.map(runtime => ({
        toJSON: () => runtime,
      }))
    ),
    getRuntime: vi.fn().mockResolvedValue({
      toJSON: () => mockData.runtimes[0],
    }),
    deleteRuntime: vi.fn().mockResolvedValue(undefined),
    getConfig: vi.fn(() => ({
      token: 'mock-token',
      iamUrl: 'https://prod1.datalayer.run',
      spacerUrl: 'https://prod1.datalayer.run',
    })),
  };
}

// Setup Electron mocks
setupElectronMocks();

// Mock filesystem functions
vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(() => false),
    readFileSync: vi.fn(() => Buffer.from('encrypted-token')),
    writeFileSync: vi.fn(),
    unlinkSync: vi.fn(),
  },
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
    // Replace SDK instance with a deterministic mock for integration-style tests.
    (bridge as unknown as { sdk: ReturnType<typeof createMockSdk> }).sdk =
      createMockSdk();
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

      expect(result).toEqual(mockData.user);
      expect(bridge.isAuthenticated()).toBe(true);
    });

    it('should get current user after login', async () => {
      await bridge.call('login', 'test-token');

      const user = await bridge.call('whoami');

      expect(user).toEqual(mockData.user);
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
        user: mockData.user,
        token: 'mock-token',
        runUrl: 'https://prod1.datalayer.run',
      });
    });

    it('should update current user on whoami call', async () => {
      await bridge.call('login', 'test-token');

      await bridge.call('whoami');

      const authState = bridge.getAuthState();
      expect(authState.user).toEqual(mockData.user);
    });
  });

  describe('method name conversion', () => {
    beforeEach(async () => {
      await bridge.initialize();
      await bridge.call('login', 'test-token');
    });

    it('should convert snake_case to camelCase', async () => {
      const result = await bridge.call('list_environments');

      expect(result).toEqual(mockData.environments);
    });

    it('should handle camelCase method names directly', async () => {
      const result = await bridge.call('listEnvironments');

      expect(result).toEqual(mockData.environments);
    });

    it('should convert list_runtimes to listRuntimes', async () => {
      const result = await bridge.call('list_runtimes');

      expect(result).toEqual(mockData.runtimes);
    });

    it('should convert get_runtime to getRuntime', async () => {
      const result = await bridge.call('get_runtime', 'runtime-123');

      expect(result).toEqual(mockData.runtimes[0]);
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
      expect(result).toEqual(mockData.environments);
      if (Array.isArray(result) && result.length > 0) {
        expect(result[0]).not.toHaveProperty('toJSON');
      }
    });

    it('should serialize arrays of models', async () => {
      const result = await bridge.call('listRuntimes');

      expect(Array.isArray(result)).toBe(true);
      expect(result).toEqual(mockData.runtimes);
    });

    it('should handle single model serialization', async () => {
      const result = await bridge.call('getRuntime', 'runtime-123');

      expect(result).toEqual(mockData.runtimes[0]);
    });

    it('should handle null/undefined values', async () => {
      const sdk = bridge.getSDK() as unknown as Record<string, unknown>;
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

      expect(result).toEqual(mockData.runtimes[0]);

      const sdk = bridge.getSDK() as unknown as Record<string, unknown>;
      expect(sdk.createRuntime).toHaveBeenCalledWith(
        'python-cpu-env',
        'notebook',
        'test-runtime',
        10
      );
    });

    it('should list all runtimes', async () => {
      const result = await bridge.call('listRuntimes');

      expect(result).toEqual(mockData.runtimes);
    });

    it('should delete runtime by pod name', async () => {
      await bridge.call('deleteRuntime', 'pod-name-123');

      const sdk = bridge.getSDK() as unknown as Record<string, unknown>;
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

      expect(result).toHaveLength(mockData.environments.length);
      expect(result).toEqual(mockData.environments);
    });

    it('should return environment with proper structure', async () => {
      const result = await bridge.call('listEnvironments');

      if (Array.isArray(result) && result.length > 0) {
        const first = result[0];
        if (typeof first === 'object' && first !== null) {
          expect(first).toHaveProperty('name');
          expect(first).toHaveProperty('language');
          expect(first).toHaveProperty('resources');
        }
      }
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await bridge.initialize();
      await bridge.call('login', 'test-token');
    });

    it('should throw error for non-existent method', async () => {
      await expect(bridge.call('nonExistentMethod')).rejects.toThrow();
    });

    it('should propagate SDK errors', async () => {
      const sdk = bridge.getSDK() as unknown as Record<string, unknown>;
      sdk.listEnvironments = vi.fn().mockRejectedValue(new Error('API Error'));

      await expect(bridge.call('listEnvironments')).rejects.toMatchObject({
        message: expect.stringContaining('API Error'),
      });
    });

    it('should handle network errors gracefully', async () => {
      const sdk = bridge.getSDK() as unknown as Record<string, unknown>;
      sdk.createRuntime = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(
        bridge.call('createRuntime', 'env', 'type', 'name', 10)
      ).rejects.toMatchObject({
        message: expect.stringContaining('Network error'),
      });
    });
  });

  describe('configuration', () => {
    beforeEach(async () => {
      await bridge.initialize();
    });

    it('should return SDK configuration', () => {
      const config = bridge.getConfig();

      expect(config).toHaveProperty('token');
      expect(config).toHaveProperty('iamUrl');
      expect(config).toHaveProperty('spacerUrl');
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
      (fs.existsSync as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
        true
      );
      (fs.readFileSync as unknown as ReturnType<typeof vi.fn>).mockReturnValue(
        Buffer.from('stored-token')
      );

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
