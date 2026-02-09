import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock environment variables before importing hooks
vi.mock('../../constants', () => ({
  N8N_CHAT_URL: 'https://test.n8n.com/webhook/chat',
  N8N_INGESTION_URL: 'https://test.n8n.com/webhook/ingestion',
  FIREBASE_CONFIG: {
    apiKey: 'test-api-key',
    authDomain: 'test.firebaseapp.com',
    projectId: 'test-project',
    storageBucket: 'test.appspot.com',
    messagingSenderId: '123456',
    appId: 'test-app-id',
    measurementId: 'test-measurement'
  }
}));

import { renderHook, act } from '@testing-library/react';
import { useChat } from '../../hooks/useChat';

// Mock fetch
global.fetch = vi.fn();

describe('useChat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize with empty messages', () => {
    const { result } = renderHook(() => useChat());
    expect(result.current.messages).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('should reset chat correctly', () => {
    const { result } = renderHook(() => useChat());
    
    act(() => {
      result.current.resetChat();
    });

    expect(result.current.messages).toEqual([]);
    expect(result.current.error).toBeNull();
    expect(result.current.sessionId).toBeGreaterThan(0);
  });

  it('should clear error', () => {
    const { result } = renderHook(() => useChat());
    
    act(() => {
      result.current.clearError();
    });

    expect(result.current.error).toBeNull();
  });

  it('should not send empty messages', async () => {
    const { result } = renderHook(() => useChat());
    
    await act(async () => {
      await result.current.sendMessage('', {
        id: '01',
        nombreDocumento: 'test.pdf',
        storageId: 'test.pdf',
        createdAt: Date.now()
      }, 'user123');
    });

    expect(result.current.messages).toEqual([]);
  });
});
