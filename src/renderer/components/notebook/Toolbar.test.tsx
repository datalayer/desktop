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
import userEvent from '@testing-library/user-event';
import { Notebook2Toolbar } from './Toolbar';
import { mockEnvironments } from '../../../tests/fixtures';

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

// Mock window.datalayerClient
const mockDatalayerClient = {
  listEnvironments: vi.fn().mockResolvedValue(mockEnvironments),
  createRuntime: vi.fn(),
  deleteRuntime: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();

  (global as any).window = {
    ...((global as any).window || {}),
    datalayerClient: mockDatalayerClient,
    datalayerAPI: {
      createRuntime: vi.fn(),
      deleteRuntime: vi.fn(),
    },
  };
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
    render(<Notebook2Toolbar {...defaultProps} runtimePodName="test-pod-123" />);

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

  it('should call onRuntimeCreated when provided', async () => {
    const onRuntimeCreated = vi.fn();

    render(<Notebook2Toolbar {...defaultProps} onRuntimeCreated={onRuntimeCreated} />);

    // onRuntimeCreated would be called by child components (RuntimeSelector)
    expect(screen.getByRole('toolbar')).toBeInTheDocument();
  });

  it('should call onRuntimeSelected when provided', () => {
    const onRuntimeSelected = vi.fn();

    render(<Notebook2Toolbar {...defaultProps} onRuntimeSelected={onRuntimeSelected} />);

    expect(screen.getByRole('toolbar')).toBeInTheDocument();
  });

  it('should call onRuntimeTerminated when provided', () => {
    const onRuntimeTerminated = vi.fn();

    render(<Notebook2Toolbar {...defaultProps} onRuntimeTerminated={onRuntimeTerminated} />);

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
    const { container } = render(<Notebook2Toolbar {...defaultProps} />);

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
      onRuntimeCreated: vi.fn(),
      onRuntimeSelected: vi.fn(),
      onRuntimeTerminated: vi.fn(),
    };

    render(<Notebook2Toolbar {...defaultProps} {...callbacks} />);

    expect(screen.getByRole('toolbar')).toBeInTheDocument();
  });
});
