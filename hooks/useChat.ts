import { useState, useCallback, useRef } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../services/firebase';
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

export const useChat = (): UseChatReturn => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState<string>(Date.now().toString());

  const lastMessageTimeRef = useRef<number>(0);

  const clearError = useCallback(() => setError(null), []);

  const resetChat = useCallback(() => {
    setMessages([]);
    setSessionId(Date.now().toString());
    setError(null);
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

    const userMessage: ChatMessage = { sender: 'user', text: text };
    setMessages(prev => [...prev, userMessage]);

    const typingMessage: ChatMessage = { sender: 'bot', text: '...' };
    setMessages(prev => [...prev, typingMessage]);

    try {
      const payload = {
        query: text,
        sessionId: sessionId,
        fileName: document.storageId,
        docId: document.id,
        uid: userId,
      };

      const chatWithDocument = httpsCallable(functions, 'chatWithDocument', { timeout: 30000 });
      const response = await chatWithDocument(payload);
      
      const responseText = parseChatResponse(response.data);

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
