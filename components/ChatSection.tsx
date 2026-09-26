
import React, { useState, useRef, useEffect } from 'react';
import DOMPurify from 'dompurify';
import { useTranslation } from 'react-i18next';
import type { ChatMessage } from '../types';
import { SendIcon, UserIcon, BotIcon } from './IconComponents';

interface ChatSectionProps {
  documentId: string;
  messages: ChatMessage[];
  onSendMessage: (query: string) => void;
  onNewChat?: () => void;
  isLoading?: boolean;
}

const ChatSection: React.FC<ChatSectionProps> = ({ documentId, messages, onSendMessage, onNewChat, isLoading = false }) => {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSendMessage(query);
      setQuery('');
    }
  };

  return (
    <div className="mt-4 sm:mt-6 border-t border-gray-200 pt-4 sm:pt-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800">{t('chat.title')}</h2>
        {onNewChat && (
          <button type="button" onClick={onNewChat} className="text-xs font-semibold text-blue-700 hover:underline">{t('chat.newChat')}</button>
        )}
      </div>
      <p className="text-xs text-gray-400 mb-2">{t('chat.private')}</p>
      <div className="bg-gray-50 p-2 sm:p-4 rounded-lg shadow-inner h-[60vh] sm:h-96 flex flex-col border border-gray-200">
        <div ref={chatContainerRef} id="chat-messages" aria-live="polite" className="flex-grow space-y-3 sm:space-y-4 overflow-y-auto px-1 sm:pr-2 scrollbar-thin scrollbar-thumb-gray-300">
          {messages.map((msg, index) => (
            <div key={index} data-sender={msg.sender} className={`flex items-start gap-2 sm:gap-3 ${msg.sender === 'user' ? 'justify-end' : ''}`}>
              {msg.sender === 'bot' && (
                 <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0 mt-1">
                  <BotIcon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                 </div>
              )}
              <div className={`max-w-[85%] sm:max-w-md p-2 sm:p-3 rounded-lg text-sm sm:text-base ${msg.sender === 'user' ? 'bg-blue-600 text-white' : 'bg-white text-gray-800 shadow-sm overflow-hidden'}`}>
                {msg.sender === 'bot' ? (
                    /* Render HTML safely for bot messages */
                    <div 
                        className="prose prose-sm max-w-none break-words"
                        dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(msg.text) }}
                    />
                ) : (
                    <p className="break-words">{msg.text}</p>
                )}
              </div>
               {msg.sender === 'user' && (
                 <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0 mt-1">
                  <UserIcon className="w-4 h-4 sm:w-5 sm:h-5 text-gray-600" />
                 </div>
              )}
            </div>
          ))}
          {messages.length === 0 && (
             <div className="h-full flex flex-col items-center justify-center text-gray-400 text-center p-4">
                <BotIcon className="w-12 h-12 mb-2 opacity-50"/>
                <p className="text-sm">{t('chat.empty')}</p>
             </div>
          )}
        </div>
        <form onSubmit={handleSubmit} className="mt-3 sm:mt-4 flex items-center gap-2 sm:gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('chat.placeholder')}
            aria-label={t('chat.placeholder')}
            id="chat-input"
            className="flex-grow p-2 sm:p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-sm sm:text-base"
          />
          <button type="submit" id="btn-send" disabled={isLoading || !query.trim()} aria-label={t('chat.send')} className="bg-blue-600 text-white p-2 sm:p-3 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 flex-shrink-0">
            <SendIcon className="w-5 h-5 sm:w-6 sm:h-6"/>
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatSection;
