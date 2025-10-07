/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * @module components/lexical/LexicalEditor
 * React component for the Lexical rich text editor in Desktop app.
 * Provides full-featured text editor with Loro CRDT collaboration support.
 */

import { useCallback, useEffect, useState } from 'react';
import { EditorState } from 'lexical';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { TableCellNode, TableNode, TableRowNode } from '@lexical/table';
import { ListItemNode, ListNode } from '@lexical/list';
import { AutoLinkNode, LinkNode } from '@lexical/link';
import { CodeNode } from '@lexical/code';
import { MarkNode } from '@lexical/mark';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { TablePlugin } from '@lexical/react/LexicalTablePlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { HashtagNode } from '@lexical/hashtag';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { CheckListPlugin } from '@lexical/react/LexicalCheckListPlugin';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { HorizontalRuleNode } from '@lexical/react/LexicalHorizontalRuleNode';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { commentTheme } from '@datalayer/jupyter-lexical';
import {
  JupyterInputHighlightNode,
  JupyterInputNode,
  JupyterOutputNode,
} from '@datalayer/jupyter-lexical';
import {
  AutoEmbedPlugin,
  AutoLinkPlugin,
  CodeActionMenuPlugin,
  CommentPlugin,
  ComponentPickerMenuPlugin,
  DraggableBlockPlugin,
  EquationNode,
  EquationsPlugin,
  HorizontalRulePlugin,
  ImageNode,
  ImagesPlugin,
  JupyterInputOutputPlugin,
  ListMaxIndentLevelPlugin,
  MarkdownPlugin,
  YouTubeNode,
  YouTubePlugin,
} from '@datalayer/jupyter-lexical';
import { LoroCollaborationPlugin } from '@datalayer/lexical-loro';
import { ToolbarPlugin, ToolbarContext } from '@datalayer/jupyter-lexical';
import {
  createDesktopLoroProvider,
  setCollaborationToken,
  setCollaborationUser,
} from '../../services/loro/providerFactory';
import { RuntimeSelector } from '../runtime/RuntimeSelector';
import { Box } from '@primer/react';
import type { Runtime } from '../../services/interfaces/IRuntimeService';
import '@datalayer/jupyter-lexical/style/lexical/Editor.css';
import '@datalayer/jupyter-lexical/style/lexical/ToolbarPlugin.css';
import '@datalayer/jupyter-lexical/style/lexical/Theme.css';
import './LexicalEditor.css';

// Debug: Log that we imported the factory
console.log(
  '[LexicalEditor] Imported createDesktopLoroProvider:',
  createDesktopLoroProvider
);

/**
 * Placeholder for empty editor
 */
function Placeholder() {
  return <div className="editor-placeholder">Start typing...</div>;
}

/**
 * Collaboration configuration for Lexical documents
 */
interface CollaborationConfig {
  enabled: boolean;
  websocketUrl?: string;
  documentId?: string;
  sessionId?: string;
  username?: string;
  userColor?: string;
  token?: string;
}

/**
 * Properties for the LexicalEditor component
 */
export interface LexicalEditorProps {
  initialContent?: string;
  onSave?: (content: string) => void;
  onContentChange?: (content: string) => void;
  className?: string;
  editable?: boolean;
  collaboration?: CollaborationConfig;
  showRuntimeSelector?: boolean;
  runtimePodName?: string;
  onRuntimeSelected?: (runtime: Runtime | null) => void;
}

/**
 * Initial editor configuration
 */
const initialConfig = {
  editorState: null,
  namespace: 'Datalayer Desktop',
  theme: commentTheme,
  onError(error: Error) {
    console.error('Lexical editor error:', error);
  },
  nodes: [
    AutoLinkNode,
    CodeNode,
    EquationNode,
    HashtagNode,
    HeadingNode,
    HorizontalRuleNode,
    ImageNode,
    JupyterInputHighlightNode,
    JupyterInputNode,
    JupyterOutputNode,
    LinkNode,
    ListItemNode,
    ListNode,
    MarkNode,
    QuoteNode,
    TableCellNode,
    TableNode,
    TableRowNode,
    YouTubeNode,
  ],
};

/**
 * Inner editor container component with all plugins
 */
