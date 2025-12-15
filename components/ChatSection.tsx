
import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage } from '../types';
import { SendIcon, UserIcon, BotIcon } from './IconComponents';

interface ChatSectionProps {
  documentId: string;
  messages: ChatMessage[];
  onSendMessage: (query: string) => void;
}

const ChatSection: React.FC<ChatSectionProps> = ({ documentId, messages, onSendMessage }) => {
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
    <div className="mt-6 border-t border-gray-200 pt-6">
       <h2 className="text-2xl font-bold text-gray-800 mb-4 text-center">Chat with Document AI</h2>
      <div className="bg-gray-50 p-4 rounded-lg shadow-inner h-96 flex flex-col">
        <div ref={chatContainerRef} className="flex-grow space-y-4 overflow-y-auto pr-2">
          {messages.map((msg, index) => (
            <div key={index} className={`flex items-start gap-3 ${msg.sender === 'user' ? 'justify-end' : ''}`}>
              {msg.sender === 'bot' && (
                 <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
                  <BotIcon className="w-5 h-5 text-white" />
                 </div>
              )}
              <div className={`max-w-md p-3 rounded-lg ${msg.sender === 'user' ? 'bg-blue-600 text-white' : 'bg-white text-gray-800 shadow-sm overflow-hidden'}`}>
                {msg.sender === 'bot' ? (
                    /* Render HTML safely for bot messages to support rich responses from n8n */
                    <div 
                        className="text-sm prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: msg.text }}
                    />
                ) : (
                    <p className="text-sm">{msg.text}</p>
                )}
              </div>
               {msg.sender === 'user' && (
                 <div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center flex-shrink-0">
                  <UserIcon className="w-5 h-5 text-gray-600" />
                 </div>
              )}
            </div>
          ))}
        </div>
        <form onSubmit={handleSubmit} className="mt-4 flex items-center gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Ask a question about ${documentId}...`}
            className="flex-grow p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
          />
          <button type="submit" className="bg-blue-600 text-white p-3 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 flex-shrink-0">
            <SendIcon className="w-6 h-6"/>
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatSection;