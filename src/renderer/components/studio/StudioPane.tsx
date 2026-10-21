/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Where the Studio shows (DESKTOP DK-02): the *Studio* tab's content area.
 * The web app is not in this renderer — it is a `WebContentsView` the
 * main process owns — so this pane only measures itself and tells the
 * main process where to show the view, and hides it when the tab is away.
 *
 * @module renderer/components/studio/StudioPane
 */

import React, { useEffect, useRef } from 'react';
import { Box } from '@primer/react';

/**
 * The content area's rectangle, in the window's content coordinates (CSS
 * pixels: Electron's view bounds are device-independent).
 *
 * @param element - The pane.
 *
 * @returns Its bounds.
 */
export function boundsOf(element: {
  getBoundingClientRect: () => {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}): { x: number; y: number; width: number; height: number } {
  const rect = element.getBoundingClientRect();
  return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
}

/**
 * The pane: empty itself, the Studio view over it.
 */
const StudioPane: React.FC = () => {
  const pane = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = pane.current;
    if (!element || !window.studioAPI) {
      return;
    }
    const show = () => {
      window.studioAPI.show(boundsOf(element)).catch(() => undefined);
    };
    show();
    const observer = new ResizeObserver(show);
    observer.observe(element);
    window.addEventListener('resize', show);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', show);
      window.studioAPI.hide().catch(() => undefined);
    };
  }, []);

  return (
    <Box
      ref={pane}
      data-testid="studio-pane"
      sx={{ flex: 1, minHeight: 0, width: '100%', height: '100%' }}
    />
  );
};

export default StudioPane;
