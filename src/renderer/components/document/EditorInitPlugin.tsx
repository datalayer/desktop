/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Lexical editor initialization plugin for document editing.
 *
 * @module renderer/components/document/EditorInitPlugin
 */

import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { EditorInitPluginProps } from '../../../shared/types';

/**
 * Plugin component that provides access to the Lexical editor instance on initialization.
 */
const EditorInitPlugin: React.FC<EditorInitPluginProps> = ({
  onEditorInit,
}) => {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    onEditorInit(editor);
  }, [editor, onEditorInit]);

  return null;
};

export default EditorInitPlugin;
