import React, { useState, useCallback } from 'react';
import { useAuth, useDocuments, useChat } from './hooks';
import type { AppState, SummaryData, DocumentItem } from './types';
import UploadSection from './components/UploadSection';
import SummarySection from './components/SummarySection';
import ChatSection from './components/ChatSection';
import Loader from './components/Loader';
import Login from './components/Login';
import Register from './components/Register';
import DocumentList from './components/DocumentList';
import { FileTextIcon, LogOutIcon } from './components/IconComponents';

const App: React.FC = () => {
  // Views: 'dashboard', 'uploading', 'chat', 'view-summary'
  const [view, setView] = useState<AppState>('dashboard');
  
  // Data
  const [activeDocument, setActiveDocument] = useState<DocumentItem | null>(null);
  
  // Summary State
  const [fetchedSummary, setFetchedSummary] = useState<string | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  
  // UI State
  const [showUploadView, setShowUploadView] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [authView, setAuthView] = useState<'login' | 'register'>('login');

  // Custom Hooks
  const { 
    currentUser, 
    isLoading: isAuthLoading, 
    error: authError,
    login, 
    register, 
    logout,
    clearError: clearAuthError 
  } = useAuth();
  
  const { 
    documents, 
    isLoading: isDocLoading,
    error: docError,
    uploadDocument, 
    deleteDocument,
    fetchSummary,
    clearError: clearDocError 
  } = useDocuments(currentUser?.uid || null);
  
  const { 
    messages, 
    isLoading: isChatLoading,
    error: chatError,
    sendMessage, 
    resetChat,
    clearError: clearChatError
  } = useChat();

  // Aggregate errors
  const globalError = authError || docError || chatError;
  const clearGlobalError = useCallback(() => {
    if (authError) clearAuthError();
    if (docError) clearDocError();
    if (chatError) clearChatError();
  }, [authError, docError, chatError, clearAuthError, clearDocError, clearChatError]);

  // --- Handlers ---
  
  const handleBackToDashboard = useCallback(() => {
    setView('dashboard');
    setActiveDocument(null);
    setFetchedSummary(null);
    setSelectedFile(null);
    setShowUploadView(false);
  }, []);

  const handleFileSelect = useCallback((file: File | null) => {
    setSelectedFile(file);
  }, []);

  const handleStartUpload = useCallback(async () => {
    if (!selectedFile || !currentUser) return;
    
    setView('uploading');

    try {
      await uploadDocument(selectedFile, currentUser.uid);
      setSelectedFile(null);
      setView('dashboard');
    } catch (err) {
      // Error is handled in the hook, just reset view
      setView('dashboard');
    }
  }, [selectedFile, currentUser, uploadDocument]);

  const handleSignOut = useCallback(async () => {
    await logout();
    setActiveDocument(null);
    setView('dashboard');
  }, [logout]);

  const handleDeleteDocument = useCallback(async (doc: DocumentItem) => {
    if (!currentUser) return;
    try {
      await deleteDocument(doc, currentUser.uid);
      if (activeDocument?.id === doc.id) {
        handleBackToDashboard();
      }
    } catch (err) {
      // Error handled in hook and displayed by global error banner
    }
  }, [currentUser, deleteDocument, activeDocument, handleBackToDashboard]);

  const handleSelectChat = useCallback((doc: DocumentItem) => {
    setActiveDocument(doc);
    resetChat();
    setView('chat');
  }, [resetChat]);

  const handleSelectSummary = useCallback(async (doc: DocumentItem) => {
    setActiveDocument(doc);
    setView('view-summary');
    setIsSummaryLoading(true);
    setFetchedSummary(null);
    
    try {
      const summaryDoc = await fetchSummary(doc.storageId);
      if (summaryDoc && summaryDoc.resumen) {
        setFetchedSummary(summaryDoc.resumen);
      }
    } finally {
      setIsSummaryLoading(false);
    }
  }, [fetchSummary]);

  // handleBackToDashboard moved up for dependency resolution

  const handleSendChatMessage = useCallback(async (query: string) => {
    if (!activeDocument || !currentUser) return;
    await sendMessage(query, activeDocument, currentUser.uid);
  }, [activeDocument, currentUser, sendMessage]);

  // --- Render Helpers ---

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader text="Initializing..." />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4">
        {authView === 'login' ? (
          <Login onSwitchToRegister={() => setAuthView('register')} />
        ) : (
          <Register onSwitchToLogin={() => setAuthView('login')} />
        )}
      </div>
    );
  }

  const renderContent = () => {
    if (view === 'uploading') {
      return <Loader text="Uploading and initializing analysis..." />;
    }

    if (view === 'chat' && activeDocument) {
      return (
        <div>
          <button 
            onClick={handleBackToDashboard} 
            className="mb-4 text-sm text-blue-600 hover:underline flex items-center gap-1"
          >
            <span>←</span> Back to Dashboard
          </button>
          <div className="bg-blue-50 p-3 sm:p-4 rounded-lg mb-4 border border-blue-100">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800 break-words">
              {activeDocument.nombreDocumento}
            </h2>
            <span className="text-xs text-gray-500">ID: {activeDocument.id}</span>
          </div>
          <ChatSection 
            documentId={activeDocument.nombreDocumento} 
            messages={messages} 
            onSendMessage={handleSendChatMessage} 
          />
        </div>
      );
    }

    if (view === 'view-summary' && activeDocument) {
      if (isSummaryLoading) {
        return <Loader text="Fetching summary from database..." />;
      }

      let summaryToRender: SummaryData = {};

      if (fetchedSummary) {
        summaryToRender = { "Document Analysis": fetchedSummary };
      } else if (activeDocument.resumen && activeDocument.resumen.trim().length > 0) {
        summaryToRender = { "Cached Analysis": activeDocument.resumen };
      } else if (typeof activeDocument.summary === 'string' && activeDocument.summary.trim().length > 0) {
        summaryToRender = { "Legacy Summary": activeDocument.summary };
      } else if (typeof activeDocument.summary === 'object' && activeDocument.summary !== null) {
        summaryToRender = activeDocument.summary;
      } else {
        return (
          <div>
            <button 
              onClick={handleBackToDashboard} 
              className="mb-4 text-sm text-blue-600 hover:underline flex items-center gap-1"
            >
              <span>←</span> Back to Dashboard
            </button>
            <div className="p-8 sm:p-12 text-center bg-white rounded-lg border border-gray-200">
              <p className="text-gray-500 text-lg mb-4">Summary not ready yet.</p>
              <p className="text-gray-400 text-sm mb-4">
                The AI is still processing this document or it hasn't been generated.
              </p>
              <button 
                onClick={() => handleSelectSummary(activeDocument)}
                className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition"
              >
                Refresh
              </button>
            </div>
          </div>
        );
      }

      return (
        <div>
          <button 
            onClick={handleBackToDashboard} 
            className="mb-4 text-sm text-blue-600 hover:underline flex items-center gap-1"
          >
            <span>←</span> Back to Dashboard
          </button>
          <div className="mb-4 sm:mb-6">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-1 break-words">
              {activeDocument.nombreDocumento}
            </h2>
            <span className="text-xs text-gray-500">
              Uploaded: {new Date(activeDocument.createdAt).toLocaleString()}
            </span>
          </div>
          <SummarySection summary={summaryToRender} />
        </div>
      );
    }

    // Default: Dashboard
    if (isDocLoading) return <Loader text="Processing..." />;
    
    if (view === 'dashboard' && showUploadView) {
      return (
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800">Upload Document</h2>
            <button 
              onClick={() => {
                setSelectedFile(null);
                setShowUploadView(false);
              }} 
              className="text-gray-400 hover:text-gray-600 text-sm"
            >
              ✕ Cancel
            </button>
          </div>
          <UploadSection 
            onFileSelect={handleFileSelect}
            onUpload={handleStartUpload}
            selectedFile={selectedFile}
            error={null}
          />
        </div>
      );
    }

    return (
      <DocumentList 
        documents={documents} 
        onSelectChat={handleSelectChat}
        onSelectSummary={handleSelectSummary}
        onUploadNew={() => setShowUploadView(true)} 
        onDelete={handleDeleteDocument}
      />
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 font-sans">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 sm:py-4 flex justify-between items-center">
          <div 
            className="flex items-center gap-2 cursor-pointer" 
            onClick={handleBackToDashboard}
          >
            <FileTextIcon className="w-6 h-6 sm:w-8 sm:h-8 text-blue-600" />
            <h1 className="text-lg sm:text-xl font-bold text-gray-800">PDF Assistant</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500 hidden md:block">{currentUser.email}</span>
            <button 
              onClick={handleSignOut}
              className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm"
            >
              <LogOutIcon className="w-5 h-5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-grow w-full max-w-5xl mx-auto p-3 sm:p-6 md:p-8">
        {globalError && (
          <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg shadow-sm flex justify-between items-start">
            <div className="flex items-center">
              <span className="text-red-500 mr-2">⚠️</span>
              <p className="text-sm text-red-700">{globalError}</p>
            </div>
            <button 
              onClick={clearGlobalError}
              className="text-red-400 hover:text-red-600 focus:outline-none"
            >
              ✕
            </button>
          </div>
        )}
        
        <div className={`bg-white rounded-xl shadow-lg p-4 sm:p-6 md:p-8 min-h-[500px] transition-all ${view === 'dashboard' ? '' : 'ring-1 ring-black/5'}`}>
          {view !== 'dashboard' && renderContent()}
          {view === 'dashboard' && renderContent()}
        </div>
      </main>

      <footer className="text-center py-6 text-gray-400 text-xs sm:text-sm">
        <p>Powered by React, Firebase & n8n</p>
      </footer>
    </div>
  );
};

export default App;
