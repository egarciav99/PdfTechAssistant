import { describe, it, expect, vi, beforeEach } from 'vitest';

// Sin backend: se simula el servicio de Supabase.
vi.mock('../../services/supabase', () => ({
  supabase: () => ({ functions: { invoke: vi.fn() } }),
  getChatHistory: vi.fn().mockResolvedValue([]),
  functionErrorBody: vi.fn().mockResolvedValue(null),
}));

import { renderHook, act } from '@testing-library/react';
import { useChat } from '../../hooks/useChat';

// Mock fetch
globalThis.fetch = vi.fn();

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
    expect(result.current.sessionId).toContain('-');
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
