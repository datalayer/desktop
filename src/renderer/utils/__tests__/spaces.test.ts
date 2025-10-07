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
} from '../spaces';
import { DocumentItem } from '../../../shared/types';

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
      } as unknown as DocumentItem;

      const icon = getDocumentIcon(notebook as DocumentItem);
      expect(icon).toBe(BookIcon);
    });

    it('should return BookIcon for "Notebook" with capital N', () => {
      const notebook = {
        id: 'nb-2',
        name: 'Notebook 2',
        type: 'Notebook',
      } as unknown as DocumentItem;

      const icon = getDocumentIcon(notebook as DocumentItem);
      expect(icon).toBe(BookIcon);
    });

    it('should return BookIcon for "NOTEBOOK" all caps', () => {
      const notebook = {
        id: 'nb-3',
        name: 'Notebook 3',
        type: 'NOTEBOOK',
      } as unknown as DocumentItem;

      const icon = getDocumentIcon(notebook as DocumentItem);
      expect(icon).toBe(BookIcon);
    });

    it('should return FileIcon for document type', () => {
      const document = {
        id: 'doc-1',
        name: 'Document',
        type: 'document',
      } as unknown as DocumentItem;

      const icon = getDocumentIcon(document);
      expect(icon).toBe(FileIcon);
    });

    it('should return FileIcon for undefined type', () => {
      const document = {
        id: 'doc-2',
        name: 'Unknown',
      } as unknown as DocumentItem;

      const icon = getDocumentIcon(document);
      expect(icon).toBe(FileIcon);
    });

    it('should return FileIcon for empty type', () => {
      const document = {
        id: 'doc-3',
        name: 'Empty Type',
        type: '',
      } as unknown as DocumentItem;

      const icon = getDocumentIcon(document);
      expect(icon).toBe(FileIcon);
    });

    it('should return FileIcon for other types', () => {
      const document = {
        id: 'doc-4',
        name: 'Spreadsheet',
        type: 'spreadsheet',
      } as unknown as DocumentItem;

      const icon = getDocumentIcon(document);
      expect(icon).toBe(FileIcon);
    });
  });

  describe('createDataHash', () => {
    it('should create hash from document data', () => {
      const data = [
        {
          id: 'doc-1',
          name: 'Document 1',
          updatedAt: '2025-01-15',
        } as unknown as DocumentItem,
        {
          id: 'doc-2',
          name: 'Document 2',
          updatedAt: '2025-01-14',
        } as unknown as DocumentItem,
      ];

      const hash = createDataHash(data);
      expect(hash).toContain('doc-1');
      expect(hash).toContain('Document 1');
      expect(hash).toContain('2025-01-15');
    });

    it('should use uid when id not present', () => {
      const data = [
        {
          uid: 'uid-1',
          name: 'Doc',
          updatedAt: '2025-01-15',
        } as unknown as DocumentItem,
      ];

      const hash = createDataHash(data);
      expect(hash).toContain('uid-1');
    });

    it('should include updatedAt timestamp', () => {
      const data = [
        {
          id: 'doc-1',
          name: 'Doc',
          updatedAt: '2025-01-15T10:00:00Z',
        } as unknown as DocumentItem,
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
        {
          id: 'doc-1',
          name: 'Document 1',
          last_update_ts_dt: '2025-01-15',
        } as unknown as DocumentItem,
      ];

      const hash1 = createDataHash(data);
      const hash2 = createDataHash(data);

      expect(hash1).toBe(hash2);
    });

    it('should produce different hash for different data', () => {
      const data1 = [
        {
          id: 'doc-1',
          name: 'Doc 1',
          last_update_ts_dt: '2025-01-15',
        } as unknown as DocumentItem,
      ];
      const data2 = [
        {
          id: 'doc-2',
          name: 'Doc 2',
          last_update_ts_dt: '2025-01-15',
        } as unknown as DocumentItem,
      ];

      const hash1 = createDataHash(data1);
      const hash2 = createDataHash(data2);

      expect(hash1).not.toBe(hash2);
    });

    it('should handle mixed id/uid formats', () => {
      const data = [
        {
          id: 'doc-1',
          name: 'Doc 1',
          updatedAt: '2025-01-15',
        } as unknown as DocumentItem,
        {
          uid: 'uid-2',
          name: 'Doc 2',
          updatedAt: '2025-01-14',
        } as unknown as DocumentItem,
      ];

      const hash = createDataHash(data);
      expect(hash).toContain('doc-1');
      expect(hash).toContain('uid-2');
    });
  });

  describe('sortByModifiedDate', () => {
    it('should sort by name alphabetically (A-Z)', () => {
      const doc1 = {
        id: 'doc-1',
        name: 'Zebra',
      } as DocumentItem;

      const doc2 = {
        id: 'doc-2',
        name: 'Apple',
      } as DocumentItem;

      const result = sortByModifiedDate(doc1, doc2);
      expect(result).toBeGreaterThan(0); // Zebra > Apple alphabetically
    });

    it('should sort by name case-insensitively', () => {
      const doc1 = {
        id: 'doc-1',
        name: 'apple',
      } as DocumentItem;

      const doc2 = {
        id: 'doc-2',
        name: 'Banana',
      } as DocumentItem;

      const result = sortByModifiedDate(doc1, doc2);
      expect(result).toBeLessThan(0); // apple < Banana
    });

    it('should handle equal names', () => {
      const doc1 = {
        id: 'doc-1',
        name: 'Document',
      } as DocumentItem;

      const doc2 = {
        id: 'doc-2',
        name: 'Document',
      } as DocumentItem;

      const result = sortByModifiedDate(doc1, doc2);
      expect(result).toBe(0);
    });

    it('should handle empty names', () => {
      const doc1 = {
        id: 'doc-1',
        name: '',
      } as DocumentItem;

      const doc2 = {
        id: 'doc-2',
        name: 'Document',
      } as DocumentItem;

      const result = sortByModifiedDate(doc1, doc2);
      expect(result).toBeLessThan(0); // Empty string comes first
    });

    it('should sort array correctly (alphabetically)', () => {
      const docs: DocumentItem[] = [
        {
          id: '1',
          name: 'Zebra',
        } as unknown as DocumentItem,
        {
          id: '2',
          name: 'Apple',
        } as unknown as DocumentItem,
        {
          id: '3',
          name: 'Mango',
        } as unknown as DocumentItem,
      ];

      const sorted = docs.sort(sortByModifiedDate);

      expect(sorted[0].name).toBe('Apple');
      expect(sorted[1].name).toBe('Mango');
      expect(sorted[2].name).toBe('Zebra');
    });
  });

  describe('groupDocumentsByType', () => {
    it('should group notebooks and documents separately', () => {
      const items: DocumentItem[] = [
        {
          id: 'nb-1',
          name: 'Notebook 1',
          type: 'notebook',
        } as unknown as DocumentItem,
        {
          id: 'doc-1',
          name: 'Document 1',
          type: 'document',
        } as unknown as DocumentItem,
        {
          id: 'nb-2',
          name: 'Notebook 2',
          type: 'notebook',
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
        {
          id: 'nb-1',
          name: 'Notebook 1',
          type: 'notebook',
        } as unknown as DocumentItem,
        {
          id: 'nb-2',
          name: 'Notebook 2',
          type: 'notebook',
        } as unknown as DocumentItem,
      ];

      const grouped = groupDocumentsByType(items);

      expect(grouped.notebooks).toHaveLength(2);
      expect(grouped.documents).toHaveLength(0);
    });

    it('should handle all documents', () => {
      const items: DocumentItem[] = [
        {
          id: 'doc-1',
          name: 'Document 1',
          type: 'document',
        } as unknown as DocumentItem,
        {
          id: 'doc-2',
          name: 'Document 2',
          type: 'file',
        } as unknown as DocumentItem,
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

    it('should sort each group by name alphabetically', () => {
      const items: DocumentItem[] = [
        {
          id: 'nb-1',
          name: 'Zebra Notebook',
          type: 'notebook',
        } as unknown as DocumentItem,
        {
          id: 'nb-2',
          name: 'Apple Notebook',
          type: 'notebook',
        } as unknown as DocumentItem,
        {
          id: 'doc-1',
          name: 'Zebra Doc',
          type: 'document',
        } as unknown as DocumentItem,
        {
          id: 'doc-2',
          name: 'Apple Doc',
          type: 'document',
        } as unknown as DocumentItem,
      ];

      const grouped = groupDocumentsByType(items);

      expect(grouped.notebooks[0].name).toBe('Apple Notebook');
      expect(grouped.notebooks[1].name).toBe('Zebra Notebook');
      expect(grouped.documents[0].name).toBe('Apple Doc');
      expect(grouped.documents[1].name).toBe('Zebra Doc');
    });

    it('should handle case-insensitive notebook type', () => {
      const items: DocumentItem[] = [
        {
          id: 'nb-1',
          name: 'Notebook 1',
          type: 'NOTEBOOK',
        } as unknown as DocumentItem,
        {
          id: 'nb-2',
          name: 'Notebook 2',
          type: 'Notebook',
        } as unknown as DocumentItem,
        {
          id: 'nb-3',
          name: 'Notebook 3',
          type: 'notebook',
        } as unknown as DocumentItem,
      ];

      const grouped = groupDocumentsByType(items);

      expect(grouped.notebooks).toHaveLength(3);
      expect(grouped.documents).toHaveLength(0);
    });

    it('should treat undefined type as document', () => {
      const items: DocumentItem[] = [
        {
          id: 'doc-1',
          name: 'No Type',
        } as unknown as DocumentItem,
      ];

      const grouped = groupDocumentsByType(items);

      expect(grouped.notebooks).toHaveLength(0);
      expect(grouped.documents).toHaveLength(1);
    });

    it('should treat empty type as document', () => {
      const items: DocumentItem[] = [
        {
          id: 'doc-1',
          name: 'Empty Type',
          type: '',
        } as unknown as DocumentItem,
      ];

      const grouped = groupDocumentsByType(items);

      expect(grouped.notebooks).toHaveLength(0);
      expect(grouped.documents).toHaveLength(1);
    });
  });
});
