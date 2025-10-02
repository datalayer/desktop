/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Test fixtures for common data structures.
 * Provides mock data for users, environments, runtimes, spaces, and notebooks.
 *
 * @module tests/fixtures
 */

/**
 * Mock user data.
 */
export const mockUser = {
  id: 'user-123',
  uid: '01JY2SAT1DA44T877YTBMPC5J',
  handle: 'urn:dla:iam:ext::github:123456',
  email: 'test@datalayer.io',
  firstName: 'Test',
  lastName: 'User',
  avatarUrl: 'https://avatars.githubusercontent.com/u/123456',
  roles: ['platform_member'],
};

/**
 * Mock environment configurations.
 */
export const mockEnvironments = [
  {
    name: 'python-cpu-env',
    language: 'python',
    title: 'Python CPU Environment',
    description: 'Standard Python environment with CPU support',
    dockerImage: 'datalayer/python:latest',
    isDefault: true,
    tags: ['python', 'cpu'],
    resources: {
      cpu: { min: 1, max: 4, default: 2 },
      memory: { min: 1024, max: 8192, default: 2048 },
    },
  },
  {
    name: 'python-gpu-env',
    language: 'python',
    title: 'Python GPU Environment',
    description: 'Python environment with GPU support',
    dockerImage: 'datalayer/python-gpu:latest',
    tags: ['python', 'gpu', 'ml'],
    resources: {
      cpu: { min: 2, max: 8, default: 4 },
      memory: { min: 4096, max: 16384, default: 8192 },
      gpu: { min: 1, max: 2, default: 1 },
    },
  },
  {
    name: 'r-env',
    language: 'r',
    title: 'R Statistical Environment',
    description: 'R environment for statistical computing',
    dockerImage: 'datalayer/r:latest',
    tags: ['r', 'statistics'],
    resources: {
      cpu: { min: 1, max: 4, default: 2 },
      memory: { min: 2048, max: 8192, default: 4096 },
    },
  },
];

/**
 * Mock runtime data.
 */
export const mockRuntimes = [
  {
    uid: 'runtime-123',
    given_name: 'test-notebook-runtime',
    pod_name: 'datalayer-runtime-abc123',
    ingress: 'https://runtime-abc123.prod1.datalayer.run',
    token: 'mock-runtime-token',
    environment_name: 'python-cpu-env',
    environment_title: 'Python CPU Environment',
    type: 'notebook',
    burning_rate: 5.0,
    reservation_id: 'reservation-123',
    started_at: '1704067200',
    expired_at: '1704070800',
    status: 'Running',
  },
  {
    uid: 'runtime-456',
    given_name: 'test-terminal-runtime',
    pod_name: 'datalayer-runtime-def456',
    ingress: 'https://runtime-def456.prod1.datalayer.run',
    token: 'mock-runtime-token-2',
    environment_name: 'python-gpu-env',
    environment_title: 'Python GPU Environment',
    type: 'terminal',
    burning_rate: 10.0,
    reservation_id: 'reservation-456',
    started_at: '1704067200',
    expired_at: '1704074400',
    status: 'Running',
  },
];

/**
 * Mock space data.
 */
export const mockSpaces = [
  {
    id: 'space-123',
    name: 'My Workspace',
    description: 'Personal workspace for data science',
    owner_id: 'user-123',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    is_public: false,
  },
  {
    id: 'space-456',
    name: 'Team Project',
    description: 'Shared workspace for team collaboration',
    owner_id: 'user-123',
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
    is_public: false,
  },
];

/**
 * Mock notebook data.
 */
export const mockNotebooks = [
  {
    id: 'notebook-123',
    name: 'Data Analysis',
    description: 'Sales data analysis notebook',
    type: 'notebook',
    space_id: 'space-123',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    cdn_url: 'https://cdn.datalayer.run/notebooks/notebook-123.ipynb',
  },
  {
    id: 'notebook-456',
    name: 'Machine Learning Model',
    description: 'Training ML models',
    type: 'notebook',
    space_id: 'space-123',
    created_at: '2024-01-02T00:00:00Z',
    updated_at: '2024-01-02T00:00:00Z',
    cdn_url: 'https://cdn.datalayer.run/notebooks/notebook-456.ipynb',
  },
  {
    id: 'lexical-789',
    name: 'Project Documentation',
    description: 'Documentation for the project',
    type: 'lexical',
    space_id: 'space-123',
    created_at: '2024-01-03T00:00:00Z',
    updated_at: '2024-01-03T00:00:00Z',
    cdn_url: 'https://cdn.datalayer.run/lexical/lexical-789.json',
  },
];

/**
 * Mock notebook content (Jupyter format).
 */
export const mockNotebookContent = {
  cells: [
    {
      cell_type: 'markdown',
      metadata: {},
      source: ['# Test Notebook\n', '\n', 'This is a test notebook for testing purposes.'],
    },
    {
      cell_type: 'code',
      execution_count: null,
      metadata: {},
      outputs: [],
      source: ['import numpy as np\n', 'import pandas as pd\n', '\n', 'print("Hello, World!")'],
    },
    {
      cell_type: 'code',
      execution_count: 1,
      metadata: {},
      outputs: [
        {
          name: 'stdout',
          output_type: 'stream',
          text: ['42\n'],
        },
      ],
      source: ['result = 6 * 7\n', 'print(result)'],
    },
  ],
  metadata: {
    kernelspec: {
      display_name: 'Python 3',
      language: 'python',
      name: 'python3',
    },
    language_info: {
      name: 'python',
      version: '3.11.0',
    },
  },
  nbformat: 4,
  nbformat_minor: 5,
};

/**
 * Mock Jupyter kernel information.
 */
export const mockKernelInfo = {
  id: 'kernel-123',
  name: 'python3',
  last_activity: new Date().toISOString(),
  execution_state: 'idle',
  connections: 1,
};

/**
 * Mock Jupyter session information.
 */
export const mockSessionInfo = {
  id: 'session-123',
  name: 'notebook-123.ipynb',
  path: '/notebooks/notebook-123.ipynb',
  type: 'notebook',
  kernel: mockKernelInfo,
};
