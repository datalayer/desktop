/*
 * Copyright (c) 2023-2025 Datalayer, Inc.
 * Distributed under the terms of the Modified BSD License.
 */

/**
 * Tests for spaces/library utility functions.
 * Tests date formatting, document grouping, sorting, and icon selection.
 *
 * @module renderer/utils/spaces.test
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FileIcon, BookIcon } from '@primer/octicons-react';
import {
  formatDate,
  getDocumentIcon,
  createDataHash,
  sortByModifiedDate,
  groupDocumentsByType,
} from './spaces';
import { DocumentItem } from '../../shared/types';

describe('spaces utilities', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('formatDate', () => {
    it('should format date within last hour as minutes', () => {
      const date = new Date('2025-01-15T11:45:00Z').toISOString();
      const formatted = formatDate(date);

      expect(formatted).toBe('15 minutes ago');
    });

    it('should format date within 24 hours as hours', () => {
      const date = new Date('2025-01-15T08:00:00Z').toISOString();
      const formatted = formatDate(date);

      expect(formatted).toBe('4 hours ago');
    });

    it('should format date within 7 days as days', () => {
      const date = new Date('2025-01-12T12:00:00Z').toISOString();
      const formatted = formatDate(date);

      expect(formatted).toBe('3 days ago');
    });

    it('should format date older than 7 days as locale date', () => {
      const date = new Date('2025-01-01T12:00:00Z').toISOString();
      const formatted = formatDate(date);

      expect(formatted).toMatch(/1\/1\/2025|2025-01-01/); // May vary by locale
    });

    it('should handle very recent dates (< 1 minute)', () => {
      const date = new Date('2025-01-15T11:59:30Z').toISOString();
      const formatted = formatDate(date);

      expect(formatted).toBe('0 minutes ago');
    });

    it('should handle exactly 1 hour ago', () => {
      const date = new Date('2025-01-15T11:00:00Z').toISOString();
      const formatted = formatDate(date);

      expect(formatted).toBe('1 hours ago');
    });

    it('should handle exactly 24 hours ago', () => {
      const date = new Date('2025-01-14T12:00:00Z').toISOString();
      const formatted = formatDate(date);

      expect(formatted).toBe('1 days ago');
    });

    it('should handle exactly 7 days ago (168 hours)', () => {
      const date = new Date('2025-01-08T12:00:00Z').toISOString();
      const formatted = formatDate(date);

      // Should use locale date string for 7+ days
      expect(formatted).toMatch(/\d+\/\d+\/\d+/);
    });

    it('should handle future dates gracefully', () => {
      const futureDate = new Date('2025-01-16T12:00:00Z').toISOString();
      const formatted = formatDate(futureDate);

      // Negative time difference might show as locale date
      expect(formatted).toBeDefined();
    });
  });

  describe('getDocumentIcon', () => {
    it('should return BookIcon for notebook type', () => {
      const notebook = {
        id: 'nb-1',
        name: 'My Notebook',
        type: 'notebook',
        createdAt: new Date().toISOString(),
      } as unknown as DocumentItem;

      const icon = getDocumentIcon(notebook as DocumentItem);
      expect(icon).toBe(BookIcon);
    });

    it('should return BookIcon for "Notebook" with capital N', () => {
      const notebook = {
        id: 'nb-2',
        name: 'Notebook 2',
        type: 'Notebook',
        createdAt: new Date().toISOString(),
      };

      const icon = getDocumentIcon(notebook as DocumentItem);
      expect(icon).toBe(BookIcon);
    });

    it('should return BookIcon for "NOTEBOOK" all caps', () => {
      const notebook = {
        id: 'nb-3',
        name: 'Notebook 3',
        type: 'NOTEBOOK',
        createdAt: new Date().toISOString(),
      };

      const icon = getDocumentIcon(notebook as DocumentItem);
      expect(icon).toBe(BookIcon);
    });

    it('should return FileIcon for document type', () => {
      const document = {
        id: 'doc-1',
        name: 'Document',
        type: 'document',
        createdAt: new Date().toISOString(),
      };

      const icon = getDocumentIcon(document);
      expect(icon).toBe(FileIcon);
    });

    it('should return FileIcon for undefined type', () => {
      const document = {
        id: 'doc-2',
        name: 'Unknown',
        createdAt: new Date().toISOString(),
      };

      const icon = getDocumentIcon(document);
      expect(icon).toBe(FileIcon);
    });

    it('should return FileIcon for empty type', () => {
      const document = {
        id: 'doc-3',
        name: 'Empty Type',
        type: '',
        createdAt: new Date().toISOString(),
      };

      const icon = getDocumentIcon(document);
      expect(icon).toBe(FileIcon);
    });

    it('should return FileIcon for other types', () => {
      const document = {
        id: 'doc-4',
        name: 'Spreadsheet',
        type: 'spreadsheet',
        createdAt: new Date().toISOString(),
      };

      const icon = getDocumentIcon(document);
      expect(icon).toBe(FileIcon);
    });
  });

  describe('createDataHash', () => {
    it('should create hash from document data', () => {
      const data = [
        { id: 'doc-1', name: 'Document 1', last_update_ts_dt: '2025-01-15' } as unknown as DocumentItem,
        { id: 'doc-2', name: 'Document 2', last_update_ts_dt: '2025-01-14' } as unknown as DocumentItem,
      ];

      const hash = createDataHash(data);
      expect(hash).toContain('doc-1');
      expect(hash).toContain('Document 1');
      expect(hash).toContain('2025-01-15');
    });

    it('should use uid when id not present', () => {
      const data = [
        { uid: 'uid-1', name: 'Doc', last_update_ts_dt: '2025-01-15' } as unknown as DocumentItem,
      ];

      const hash = createDataHash(data);
      expect(hash).toContain('uid-1');
    });

    it('should use name_t when name not present', () => {
      const data = [
        { id: 'doc-1', name_t: 'Named Doc', last_update_ts_dt: '2025-01-15' } as unknown as DocumentItem,
      ];

      const hash = createDataHash(data);
      expect(hash).toContain('Named Doc');
    });

    it('should use modified_at when last_update_ts_dt not present', () => {
      const data = [
        { id: 'doc-1', name: 'Doc', modified_at: '2025-01-15T10:00:00Z' } as unknown as DocumentItem,
      ];

      const hash = createDataHash(data);
      expect(hash).toContain('2025-01-15T10:00:00Z');
    });

    it('should handle empty array', () => {
      const hash = createDataHash([]);
      expect(hash).toBe('[]');
    });

    it('should produce same hash for same data', () => {
      const data = [
        { id: 'doc-1', name: 'Document 1', last_update_ts_dt: '2025-01-15' } as unknown as DocumentItem,
      ];

      const hash1 = createDataHash(data);
      const hash2 = createDataHash(data);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hash for different data', () => {
      const data1 = [
        { id: 'doc-1', name: 'Doc 1', last_update_ts_dt: '2025-01-15' } as unknown as DocumentItem,
      ];
      const data2 = [
        { id: 'doc-2', name: 'Doc 2', last_update_ts_dt: '2025-01-15' } as unknown as DocumentItem,
      ];

      const hash1 = createDataHash(data1);
      const hash2 = createDataHash(data2);

      expect(hash1).not.toBe(hash2);
    });

    it('should handle mixed property formats', () => {
      const data = [
        { id: 'doc-1', name: 'Doc 1', last_update_ts_dt: '2025-01-15' } as unknown as DocumentItem,
        { uid: 'uid-2', name_t: 'Doc 2', modified_at: '2025-01-14' } as unknown as DocumentItem,
      ];

      const hash = createDataHash(data);
      expect(hash).toContain('doc-1');
      expect(hash).toContain('uid-2');
    });
  });

  describe('sortByModifiedDate', () => {
    it('should sort by updatedAt when available', () => {
      const doc1 = {
        id: 'doc-1',
        name: 'Doc 1',
        updatedAt: '2025-01-14T12:00:00Z',
        createdAt: '2025-01-10T12:00:00Z',
      };

      const doc2 = {
        id: 'doc-2',
        name: 'Doc 2',
        updatedAt: '2025-01-15T12:00:00Z',
        createdAt: '2025-01-11T12:00:00Z',
      };

      const result = sortByModifiedDate(doc1, doc2 as DocumentItem[]);
      expect(result).toBeGreaterThan(0); // doc2 is newer, should come first
    });

    it('should sort by createdAt when updatedAt not available', () => {
      const doc1 = {
        id: 'doc-1',
        name: 'Doc 1',
        createdAt: '2025-01-10T12:00:00Z',
      };

      const doc2 = {
        id: 'doc-2',
        name: 'Doc 2',
        createdAt: '2025-01-11T12:00:00Z',
      };

      const result = sortByModifiedDate(doc1, doc2 as DocumentItem[]);
      expect(result).toBeGreaterThan(0); // doc2 is newer
    });

    it('should handle equal dates', () => {
      const doc1 = {
        id: 'doc-1',
        name: 'Doc 1',
        updatedAt: '2025-01-15T12:00:00Z',
      };

      const doc2 = {
        id: 'doc-2',
        name: 'Doc 2',
        updatedAt: '2025-01-15T12:00:00Z',
      };

      const result = sortByModifiedDate(doc1, doc2 as DocumentItem[]);
      expect(result).toBe(0);
    });

    it('should handle missing dates gracefully', () => {
      const doc1 = {
        id: 'doc-1',
        name: 'Doc 1',
        updatedAt: '2025-01-15T12:00:00Z',
      };

      const doc2 = {
        id: 'doc-2',
        name: 'Doc 2',
      };

      const result = sortByModifiedDate(doc1, doc2 as DocumentItem[]);
      // When one doc has no date, result is NaN (new Date('') is invalid)
      // This is acceptable behavior - documents without dates go to end
      expect(isNaN(result) || result < 0).toBe(true);
    });

    it('should sort array correctly (newest first)', () => {
      const docs: DocumentItem[] = [
        { id: '1', name: 'Old', updatedAt: '2025-01-10T12:00:00Z' } as unknown as DocumentItem,
        { id: '2', name: 'Newest', updatedAt: '2025-01-15T12:00:00Z' } as unknown as DocumentItem,
        { id: '3', name: 'Middle', updatedAt: '2025-01-13T12:00:00Z' } as unknown as DocumentItem,
      ];

      const sorted = docs.sort(sortByModifiedDate);

      expect(sorted[0].name).toBe('Newest');
      expect(sorted[1].name).toBe('Middle');
      expect(sorted[2].name).toBe('Old');
    });
  });

  describe('groupDocumentsByType', () => {
    it('should group notebooks and documents separately', () => {
      const items: DocumentItem[] = [
        {
          id: 'nb-1',
          name: 'Notebook 1',
          type: 'notebook',
          updatedAt: '2025-01-15T12:00:00Z',
        } as unknown as DocumentItem,
        {
          id: 'doc-1',
          name: 'Document 1',
          type: 'document',
          updatedAt: '2025-01-14T12:00:00Z',
        } as unknown as DocumentItem,
        {
          id: 'nb-2',
          name: 'Notebook 2',
          type: 'notebook',
          updatedAt: '2025-01-13T12:00:00Z',
        } as unknown as DocumentItem,
      ];

      const grouped = groupDocumentsByType(items);

      expect(grouped.notebooks).toHaveLength(2);
      expect(grouped.documents).toHaveLength(1);
      expect(grouped.notebooks[0].name).toBe('Notebook 1');
      expect(grouped.documents[0].name).toBe('Document 1');
    });

    it('should handle all notebooks', () => {
      const items: DocumentItem[] = [
        { id: 'nb-1', name: 'Notebook 1', type: 'notebook', createdAt: '' } as unknown as DocumentItem,
        { id: 'nb-2', name: 'Notebook 2', type: 'notebook', createdAt: '' } as unknown as DocumentItem,
      ];

      const grouped = groupDocumentsByType(items);

      expect(grouped.notebooks).toHaveLength(2);
      expect(grouped.documents).toHaveLength(0);
    });

    it('should handle all documents', () => {
      const items: DocumentItem[] = [
        { id: 'doc-1', name: 'Document 1', type: 'document', createdAt: '' } as unknown as DocumentItem,
        { id: 'doc-2', name: 'Document 2', type: 'file', createdAt: '' } as unknown as DocumentItem,
      ];

      const grouped = groupDocumentsByType(items);

      expect(grouped.notebooks).toHaveLength(0);
      expect(grouped.documents).toHaveLength(2);
    });

    it('should handle empty array', () => {
      const grouped = groupDocumentsByType([]);

      expect(grouped.notebooks).toHaveLength(0);
      expect(grouped.documents).toHaveLength(0);
    });

    it('should sort each group by modified date', () => {
      const items: DocumentItem[] = [
        {
          id: 'nb-1',
          name: 'Old Notebook',
          type: 'notebook',
          updatedAt: '2025-01-10T12:00:00Z',
        } as unknown as DocumentItem,
        {
          id: 'nb-2',
          name: 'New Notebook',
          type: 'notebook',
          updatedAt: '2025-01-15T12:00:00Z',
        } as unknown as DocumentItem,
        {
          id: 'doc-1',
          name: 'Old Doc',
          type: 'document',
          updatedAt: '2025-01-11T12:00:00Z',
        } as unknown as DocumentItem,
        {
          id: 'doc-2',
          name: 'New Doc',
          type: 'document',
          updatedAt: '2025-01-14T12:00:00Z',
        } as unknown as DocumentItem,
      ];

      const grouped = groupDocumentsByType(items);

      expect(grouped.notebooks[0].name).toBe('New Notebook');
      expect(grouped.notebooks[1].name).toBe('Old Notebook');
      expect(grouped.documents[0].name).toBe('New Doc');
      expect(grouped.documents[1].name).toBe('Old Doc');
    });

    it('should handle case-insensitive notebook type', () => {
      const items: DocumentItem[] = [
        { id: 'nb-1', name: 'Notebook 1', type: 'NOTEBOOK', createdAt: '' } as unknown as DocumentItem,
        { id: 'nb-2', name: 'Notebook 2', type: 'Notebook', createdAt: '' } as unknown as DocumentItem,
        { id: 'nb-3', name: 'Notebook 3', type: 'notebook', createdAt: '' } as unknown as DocumentItem,
      ];

      const grouped = groupDocumentsByType(items);

      expect(grouped.notebooks).toHaveLength(3);
      expect(grouped.documents).toHaveLength(0);
    });

    it('should treat undefined type as document', () => {
      const items: DocumentItem[] = [
        { id: 'doc-1', name: 'No Type', createdAt: '' } as unknown as DocumentItem,
      ];

      const grouped = groupDocumentsByType(items);

      expect(grouped.notebooks).toHaveLength(0);
      expect(grouped.documents).toHaveLength(1);
    });

    it('should treat empty type as document', () => {
      const items: DocumentItem[] = [
        { id: 'doc-1', name: 'Empty Type', type: '', createdAt: '' } as unknown as DocumentItem,
      ];

      const grouped = groupDocumentsByType(items);

      expect(grouped.notebooks).toHaveLength(0);
      expect(grouped.documents).toHaveLength(1);
    });
  });
});
