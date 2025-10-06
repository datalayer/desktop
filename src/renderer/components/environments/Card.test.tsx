/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Tests for Environment Card component.
 * Tests environment display, icon, resources, and layout.
 *
 * @module renderer/components/environments/Card.test
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import Card from './Card';

// Mock child components
vi.mock('./Icon', () => ({
  default: ({ environment }: any) => (
    <div data-testid="environment-icon">{environment.name}-icon</div>
  ),
}));

vi.mock('./TypeLabel', () => ({
  default: ({ environment }: any) => (
    <div data-testid="type-label">{environment.type || 'cpu'}-label</div>
  ),
}));

vi.mock('./Description', () => ({
  default: ({ environment }: any) => (
    <div data-testid="description">
      {environment.description || 'No description'}
    </div>
  ),
}));

vi.mock('./Resources', () => ({
  default: ({ resources }: any) => (
    <div data-testid="resources">
      CPU: {resources?.cpu?.default || 0}, Memory:{' '}
      {resources?.memory?.default || 0}
    </div>
  ),
}));

describe('Environment Card', () => {
  const baseEnvironment = {
    name: 'python-cpu-env',
    title: 'Python CPU Environment',
    description: 'Python environment for CPU computing',
    type: 'cpu',
    image: 'python:3.11',
    resources: {
      cpu: { min: 1, max: 4, default: 2 },
      memory: { min: 1024, max: 8192, default: 2048 },
    },
  };

  describe('rendering', () => {
    it('should render environment card', () => {
      render(<Card environment={baseEnvironment} />);

      expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();
    });

    it('should display environment title', () => {
      render(<Card environment={baseEnvironment} />);

      expect(screen.getByText('Python CPU Environment')).toBeInTheDocument();
    });

    it('should use environment name when title not available', () => {
      const envWithoutTitle = {
        ...baseEnvironment,
        title: undefined,
      };

      render(<Card environment={envWithoutTitle as any} />);

      expect(screen.getByText('python-cpu-env')).toBeInTheDocument();
    });

    it('should display environment icon', () => {
      render(<Card environment={baseEnvironment} />);

      const icon = screen.getByTestId('environment-icon');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveTextContent('python-cpu-env-icon');
    });

    it('should display type label', () => {
      render(<Card environment={baseEnvironment} />);

      const typeLabel = screen.getByTestId('type-label');
      expect(typeLabel).toBeInTheDocument();
      expect(typeLabel).toHaveTextContent('cpu-label');
    });

    it('should display description', () => {
      render(<Card environment={baseEnvironment} />);

      const description = screen.getByTestId('description');
      expect(description).toBeInTheDocument();
    });

    it('should display resources', () => {
      render(<Card environment={baseEnvironment} />);

      const resources = screen.getByTestId('resources');
      expect(resources).toBeInTheDocument();
      expect(resources).toHaveTextContent('CPU: 2');
      expect(resources).toHaveTextContent('Memory: 2048');
    });

    it('should display image when provided', () => {
      render(<Card environment={baseEnvironment} />);

      expect(screen.getByText(/Image:/)).toBeInTheDocument();
      expect(screen.getByText(/python:3.11/)).toBeInTheDocument();
    });

    it('should not display image section when not provided', () => {
      const envWithoutImage = {
        ...baseEnvironment,
        image: undefined,
      };

      render(<Card environment={envWithoutImage as any} />);

      expect(screen.queryByText(/Image:/)).not.toBeInTheDocument();
    });
  });

  describe('different environment types', () => {
    it('should render CPU environment', () => {
      const cpuEnv = {
        ...baseEnvironment,
        type: 'cpu',
        title: 'CPU Environment',
      };

      render(<Card environment={cpuEnv} />);

      expect(screen.getByText('CPU Environment')).toBeInTheDocument();
      expect(screen.getByTestId('type-label')).toHaveTextContent('cpu-label');
    });

    it('should render GPU environment', () => {
      const gpuEnv = {
        ...baseEnvironment,
        type: 'gpu',
        title: 'GPU Environment',
      };

      render(<Card environment={gpuEnv} />);

      expect(screen.getByText('GPU Environment')).toBeInTheDocument();
      expect(screen.getByTestId('type-label')).toHaveTextContent('gpu-label');
    });

    it('should handle environment without type', () => {
      const envWithoutType = {
        ...baseEnvironment,
        type: undefined,
      };

      render(<Card environment={envWithoutType as any} />);

      expect(screen.getByTestId('type-label')).toBeInTheDocument();
    });
  });

  describe('resource configurations', () => {
    it('should display default resource values', () => {
      render(<Card environment={baseEnvironment} />);

      const resources = screen.getByTestId('resources');
      expect(resources).toHaveTextContent('CPU: 2');
      expect(resources).toHaveTextContent('Memory: 2048');
    });

    it('should handle minimal resources', () => {
      const minimalResourcesEnv = {
        ...baseEnvironment,
        resources: {
          cpu: { min: 1, max: 1, default: 1 },
          memory: { min: 512, max: 512, default: 512 },
        },
      };

      render(<Card environment={minimalResourcesEnv} />);

      const resources = screen.getByTestId('resources');
      expect(resources).toHaveTextContent('CPU: 1');
      expect(resources).toHaveTextContent('Memory: 512');
    });

    it('should handle maximum resources', () => {
      const maxResourcesEnv = {
        ...baseEnvironment,
        resources: {
          cpu: { min: 1, max: 16, default: 16 },
          memory: { min: 1024, max: 32768, default: 32768 },
        },
      };

      render(<Card environment={maxResourcesEnv} />);

      const resources = screen.getByTestId('resources');
      expect(resources).toHaveTextContent('CPU: 16');
      expect(resources).toHaveTextContent('Memory: 32768');
    });

    it('should handle undefined resources', () => {
      const envWithoutResources = {
        ...baseEnvironment,
        resources: undefined,
      };

      render(<Card environment={envWithoutResources as any} />);

      const resources = screen.getByTestId('resources');
      expect(resources).toHaveTextContent('CPU: 0');
      expect(resources).toHaveTextContent('Memory: 0');
    });
  });

  describe('layout and styling', () => {
    it('should render as a bordered box', () => {
      const { container } = render(<Card environment={baseEnvironment} />);

      const card = container.firstChild;
      expect(card).toBeInTheDocument();
    });

    it('should have proper heading level', () => {
      render(<Card environment={baseEnvironment} />);

      const heading = screen.getByRole('heading', { level: 3 });
      expect(heading).toBeInTheDocument();
      expect(heading).toHaveTextContent('Python CPU Environment');
    });

    it('should display icon before title', () => {
      render(<Card environment={baseEnvironment} />);

      const icon = screen.getByTestId('environment-icon');
      const heading = screen.getByRole('heading', { level: 3 });

      expect(icon).toBeInTheDocument();
      expect(heading).toBeInTheDocument();
    });

    it('should display type label next to title', () => {
      render(<Card environment={baseEnvironment} />);

      const heading = screen.getByRole('heading', { level: 3 });
      const typeLabel = screen.getByTestId('type-label');

      expect(heading).toBeInTheDocument();
      expect(typeLabel).toBeInTheDocument();
    });
  });

  describe('edge cases', () => {
    it('should handle empty environment name', () => {
      const emptyNameEnv = {
        ...baseEnvironment,
        name: '',
        title: 'Environment',
      };

      render(<Card environment={emptyNameEnv} />);

      expect(screen.getByText('Environment')).toBeInTheDocument();
    });

    it('should handle empty title with name', () => {
      const emptyTitleEnv = {
        ...baseEnvironment,
        title: '',
      };

      render(<Card environment={emptyTitleEnv} />);

      expect(screen.getByText('python-cpu-env')).toBeInTheDocument();
    });

    it('should handle long environment names', () => {
      const longNameEnv = {
        ...baseEnvironment,
        title:
          'Very Long Python Environment Name With Many Details About Configuration And Purpose',
      };

      render(<Card environment={longNameEnv} />);

      expect(
        screen.getByText(
          /Very Long Python Environment Name With Many Details About Configuration And Purpose/
        )
      ).toBeInTheDocument();
    });

    it('should handle special characters in image name', () => {
      const specialImageEnv = {
        ...baseEnvironment,
        image: 'registry.example.com/namespace/python:3.11-slim-bullseye',
      };

      render(<Card environment={specialImageEnv} />);

      expect(
        screen.getByText(
          /registry.example.com\/namespace\/python:3.11-slim-bullseye/
        )
      ).toBeInTheDocument();
    });

    it('should handle missing description', () => {
      const noDescriptionEnv = {
        ...baseEnvironment,
        description: undefined,
      };

      render(<Card environment={noDescriptionEnv as any} />);

      const description = screen.getByTestId('description');
      expect(description).toHaveTextContent('No description');
    });

    it('should render multiple cards independently', () => {
      const env1 = {
        ...baseEnvironment,
        name: 'env-1',
        title: 'Environment 1',
      };
      const env2 = {
        ...baseEnvironment,
        name: 'env-2',
        title: 'Environment 2',
      };

      render(
        <>
          <Card environment={env1} />
          <Card environment={env2} />
        </>
      );

      expect(screen.getByText('Environment 1')).toBeInTheDocument();
      expect(screen.getByText('Environment 2')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should use semantic HTML heading', () => {
      render(<Card environment={baseEnvironment} />);

      const heading = screen.getByRole('heading', { level: 3 });
      expect(heading).toBeInTheDocument();
    });

    it('should have proper text hierarchy', () => {
      render(<Card environment={baseEnvironment} />);

      const heading = screen.getByRole('heading', { level: 3 });
      const description = screen.getByTestId('description');

      expect(heading).toBeInTheDocument();
      expect(description).toBeInTheDocument();
    });

    it('should display monospace font for image name', () => {
      render(<Card environment={baseEnvironment} />);

      const imageText = screen.getByText(/python:3.11/);
      expect(imageText).toBeInTheDocument();
    });
  });

  describe('component composition', () => {
    it('should render Icon component', () => {
      render(<Card environment={baseEnvironment} />);

      expect(screen.getByTestId('environment-icon')).toBeInTheDocument();
    });

    it('should render TypeLabel component', () => {
      render(<Card environment={baseEnvironment} />);

      expect(screen.getByTestId('type-label')).toBeInTheDocument();
    });

    it('should render Description component', () => {
      render(<Card environment={baseEnvironment} />);

      expect(screen.getByTestId('description')).toBeInTheDocument();
    });

    it('should render Resources component', () => {
      render(<Card environment={baseEnvironment} />);

      expect(screen.getByTestId('resources')).toBeInTheDocument();
    });

    it('should pass environment to Icon', () => {
      render(<Card environment={baseEnvironment} />);

      const icon = screen.getByTestId('environment-icon');
      expect(icon).toHaveTextContent('python-cpu-env-icon');
    });

    it('should pass resources to Resources component', () => {
      render(<Card environment={baseEnvironment} />);

      const resources = screen.getByTestId('resources');
      expect(resources).toHaveTextContent('CPU: 2');
      expect(resources).toHaveTextContent('Memory: 2048');
    });
  });
});