function LexicalEditorContainer({
  collaboration,
  onContentChange,
  showRuntimeSelector,
  runtimePodName,
  onRuntimeSelected,
}: {
  collaboration?: CollaborationConfig;
  onContentChange?: (content: string) => void;
  showRuntimeSelector?: boolean;
  runtimePodName?: string;
  onRuntimeSelected?: (runtime: Runtime | null) => void;
}) {
  const [editor] = useLexicalComposerContext();
  const [activeEditor, setActiveEditor] = useState(editor);
  const [_isLinkEditMode, setIsLinkEditMode] = useState<boolean>(false);
  const [floatingAnchorElem, setFloatingAnchorElem] =
    useState<HTMLDivElement | null>(null);
  const [isCollabInitialized, setIsCollabInitialized] = useState(
    !collaboration?.enabled
  );

  // Set collaboration state IMMEDIATELY and SYNCHRONOUSLY before any rendering
  if (collaboration?.enabled) {
    if (collaboration?.token) {
      setCollaborationToken(collaboration.token);
    }
    if (collaboration?.username && collaboration?.userColor) {
      setCollaborationUser(collaboration.username, collaboration.userColor);
    }
  }

  const onRef = (_floatingAnchorElem: HTMLDivElement) => {
    if (_floatingAnchorElem !== null) {
      setFloatingAnchorElem(_floatingAnchorElem);
    }
  };

  const onChange = useCallback(
    (editorState: EditorState) => {
      try {
        const jsonString = JSON.stringify(editorState);
        if (onContentChange) {
          onContentChange(jsonString);
        }
      } catch (error) {
        console.debug('Editor state serialization skipped:', error);
      }
    },
    [onContentChange]
  );

  useEffect(() => {
    // Reset collaboration state when document changes
    setIsCollabInitialized(!collaboration?.enabled);
  }, [collaboration?.documentId, collaboration?.enabled]);

  const onCollabInitialization = useCallback((initialized: boolean) => {
    console.log('[LexicalEditor] Collaboration initialized:', initialized);
    setIsCollabInitialized(initialized);
  }, []);

  // TEST: Call the factory directly to verify it works
  useEffect(() => {
    if (collaboration?.enabled && collaboration.documentId) {
      console.log('[LexicalEditor] 🔍 TESTING provider factory directly:');
      console.log(
        '[LexicalEditor] Factory function:',
        createDesktopLoroProvider
      );
      console.log(
        '[LexicalEditor] Factory type:',
        typeof createDesktopLoroProvider
      );
      console.log(
        '[LexicalEditor] Factory name:',
        createDesktopLoroProvider.name
      );
    }
  }, [collaboration?.enabled, collaboration?.documentId]);

  return (
    <div className="editor-container">
      {/* Toolbar with integrated runtime selector */}
      <Box
        className="lexical-toolbar-fixed"
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          padding: '8px 12px',
        }}
      >
        <Box sx={{ flex: 1 }}>
          <ToolbarPlugin
            editor={editor}
            activeEditor={activeEditor}
            setActiveEditor={setActiveEditor}
            setIsLinkEditMode={setIsLinkEditMode}
          />
        </Box>
        {showRuntimeSelector && onRuntimeSelected && (
          <Box sx={{ flexShrink: 0, minWidth: '200px' }}>
            <RuntimeSelector
              selectedRuntimePodName={runtimePodName}
              onRuntimeSelected={onRuntimeSelected}
            />
          </Box>
        )}
      </Box>
      <div className="editor-inner">
        {collaboration?.enabled && collaboration.documentId ? (
          <>
            {console.log(
              '[LexicalEditor] ⚡ Rendering LoroCollaborationPlugin with:',
              {
                id: collaboration.documentId,
                providerFactory: createDesktopLoroProvider,
                providerFactoryType: typeof createDesktopLoroProvider,
                providerFactoryName: createDesktopLoroProvider?.name,
                websocketUrl: collaboration.websocketUrl,
                username: collaboration.username,
                cursorColor: collaboration.userColor,
              }
            )}
            <LoroCollaborationPlugin
              id={collaboration.documentId}
              shouldBootstrap
              showCollaborators
              providerFactory={createDesktopLoroProvider}
              websocketUrl={collaboration.websocketUrl || ''}
              username={collaboration.username}
              cursorColor={collaboration.userColor}
              onInitialization={onCollabInitialization}
            />
          </>
        ) : null}

        {/* Always render editor, even before collaboration initializes */}
        <HistoryPlugin />
        <OnChangePlugin onChange={onChange} />
        <RichTextPlugin
          contentEditable={
            <div className="editor-scroller">
              <div className="editor" ref={onRef}>
                <ContentEditable />
              </div>
            </div>
          }
          placeholder={<Placeholder />}
          ErrorBoundary={LexicalErrorBoundary}
        />

        {/* Render plugins after collaboration is ready (or immediately if no collaboration) */}
        {isCollabInitialized && (
          <>
            <ComponentPickerMenuPlugin
              initCode="print('🖥️ Desktop')"
              kernel={undefined}
            />
            <EquationsPlugin />
            <AutoFocusPlugin />
            <TablePlugin />
            <ListPlugin />
            <CheckListPlugin />
            <LinkPlugin />
            <AutoLinkPlugin />
            <ListMaxIndentLevelPlugin maxDepth={7} />
            <MarkdownPlugin />
            <JupyterInputOutputPlugin kernel={undefined} />
            <ImagesPlugin />
            <HorizontalRulePlugin />
            <YouTubePlugin />
            <AutoEmbedPlugin />
            <CommentPlugin providerFactory={undefined} />
            {floatingAnchorElem && (
              <>
                <DraggableBlockPlugin anchorElem={floatingAnchorElem} />
                <CodeActionMenuPlugin anchorElem={floatingAnchorElem} />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Main Lexical editor component with Loro CRDT collaboration.
 * Wraps the editor in ToolbarContext and LexicalComposer.
 */
export function LexicalEditor({
  className = '',
  collaboration,
  onContentChange,
  showRuntimeSelector,
  runtimePodName,
  onRuntimeSelected,
}: LexicalEditorProps) {
  return (
    <div className={`lexical-editor-container ${className}`}>
      <LexicalComposer initialConfig={initialConfig}>
        <ToolbarContext>
          <div className="editor-shell">
            <LexicalEditorContainer
              collaboration={collaboration}
              onContentChange={onContentChange}
              showRuntimeSelector={showRuntimeSelector}
              runtimePodName={runtimePodName}
              onRuntimeSelected={onRuntimeSelected}
            />
          </div>
        </ToolbarContext>
      </LexicalComposer>
    </div>
  );
}

export default LexicalEditor;
