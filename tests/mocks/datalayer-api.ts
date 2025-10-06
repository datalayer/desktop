/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Mock implementations for Datalayer Client API used in tests.
 * Provides mock responses for authentication, runtimes, notebooks, etc.
 *
 * @module tests/mocks/datalayer-api
 */

import { vi } from 'vitest';
import { mockUser, mockEnvironments, mockRuntimes, mockSpaces, mockNotebooks } from '../fixtures';

/**
 * Mock Datalayer Client (window.datalayerClient).
 */
export const mockDatalayerClient = {
  // Authentication
  login: vi.fn((_token: string) => Promise.resolve(mockUser)),
  logout: vi.fn(() => Promise.resolve()),
  whoami: vi.fn(() => Promise.resolve(mockUser)),
  setToken: vi.fn((_token: string) => Promise.resolve()),

  // Environments
  listEnvironments: vi.fn(() => Promise.resolve(mockEnvironments)),

  // Runtimes
  createRuntime: vi.fn((_envName: string, _type: string, _name: string, _credits: number) =>
    Promise.resolve(mockRuntimes[0])
  ),
  listRuntimes: vi.fn(() => Promise.resolve(mockRuntimes)),
  getRuntime: vi.fn((_runtimeId: string) => Promise.resolve(mockRuntimes[0])),
  deleteRuntime: vi.fn((_runtimeId: string) => Promise.resolve()),

  // Spaces
  getMySpaces: vi.fn(() => Promise.resolve(mockSpaces)),
  getSpaceItems: vi.fn((_spaceId: string) => Promise.resolve(mockNotebooks)),

  // Notebooks
  createNotebook: vi.fn((_spaceId: string, _name: string, _description?: string) =>
    Promise.resolve(mockNotebooks[0])
  ),
  getContent: vi.fn((_itemId: string) =>
    Promise.resolve({
      cells: [
        {
          cell_type: 'code',
          source: ['print("Hello, World!")'],
          metadata: {},
          outputs: [],
          execution_count: null,
        },
      ],
      metadata: {},
      nbformat: 4,
      nbformat_minor: 5,
    })
  ),

  // Lexical documents
  createLexical: vi.fn((_spaceId: string, _name: string, _description?: string) =>
    Promise.resolve({
      id: 'lexical-1',
      name: _name,
      description: _description,
      type: 'lexical',
      spaceId: _spaceId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  ),

  // Collaboration
  getCollaborationSessionId: vi.fn((_documentId: string) => Promise.resolve(_documentId)),

  // Configuration
  getConfig: vi.fn(() => ({
    token: 'mock-token',
    iamRunUrl: 'https://prod1.datalayer.run',
    spacerRunUrl: 'https://prod1.datalayer.run',
  })),
};

/**
 * Mock Datalayer API (window.datalayerAPI) - IPC-based API.
 */
export const mockDatalayerAPI = {
  // Authentication
  login: vi.fn((_token: string) =>
    Promise.resolve({
      success: true,
      data: {
        isAuthenticated: true,
        user: mockUser,
        token: _token,
        runUrl: 'https://prod1.datalayer.run',
      },
    })
  ),
  logout: vi.fn(() =>
    Promise.resolve({
      success: true,
      data: {
        isAuthenticated: false,
        user: null,
        token: null,
        runUrl: '',
      },
    })
  ),
  getAuthState: vi.fn(() =>
    Promise.resolve({
      isAuthenticated: true,
      user: mockUser,
      token: 'mock-token',
      runUrl: 'https://prod1.datalayer.run',
    })
  ),
  getCredentials: vi.fn(() =>
    Promise.resolve({
      runUrl: 'https://prod1.datalayer.run',
      token: 'mock-token',
      isAuthenticated: true,
    })
  ),

  // Environments
  listEnvironments: vi.fn(() =>
    Promise.resolve({
      success: true,
      data: mockEnvironments,
    })
  ),

  // Runtimes
  createRuntime: vi.fn((_options: any) =>
    Promise.resolve({
      success: true,
      data: { runtime: mockRuntimes[0] },
    })
  ),
  listRuntimes: vi.fn(() =>
    Promise.resolve({
      success: true,
      data: mockRuntimes,
    })
  ),
  getRuntime: vi.fn((_runtimeId: string) =>
    Promise.resolve({
      success: true,
      data: mockRuntimes[0],
    })
  ),
  deleteRuntime: vi.fn((_podName: string) =>
    Promise.resolve({
      success: true,
    })
  ),
  isRuntimeActive: vi.fn((_podName: string) =>
    Promise.resolve({
      success: true,
      isActive: true,
      runtime: mockRuntimes[0],
    })
  ),

  // Spaces
  getMySpaces: vi.fn(() =>
    Promise.resolve({
      success: true,
      data: mockSpaces,
    })
  ),
  getSpaceItems: vi.fn((_spaceId: string) =>
    Promise.resolve({
      success: true,
      data: mockNotebooks,
    })
  ),

  // Notebooks
  createNotebook: vi.fn((_spaceId: string, _name: string, _description?: string) =>
    Promise.resolve({
      success: true,
      data: mockNotebooks[0],
    })
  ),

  // Space items
  deleteSpaceItem: vi.fn((_itemId: string) =>
    Promise.resolve({
      success: true,
    })
  ),

  // User
  whoami: vi.fn(() =>
    Promise.resolve({
      success: true,
      data: mockUser,
    })
  ),
};

/**
 * Setup Datalayer API mocks on window object.
 */
export function setupDatalayerAPIMocks() {
  (global as any).window = {
    ...(global as any).window,
    datalayerClient: mockDatalayerClient,
    datalayerAPI: mockDatalayerAPI,
  };
}

/**
 * Reset all Datalayer API mocks.
 */
export function resetDatalayerAPIMocks() {
  Object.values(mockDatalayerClient).forEach((mock: any) => {
    if (vi.isMockFunction(mock)) {
      mock.mockClear();
    }
  });

  Object.values(mockDatalayerAPI).forEach((mock: any) => {
    if (vi.isMockFunction(mock)) {
      mock.mockClear();
    }
  });
}
