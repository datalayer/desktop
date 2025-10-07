/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Notebook controls for the toolbar
 */

import React, { useState, useEffect } from 'react';
import { Box, IconButton, ButtonGroup, Button } from '@primer/react';
import {
  PlayIcon,
  StopIcon,
  TrashIcon,
  PaperAirplaneIcon,
} from '@primer/octicons-react';
import { notebookStore2 } from '@datalayer/jupyter-react';

export interface NotebookControlsProps {
  notebookId?: string;
  runtimePodName?: string;
}

export const NotebookControls: React.FC<NotebookControlsProps> = ({
  notebookId,
  runtimePodName,
}) => {
  const [cellType, setCellType] = useState('code');
  const [isCellRunning, setIsCellRunning] = useState(false);

  // Monitor kernel execution state
  useEffect(() => {
    if (!notebookId) return;

    const unsubscribe = notebookStore2.subscribe(state => {
      const notebook = state.notebooks.get(notebookId);
      if (!notebook?.adapter) {
        setIsCellRunning(false);
        return;
      }

      // Access kernel status via adapter's context
      const kernelStatus =
        notebook.adapter.context.sessionContext?.session?.kernel?.status;
      const isBusy = kernelStatus === 'busy';
      setIsCellRunning(isBusy);
    });

    return () => unsubscribe();
  }, [notebookId]);

  const handleRun = (e: React.MouseEvent) => {
    e.preventDefault();
    if (notebookId) notebookStore2.getState().run(notebookId);
  };

  const handleRunAll = (e: React.MouseEvent) => {
    e.preventDefault();
    if (notebookId) notebookStore2.getState().runAll(notebookId);
  };

  const handleInterrupt = (e: React.MouseEvent) => {
    e.preventDefault();
    if (notebookId) notebookStore2.getState().interrupt(notebookId);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.preventDefault();
    if (notebookId) notebookStore2.getState().delete(notebookId);
  };

  return (
    <>
      <IconButton
        variant="invisible"
        size="small"
        aria-label="Run cell"
        title={!runtimePodName ? 'No runtime connected' : 'Run cell'}
        onClick={handleRun}
        icon={PlayIcon}
        disabled={!runtimePodName}
      />
      <IconButton
        variant="invisible"
        size="small"
        aria-label="Run all cells"
        title={!runtimePodName ? 'No runtime connected' : 'Run all cells'}
        onClick={handleRunAll}
        icon={PaperAirplaneIcon}
        disabled={!runtimePodName}
      />
      <IconButton
        variant="invisible"
        size="small"
        aria-label="Interrupt"
        title={
          !runtimePodName
            ? 'No runtime connected'
            : !isCellRunning
              ? 'No cells running'
              : 'Interrupt kernel'
        }
        onClick={handleInterrupt}
        icon={StopIcon}
        disabled={!runtimePodName || !isCellRunning}
      />
      <Box sx={{ width: 1, height: 20, bg: 'border.default', mx: 1 }} />
      <IconButton
        variant="invisible"
        size="small"
        aria-label="Delete cell"
        title="Delete cell"
        onClick={handleDelete}
        icon={TrashIcon}
      />
      <Box sx={{ width: 1, height: 20, bg: 'border.default', mx: 1 }} />
      <ButtonGroup>
        <Button
          size="small"
          variant={cellType === 'code' ? 'primary' : 'invisible'}
          onClick={() => setCellType('code')}
        >
          Code
        </Button>
        <Button
          size="small"
          variant={cellType === 'markdown' ? 'primary' : 'invisible'}
          onClick={() => setCellType('markdown')}
        >
          Markdown
        </Button>
      </ButtonGroup>
    </>
  );
};
