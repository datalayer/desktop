/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Spaces page component for managing documents and notebooks.
 * Provides document browsing, space selection, and runtime management.
 *
 * @module renderer/pages/Spaces
 */

import React, { useState, useEffect, useRef } from 'react';
import { Box } from '@primer/react';
import { BookIcon, FileIcon } from '@primer/octicons-react';
import type { SpaceJSON, LexicalJSON } from '@datalayer/core/lib/client/models';
import {
  DocumentsListProps,
  SpaceInfo,
  GroupedDocuments,
  DocumentItem,
} from '../../shared/types';
import { useService } from '../contexts/ServiceContext';
import {
  groupDocumentsByType,
  createDataHash,
  getDocumentIcon,
} from '../utils/spaces';
import Header from '../components/spaces/Header';
import ErrorMessage from '../components/common/ErrorMessage';
import SpaceSection from '../components/spaces/SpaceSection';
import DeleteConfirmationDialog from '../components/spaces/DeleteConfirmationDialog';
import CreateDocumentDialog from '../components/spaces/CreateDocumentDialog';
import EditItemDialog from '../components/spaces/EditItemDialog';
import LexicalDocument from '../components/lexical/LexicalDocument';

/**
 * Documents library page component.
 * Manages the display and interaction with user documents and notebooks.
 *
 * @param props - Component props
 * @param props.onNotebookSelect - Callback invoked when a notebook is selected
 * @param props.onDocumentSelect - Callback invoked when a document is selected
 * @returns The documents library page component
 */
