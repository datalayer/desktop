/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Utility functions for document library operations and formatting.
 *
 * @module renderer/utils/library
 */

import { FileIcon, BookIcon } from '@primer/octicons-react';
import { DocumentItem } from '../../shared/types';

/**
 * Format date as relative time string.
 * @param dateString - ISO date string
 * @returns Formatted relative time
 */
export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffHours < 1) {
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    return `${diffMinutes} minutes ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hours ago`;
  } else if (diffHours < 168) {
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString();
  }
};

/**
 * Get icon component for document type.
 * @param document - Document item
 * @returns Icon component
 */
export const getDocumentIcon = (
  document: DocumentItem
): React.ComponentType<{ size?: number }> => {
  if (document.type.toLowerCase() === 'notebook') {
    return BookIcon as unknown as React.ComponentType<{ size?: number }>;
  }
  return FileIcon as unknown as React.ComponentType<{ size?: number }>;
};

/**
 * Create hash string from document data for change detection.
 * @param data - Array of document items
 * @returns JSON hash string
 */
export const createDataHash = (data: DocumentItem[]): string => {
  return JSON.stringify(
    data.map(item => ({
      id: item.uid,
      name: item.name,
    }))
  );
};

/**
 * Sort documents by name (alphabetical).
 * @param a - First document
 * @param b - Second document
 * @returns Sort comparison result
 */
export const sortByModifiedDate = (
  a: DocumentItem,
  b: DocumentItem
): number => {
  // Note: updatedAt and createdAt were removed from NotebookJSON interface
  // Sorting by name instead
  return a.name.localeCompare(b.name);
};

/**
 * Group documents by type (notebooks and documents).
 * @param documentItems - Array of document items
 * @returns Object with notebooks and documents arrays
 */
export const groupDocumentsByType = (documentItems: DocumentItem[]) => {
  const notebooks = documentItems.filter(item => {
    return item.type.toLowerCase() === 'notebook';
  });

  const documents = documentItems.filter(item => {
    return item.type.toLowerCase() !== 'notebook'; // Everything else is a document
  });

  return {
    notebooks: notebooks.sort(sortByModifiedDate),
    documents: documents.sort(sortByModifiedDate),
  };
};
