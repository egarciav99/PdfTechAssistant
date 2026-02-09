import { describe, it, expect } from 'vitest';
import type { ChatMessage, DocumentItem, SummaryData, ResumenDocument } from '../types';

describe('TypeScript Types', () => {
  describe('ChatMessage', () => {
    it('should accept valid chat message', () => {
      const message: ChatMessage = {
        sender: 'user',
        text: 'Hello world'
      };
      expect(message.sender).toBe('user');
      expect(message.text).toBe('Hello world');
    });

    it('should accept bot message', () => {
      const message: ChatMessage = {
        sender: 'bot',
        text: '<p>Response</p>'
      };
      expect(message.sender).toBe('bot');
    });
  });

  describe('DocumentItem', () => {
    it('should accept valid document item', () => {
      const doc: DocumentItem = {
        id: '01',
        nombreDocumento: 'test.pdf',
        storageId: 'user123_test.pdf',
        createdAt: Date.now()
      };
      expect(doc.id).toBe('01');
      expect(doc.nombreDocumento).toBe('test.pdf');
    });

    it('should accept document with optional summary', () => {
      const doc: DocumentItem = {
        id: '02',
        nombreDocumento: 'test2.pdf',
        storageId: 'user123_test2.pdf',
        createdAt: Date.now(),
        resumen: 'Test summary'
      };
      expect(doc.resumen).toBe('Test summary');
    });
  });

  describe('SummaryData', () => {
    it('should accept key-value pairs', () => {
      const summary: SummaryData = {
        'Overview': 'Document overview text',
        'Technical Details': '<p>HTML content</p>'
      };
      expect(Object.keys(summary)).toHaveLength(2);
    });
  });

  describe('ResumenDocument', () => {
    it('should accept valid resumen document', () => {
      const resumen: ResumenDocument = {
        uid: 'user123',
        Id_documento: '01',
        fileName: 'test.pdf',
        resumen: 'Document summary'
      };
      expect(resumen.uid).toBe('user123');
      expect(resumen.Id_documento).toBe('01');
    });
  });
});