const Documents: React.FC<DocumentsListProps> = ({
  onNotebookSelect,
  onDocumentSelect,
  isAuthenticated = false,
}) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedNotebook, setSelectedNotebook] = useState<string | null>(null);
  const [selectedLexicalDocument, setSelectedLexicalDocument] =
    useState<LexicalJSON | null>(null);
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [warningMessage, _setWarningMessage] = useState<string | null>(null);

  const [userSpaces, setUserSpaces] = useState<SpaceInfo[]>([]);
  const [selectedSpace, setSelectedSpace] = useState<SpaceInfo | null>(null);
  const [groupedDocuments, setGroupedDocuments] = useState<GroupedDocuments>({
    notebooks: [],
    documents: [],
  });

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<DocumentItem | null>(null);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createDocumentType, setCreateDocumentType] = useState<
    'notebook' | 'lexical'
  >('notebook');

  const [showEditDialog, setShowEditDialog] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<DocumentItem | null>(null);

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastDataHash, setLastDataHash] = useState<string>('');

  // Track previous item counts for skeleton loading
  const [previousNotebookCount, setPreviousNotebookCount] = useState(0);
  const [previousDocumentCount, setPreviousDocumentCount] = useState(0);

  const runtimeService = useService('runtimeService');

  const isInitializedRef = useRef(false);
  const autoRefreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isInitializedRef.current && isAuthenticated) {
      isInitializedRef.current = true;
      initializeComponent();
    }

    return () => {
      if (autoRefreshTimerRef.current) {
        clearInterval(autoRefreshTimerRef.current);
      }
    };
  }, [isAuthenticated]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();

        if (showDeleteDialog && !isDeleting) {
          handleCancelDelete();
        }
        return;
      }

      if (
        !showDeleteDialog &&
        event.target &&
        !['INPUT', 'TEXTAREA'].includes((event.target as Element).tagName)
      ) {
        switch (event.key) {
          case 'r':
          case 'R':
            if (event.ctrlKey || event.metaKey) {
              event.preventDefault();
              handleManualRefresh();
            }
            break;
          case 'n':
          case 'N':
            if (event.ctrlKey || event.metaKey) {
              event.preventDefault();
              // Create new notebook shortcut activated
            }
            break;
          case 'F5':
            event.preventDefault();
            handleManualRefresh();
            break;
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [showDeleteDialog, isDeleting]);

  const fetchUserSpaces = async () => {
    try {
      const spacesData = await window.datalayerClient.getMySpaces();

      if (spacesData && spacesData.length > 0) {
        // Processing spaces (basic info only)
        const spaces: SpaceInfo[] = spacesData.map((space: SpaceJSON) => ({
          id: space.uid,
          uid: space.uid,
          name: space.name,
          handle: space.handle,
        }));

        setUserSpaces(spaces);

        const defaultSpace =
          spaces.find(space => {
            const name = (space.name || '').toLowerCase();
            const handle = (space.handle || '').toLowerCase();
            return (
              handle.includes('library') ||
              handle.includes('default') ||
              name.includes('library') ||
              name.includes('default') ||
              name.includes('workspace') ||
              spaces.length === 1
            );
          }) || spaces[0];

        setSelectedSpace(defaultSpace);
        if (defaultSpace.uid) {
          setSpaceId(defaultSpace.uid);
        }

        return { defaultSpace };
      }

      return null;
    } catch {
      setError('Failed to load user spaces');
      return null;
    }
  };

  const fetchSpaceItems = async (spaceId: string) => {
    try {
      const items = await window.datalayerClient.getSpaceItems(spaceId);
      // SDK returns NotebookJSON | LexicalJSON[] - use directly as DocumentItem
      return items || [];
    } catch {
      setError('Failed to load space items');
      return [];
    }
  };

  const initializeComponent = async () => {
    const result = await fetchUserSpaces();
    if (result?.defaultSpace) {
      const spaceId = result.defaultSpace.uid || result.defaultSpace.id;
      await processDocuments(spaceId);
      startAutoRefresh();
    } else {
      setLoading(false);
    }
  };

  const processDocuments = async (currentSpaceId: string) => {
    try {
      setLoading(true);
      setError(null);

      // Fetch items for this specific space
      const documentItems = await fetchSpaceItems(currentSpaceId);

      if (documentItems.length > 0) {
        const groupedResults = groupDocumentsByType(documentItems);

        // Update previous counts for skeleton loading
        setPreviousNotebookCount(groupedResults.notebooks.length);
        setPreviousDocumentCount(groupedResults.documents.length);

        setGroupedDocuments(groupedResults);

        const newDataHash = createDataHash(documentItems);
        setLastDataHash(newDataHash);
      } else {
        setGroupedDocuments({ notebooks: [], documents: [] });
        setLastDataHash('');
      }
    } catch {
      setError('Failed to load documents. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const fetchDocuments = async (currentSpaceId: string) => {
    try {
      await processDocuments(currentSpaceId);
    } catch {
      setError('Failed to load documents. Please try again.');
    }
  };

  const startAutoRefresh = () => {
    if (autoRefreshTimerRef.current) {
      clearInterval(autoRefreshTimerRef.current);
    }

    autoRefreshTimerRef.current = setInterval(async () => {
      if (selectedSpace && !loading && !isRefreshing) {
        await checkForUpdatesAndRefresh();
      }
    }, 60000);
  };

  const checkForUpdatesAndRefresh = async () => {
    if (!selectedSpace || !selectedSpace.uid) return;

    try {
      const spaceId = selectedSpace.uid;

      // Fetch current items for comparison
      const currentItems = await fetchSpaceItems(spaceId);
      const newDataHash = createDataHash(currentItems);

      if (newDataHash !== lastDataHash) {
        // Process the documents we already fetched
        const groupedResults = groupDocumentsByType(currentItems);

        setPreviousNotebookCount(groupedResults.notebooks.length);
        setPreviousDocumentCount(groupedResults.documents.length);
        setGroupedDocuments(groupedResults);
        setLastDataHash(newDataHash);
      } else {
      }
    } catch {}
  };

  const handleManualRefresh = async () => {
    if (!selectedSpace || !selectedSpace.uid || isRefreshing) return;

    setIsRefreshing(true);
    try {
      // Manual refresh triggered
      await fetchDocuments(selectedSpace.uid);
    } catch {
      // Manual refresh failed
      setError('Failed to refresh documents');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleSpaceChange = async (
    event: React.ChangeEvent<HTMLSelectElement>
  ) => {
    const selectedSpaceId = event.target.value;
    const space = userSpaces.find(s => s.uid === selectedSpaceId);

    if (space && space.uid) {
      setSelectedSpace(space);
      setSpaceId(space.uid);
      await fetchDocuments(space.uid);
    }
  };

  const handleOpenNotebook = (notebook: DocumentItem) => {
    // Opening notebook

    // Check if runtime service is ready
    if (runtimeService && runtimeService.state === 'ready') {
      const existingRuntime = runtimeService.getRuntimeForNotebook(notebook.id);
      if (existingRuntime) {
        // Reconnecting to existing runtime for notebook
      }
    }

    setSelectedNotebook(notebook.id);

    if (onNotebookSelect) {
      onNotebookSelect({
        id: notebook.uid,
        name: notebook.name,
        path: `/${notebook.name}`, // Generate path from name
        cdnUrl: notebook.cdnUrl,
        description: notebook.description,
      });
    }
  };

  const handleOpenDocument = (document: DocumentItem) => {
    // Opening document

    // Check if this is a Lexical document
    if (document.type.toLowerCase() === 'lexical') {
      // Open Lexical document directly in Desktop app
      setSelectedLexicalDocument(document as LexicalJSON);
      return;
    }

    // For other document types, use the callback
    setSelectedNotebook(document.id);

    if (onDocumentSelect) {
      onDocumentSelect({
        id: document.uid,
        name: document.name,
        path: `/${document.name}`, // Generate path from name
        cdnUrl: document.cdnUrl,
        description: document.description,
      });
    }
  };

  const handleDownloadItem = async (item: DocumentItem) => {
    // Downloading item

    if (!item.uid) {
      setError('Cannot download item - missing UID');
      return;
    }

    try {
      // Use SDK's getContent method with the item's uid
      const content = await window.datalayerClient.getContent(item.uid);

      if (!content) {
        throw new Error('No content received from API');
      }

      // Convert content to JSON string
      const contentString =
        typeof content === 'string'
          ? content
          : JSON.stringify(content, null, 2);

      // SDK must always provide extension
      let extension = item.extension;

      // Ensure extension starts with a dot
      if (extension && !extension.startsWith('.')) {
        extension = `.${extension}`;
      }

      // Create blob and download
      const blob = new Blob([contentString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = item.name.includes('.')
        ? item.name
        : `${item.name}${extension}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Item downloaded successfully
    } catch {
      // Failed to download item
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to download item';
      setError(errorMessage);
      setTimeout(() => setError(null), 5000);
    }
  };

  const handleDeleteItem = (item: DocumentItem) => {
    setItemToDelete(item);
    setDeleteConfirmationText('');
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (!itemToDelete || !spaceId) {
      setError('Unable to delete item - missing information');
      return;
    }

    if (deleteConfirmationText !== itemToDelete.name) {
      setError(
        'Item name does not match. Please type the exact name to confirm deletion.'
      );
      return;
    }

    try {
      setIsDeleting(true);
      setError(null);

      // Deleting item

      const itemUid = itemToDelete.uid || itemToDelete.id;
      if (!itemUid) {
        throw new Error('Item UID is missing');
      }

      await window.datalayerClient.deleteSpaceItem(spaceId, itemUid);

      // If we reach here, deletion was successful (no exception thrown)
      await fetchDocuments(spaceId);
      handleCancelDelete();
      // Item deleted successfully
    } catch {
      // Failed to delete item
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Failed to delete item. Please try again.';
      setError(errorMessage);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteDialog(false);
    setItemToDelete(null);
    setDeleteConfirmationText('');
    setError(null);
  };

  const handleCreateNotebook = () => {
    setCreateDocumentType('notebook');
    setShowCreateDialog(true);
  };

  const handleCreateLexical = () => {
    setCreateDocumentType('lexical');
    setShowCreateDialog(true);
  };

  const handleCreateDocument = async (name: string, description: string) => {
    if (!spaceId) {
      throw new Error('No space selected');
    }

    if (createDocumentType === 'notebook') {
      await window.datalayerClient.createNotebook(spaceId, name, description);
    } else {
      await window.datalayerClient.createLexical(spaceId, name, description);
    }

    // Refresh the space items to show the new document
    await fetchDocuments(spaceId);
  };

  const handleEditItem = (item: DocumentItem) => {
    setItemToEdit(item);
    setShowEditDialog(true);
  };

  const handleUpdateItem = async (
    uid: string,
    name: string,
    description: string
  ) => {
    if (!spaceId) {
      throw new Error('No space selected');
    }

    const itemType = itemToEdit?.type?.toLowerCase();
    if (itemType === 'notebook') {
      await window.datalayerClient.updateNotebook(uid, name, description);
    } else {
      await window.datalayerClient.updateLexical(uid, name, description);
    }

    // Refresh the space items to show the updated document
    await fetchDocuments(spaceId);
    setShowEditDialog(false);
    setItemToEdit(null);
  };

  // If a Lexical document is selected, show it in full screen
  if (selectedLexicalDocument) {
    return (
      <LexicalDocument
        document={selectedLexicalDocument}
        onClose={() => setSelectedLexicalDocument(null)}
      />
    );
  }

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        p: 3,
      }}
    >
      {/* Fixed header */}
      <Box sx={{ flexShrink: 0 }}>
        <Header
          selectedSpace={selectedSpace}
          userSpaces={userSpaces}
          loading={loading}
          isRefreshing={isRefreshing}
          onSpaceChange={handleSpaceChange}
          onRefresh={handleManualRefresh}
        />

        <ErrorMessage
          error={error || undefined}
          warning={warningMessage || undefined}
        />
      </Box>

      {/* Scrollable content area */}
      <Box sx={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', pr: 1 }}>
        <SpaceSection
          title="Notebooks"
          icon={BookIcon as React.ComponentType<{ size?: number }>}
          items={groupedDocuments.notebooks}
          loading={loading}
          selectedItemId={selectedNotebook}
          emptyMessage="No notebooks yet"
          onItemOpen={handleOpenNotebook}
          onItemEdit={handleEditItem}
          onItemDownload={handleDownloadItem}
          onItemDelete={handleDeleteItem}
          previousItemCount={previousNotebookCount}
          onCreateNew={handleCreateNotebook}
          createButtonLabel="New Notebook"
        />

        <SpaceSection
          title="Lexicals"
          icon={FileIcon as React.ComponentType<{ size?: number }>}
          items={groupedDocuments.documents}
          loading={loading}
          selectedItemId={selectedNotebook}
          emptyMessage="No lexicals yet"
          onItemOpen={handleOpenDocument}
          onItemEdit={handleEditItem}
          onItemDownload={handleDownloadItem}
          onItemDelete={handleDeleteItem}
          getItemIcon={getDocumentIcon}
          previousItemCount={previousDocumentCount}
          onCreateNew={handleCreateLexical}
          createButtonLabel="New Lexical"
        />
      </Box>

      {/* Dialogs - outside scrollable area */}
      <DeleteConfirmationDialog
        isOpen={showDeleteDialog}
        item={itemToDelete}
        confirmationText={deleteConfirmationText}
        isDeleting={isDeleting}
        error={error}
        onConfirmationTextChange={setDeleteConfirmationText}
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />

      <CreateDocumentDialog
        isOpen={showCreateDialog}
        type={createDocumentType}
        onClose={() => setShowCreateDialog(false)}
        onCreate={handleCreateDocument}
      />

      <EditItemDialog
        isOpen={showEditDialog}
        item={itemToEdit}
        onClose={() => {
          setShowEditDialog(false);
          setItemToEdit(null);
        }}
        onUpdate={handleUpdateItem}
      />
    </Box>
  );
};

export default Documents;
