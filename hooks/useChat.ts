import { useState, useCallback } from 'react';
import { N8N_CHAT_URL, FIREBASE_CONFIG } from '../constants';
import type { ChatMessage, DocumentItem } from '../types';

interface UseChatReturn {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  sessionId: number;
  sendMessage: (query: string, document: DocumentItem, userId: string) => Promise<void>;
  resetChat: () => void;
  clearError: () => void;
}

// Parse n8n response into text
const parseChatResponse = (rawResult: unknown): string => {
  // Handle Array format: [ { output: "..." } ]
  if (Array.isArray(rawResult) && rawResult.length > 0) {
    const firstItem = rawResult[0];
    if (firstItem && typeof firstItem === 'object') {
      return firstItem.output || firstItem.text || firstItem.message || JSON.stringify(firstItem);
    }
    return String(firstItem);
  }

  // Handle Object format: { output: "..." }
  if (rawResult && typeof rawResult === 'object') {
    const obj = rawResult as Record<string, unknown>;
    return (obj.output as string) || (obj.text as string) || (obj.message as string) || JSON.stringify(rawResult);
  }

  // Handle direct string
  if (typeof rawResult === 'string') {
    return rawResult;
  }

  return 'No response from AI.';
};

export const useChat = (): UseChatReturn => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<number>(0);

  const clearError = useCallback(() => setError(null), []);

  const resetChat = useCallback(() => {
    setMessages([]);
    setSessionId(Date.now());
    setError(null);
  }, []);

  const sendMessage = useCallback(async (
    query: string, 
    document: DocumentItem, 
    userId: string
  ): Promise<void> => {
    if (!query.trim()) return;

    setIsLoading(true);
    setError(null);

    // Add user message
    const userMessage: ChatMessage = { sender: 'user', text: query };
    setMessages(prev => [...prev, userMessage]);

    // Add typing indicator
    const typingMessage: ChatMessage = { sender: 'bot', text: '...' };
    setMessages(prev => [...prev, typingMessage]);

    try {
      const payload = {
        query: query,
        sessionId: sessionId,
        fileName: document.storageId,
        docId: document.id,
        uid: userId,
        bucketName: FIREBASE_CONFIG.storageBucket
      };

      const response = await fetch(N8N_CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status}`);
      }

      const rawResult = await response.json();
      const responseText = parseChatResponse(rawResult);

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
  }, [sessionId]);

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
