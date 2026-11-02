/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Keeps a page's crash inside the page: the main app is mounted behind the
 * sign-in form, so an uncaught error in a page used to unmount the form too and
 * leave the window blank. The page says what failed and offers a reload; another
 * tab still works.
 *
 * @module renderer/components/app/ViewErrorBoundary
 */

import React from 'react';
import { Box, Button, Flash, Text } from '@primer/react';

interface ViewErrorBoundaryProps {
  /** The page's name, in the sentence. */
  view: string;
  children: React.ReactNode;
}

interface ViewErrorBoundaryState {
  error: Error | null;
}

export class ViewErrorBoundary extends React.Component<
  ViewErrorBoundaryProps,
  ViewErrorBoundaryState
> {
  state: ViewErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ViewErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error(`[${this.props.view}] crashed:`, error, info.componentStack);
  }

  render(): React.ReactNode {
    const { error } = this.state;
    if (!error) {
      return this.props.children;
    }
    return (
      <Box sx={{ p: 4 }}>
        <Flash variant="danger">
          <Text as="p" sx={{ fontWeight: 'bold', m: 0 }}>
            {this.props.view} stopped on an error.
          </Text>
          <Text as="p" sx={{ fontFamily: 'mono', fontSize: 1, mt: 2, mb: 3 }}>
            {error.message}
          </Text>
          <Button onClick={() => window.location.reload()}>Reload</Button>
        </Flash>
      </Box>
    );
  }
}

export default ViewErrorBoundary;
