import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import type { ChatMessage, DocumentItem } from '../types';

interface UseChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  sessionId: string;
  sendMessage: (text: string, document: DocumentItem, userId: string) => Promise<void>;
  resetChat: () => void;
  clearError: () => void;
}

const CHAT_SESSION_STORAGE_PREFIX = 'pdftechassistant.chatSession';

const createSessionId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const buildConversationStorageKey = (userId: string | null, documentId: string | null): string | null => {
  if (!userId || !documentId) {
    return null;
  }

  return `${CHAT_SESSION_STORAGE_PREFIX}:${userId}:${documentId}`;
};

const parseChatResponse = (rawResult: unknown): string => {
  if (Array.isArray(rawResult) && rawResult.length > 0) {
    const firstItem = rawResult[0];
    if (firstItem && typeof firstItem === 'object') {
      return (firstItem as any).output || (firstItem as any).text || (firstItem as any).message || JSON.stringify(firstItem);
    }
    return String(firstItem);
  }

  if (rawResult && typeof rawResult === 'object') {
    const obj = rawResult as Record<string, unknown>;
    return (obj.output as string) || (obj.text as string) || (obj.message as string) || JSON.stringify(rawResult);
  }

  if (typeof rawResult === 'string') {
    return rawResult;
  }

  return 'No response from AI.';
};

export const useChat = (userId: string | null = null, documentId: string | null = null): UseChatReturn => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>(() => createSessionId());

  const lastMessageTimeRef = useRef<number>(0);
  const activeStorageKeyRef = useRef<string | null>(null);

  useEffect(() => {
    setMessages([]);
    setError(null);

    const storageKey = buildConversationStorageKey(userId, documentId);
    activeStorageKeyRef.current = storageKey;

    if (!storageKey || typeof window === 'undefined') {
      setSessionId(createSessionId());
      return;
    }

    const storedSessionId = window.localStorage.getItem(storageKey);
    if (storedSessionId) {
      setSessionId(storedSessionId);
      return;
    }

    const newSessionId = `${userId}:${documentId}:${createSessionId()}`;
    window.localStorage.setItem(storageKey, newSessionId);
    setSessionId(newSessionId);
  }, [userId, documentId]);

  const clearError = useCallback(() => setError(null), []);

  const resetChat = useCallback(() => {
    setMessages([]);
    setError(null);

    const storageKey = activeStorageKeyRef.current;
    const newSessionId = createSessionId();

    if (storageKey && typeof window !== 'undefined') {
      window.localStorage.setItem(storageKey, newSessionId);
    }

    setSessionId(newSessionId);
  }, []);

  const ensureSessionId = useCallback((conversationUserId: string, conversationDocumentId: string) => {
    const storageKey = buildConversationStorageKey(conversationUserId, conversationDocumentId);

    if (!storageKey || typeof window === 'undefined') {
      const transientSessionId = `${conversationUserId}:${conversationDocumentId}:${createSessionId()}`;
      setSessionId(transientSessionId);
      return transientSessionId;
    }

    activeStorageKeyRef.current = storageKey;

    const storedSessionId = window.localStorage.getItem(storageKey);
    if (storedSessionId) {
      setSessionId(storedSessionId);
      return storedSessionId;
    }

    const newSessionId = `${conversationUserId}:${conversationDocumentId}:${createSessionId()}`;
    window.localStorage.setItem(storageKey, newSessionId);
    setSessionId(newSessionId);
    return newSessionId;
  }, []);

  const sendMessage = useCallback(async (
    text: string, 
    document: DocumentItem,
    userId: string
  ): Promise<void> => {
    if (!text.trim() || !userId || !document) return;

    const now = Date.now();
    if (now - lastMessageTimeRef.current < 3000) {
      setError("Please wait a few seconds before sending another message.");
      return;
    }
    lastMessageTimeRef.current = now;

    setIsLoading(true);
    setError(null);

    const conversationSessionId = ensureSessionId(userId, document.id);

    const userMessage: ChatMessage = { sender: 'user', text: text };
    setMessages(prev => [...prev, userMessage]);

    const typingMessage: ChatMessage = { sender: 'bot', text: '...' };
    setMessages(prev => [...prev, typingMessage]);

    try {
      const payload = {
        query: text,
        sessionId: conversationSessionId,
        documentId: document.id,
      };

      const { data, error } = await supabase.functions.invoke('chat-with-document', {
        body: payload,
      });
      if (error) throw error;
      
      const responseText = parseChatResponse(data);

      const botResponse: ChatMessage = { sender: 'bot', text: responseText };
      setMessages(prev => [...prev.slice(0, -1), botResponse]);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      
      const errorResponse: ChatMessage = { 
        sender: 'bot', 
        text: `Sorry, I encountered an error: ${errorMessage}. Please try again.` 
      };
      setMessages(prev => [...prev.slice(0, -1), errorResponse]);
    } finally {
      setIsLoading(false);
    }
  }, [ensureSessionId]);

  return {
    messages,
    isLoading,
    error,
    sessionId,
    sendMessage,
    resetChat,
    clearError
  };
};

export default useChat;
