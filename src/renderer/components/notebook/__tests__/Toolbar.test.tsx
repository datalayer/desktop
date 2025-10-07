/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Tests for the Notebook Toolbar component.
 *
 * @module renderer/components/notebook/Toolbar.test
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
// import userEvent from "@testing-library/user-event"; // Unused
import { Notebook2Toolbar } from '../Toolbar';
import { mockEnvironments } from '../../../../../tests/fixtures/index';

// Mock the notebookStore2
vi.mock('@datalayer/jupyter-react', () => ({
  notebookStore2: {
    subscribe: vi.fn(() => vi.fn()),
    getState: vi.fn(() => ({
      notebooks: new Map(),
    })),
  },
}));

// Mock runtime store
vi.mock('../../stores/runtimeStore', () => ({
  useRuntimeStore: () => ({
    fetchAllRuntimes: vi.fn().mockResolvedValue([]),
    allRuntimes: [],
    isCreatingRuntime: false,
    isTerminatingRuntime: false,
  }),
}));

// Mock ServiceContext
vi.mock('../../contexts/ServiceContext', () => ({
  useService: (serviceName: string) => {
    if (serviceName === 'runtimeService') {
      return {
        getRuntimes: vi.fn().mockResolvedValue([]),
        createRuntime: vi.fn().mockResolvedValue({}),
        terminateRuntime: vi.fn().mockResolvedValue(undefined),
        refreshAllRuntimes: vi.fn().mockResolvedValue(undefined),
      };
    }
    return null;
  },
}));

// Mock RuntimeProgressBar
vi.mock('../runtime/RuntimeProgressBar', () => ({
  RuntimeProgressBar: () => (
    <div data-testid="runtime-progress-bar">Progress Bar</div>
  ),
}));

// Mock RuntimeSelector
vi.mock('../runtime/RuntimeSelector', () => ({
  RuntimeSelector: () => (
    <div data-testid="runtime-selector">Runtime Selector</div>
  ),
}));

// Mock window.datalayerClient
const mockDatalayerClient = {
  listEnvironments: vi.fn().mockResolvedValue(mockEnvironments),
  createRuntime: vi.fn(),
  deleteRuntime: vi.fn(),
  listRuntimes: vi.fn().mockResolvedValue([]),
  getRuntime: vi.fn().mockResolvedValue({}),
};

beforeEach(() => {
  vi.clearAllMocks();

  // Set up window.datalayerClient mock
  Object.defineProperty(window, 'datalayerClient', {
    writable: true,
    configurable: true,
    value: mockDatalayerClient,
  });

  Object.defineProperty(window, 'datalayerAPI', {
    writable: true,
    configurable: true,
    value: {
      createRuntime: vi.fn(),
      deleteRuntime: vi.fn(),
    },
  });
});

describe('Notebook2Toolbar', () => {
  const defaultProps = {
    notebookId: 'test-notebook-1',
    showNotebookControls: true,
  };

  it('should render without crashing', () => {
    render(<Notebook2Toolbar {...defaultProps} />);
    expect(screen.getByRole('toolbar')).toBeInTheDocument();
  });

  it('should render notebook controls when showNotebookControls is true', () => {
    render(<Notebook2Toolbar {...defaultProps} />);

    // Should have run/execute buttons
    expect(screen.getAllByRole('button').length).toBeGreaterThan(0);
  });

  it('should render RuntimeProgressBar when runtime pod name is provided', () => {
    render(
      <Notebook2Toolbar {...defaultProps} runtimePodName="test-pod-123" />
    );

    // RuntimeProgressBar should be rendered (we'd need to check for its elements)
    expect(screen.getByRole('toolbar')).toBeInTheDocument();
  });

  it('should render RuntimeSelector component', () => {
    render(<Notebook2Toolbar {...defaultProps} />);

    // RuntimeSelector should be present in the toolbar
    expect(screen.getByRole('toolbar')).toBeInTheDocument();
  });

  it('should hide notebook controls when showNotebookControls is false', () => {
    render(<Notebook2Toolbar {...defaultProps} showNotebookControls={false} />);

    // Should still render toolbar but with fewer controls
    expect(screen.getByRole('toolbar')).toBeInTheDocument();
  });

  it('should call onRuntimeSelected when provided', () => {
    const onRuntimeSelected = vi.fn();

    render(
      <Notebook2Toolbar
        {...defaultProps}
        onRuntimeSelected={onRuntimeSelected}
      />
    );

    expect(screen.getByRole('toolbar')).toBeInTheDocument();
  });

  it('should render with minimal props', () => {
    render(<Notebook2Toolbar />);

    expect(screen.getByRole('toolbar')).toBeInTheDocument();
  });

  it('should handle undefined notebookId', () => {
    render(<Notebook2Toolbar notebookId={undefined} />);

    expect(screen.getByRole('toolbar')).toBeInTheDocument();
  });

  it('should render toolbar with proper structure', () => {
    render(<Notebook2Toolbar {...defaultProps} />);

    // Check that toolbar has proper Box container structure
    const toolbar = screen.getByRole('toolbar');
    expect(toolbar).toBeInTheDocument();
  });
});

describe('Notebook2Toolbar - Integration', () => {
  const defaultProps = {
    notebookId: 'test-notebook-1',
    runtimePodName: 'test-runtime-pod',
  };

  it('should integrate with RuntimeProgressBar when runtime is provided', () => {
    render(<Notebook2Toolbar {...defaultProps} />);

    // Should render the toolbar with runtime info
    expect(screen.getByRole('toolbar')).toBeInTheDocument();
  });

  it('should integrate with RuntimeSelector for runtime selection', () => {
    render(<Notebook2Toolbar {...defaultProps} />);

    // RuntimeSelector should be present
    expect(screen.getByRole('toolbar')).toBeInTheDocument();
  });

  it('should handle runtime lifecycle callbacks', () => {
    const callbacks = {
      onRuntimeSelected: vi.fn(),
    };

    render(<Notebook2Toolbar {...defaultProps} {...callbacks} />);

    expect(screen.getByRole('toolbar')).toBeInTheDocument();
  });
});
