
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
    <div className="mt-4 sm:mt-6 border-t border-gray-200 pt-4 sm:pt-6">
       <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-4 text-center">Chat with Document AI</h2>
      <div className="bg-gray-50 p-2 sm:p-4 rounded-lg shadow-inner h-[60vh] sm:h-96 flex flex-col border border-gray-200">
        <div ref={chatContainerRef} className="flex-grow space-y-3 sm:space-y-4 overflow-y-auto px-1 sm:pr-2 scrollbar-thin scrollbar-thumb-gray-300">
          {messages.map((msg, index) => (
            <div key={index} className={`flex items-start gap-2 sm:gap-3 ${msg.sender === 'user' ? 'justify-end' : ''}`}>
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
                        dangerouslySetInnerHTML={{ __html: msg.text }}
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
                <p className="text-sm">Ask me anything about this document.</p>
             </div>
          )}
        </div>
        <form onSubmit={handleSubmit} className="mt-3 sm:mt-4 flex items-center gap-2 sm:gap-3">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask a question..."
            className="flex-grow p-2 sm:p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition text-sm sm:text-base"
          />
          <button type="submit" className="bg-blue-600 text-white p-2 sm:p-3 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 flex-shrink-0">
            <SendIcon className="w-5 h-5 sm:w-6 sm:h-6"/>
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatSection;
