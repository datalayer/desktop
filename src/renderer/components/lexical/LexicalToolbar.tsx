/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Standalone lexical toolbar that can be used in RuntimeToolbar.
 *
 * @module components/lexical/LexicalToolbar
 */

import React from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { ToolbarPlugin } from '@datalayer/jupyter-lexical';

/**
 * Lexical formatting toolbar component.
 * Must be used inside LexicalComposer context.
 */
export const LexicalToolbar: React.FC = () => {
  const [editor] = useLexicalComposerContext();
  const [activeEditor, setActiveEditor] = React.useState(editor);
  const [_isLinkEditMode, setIsLinkEditMode] = React.useState<boolean>(false);

  return (
    <ToolbarPlugin
      editor={editor}
      activeEditor={activeEditor}
      setActiveEditor={setActiveEditor}
      setIsLinkEditMode={setIsLinkEditMode}
    />
  );
};
