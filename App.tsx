
import React, { useState, useEffect } from 'react';
import { uploadFileToFirebase, addNewDocumentToUser, auth, onAuthStateChanged, signOut, subscribeToUserDocuments, createUserDocument, deleteUserDocument, getDocumentSummary } from './services/firebase';
import { FIREBASE_CONFIG, N8N_INGESTION_URL, N8N_CHAT_URL } from './constants';
import type { AppState, SummaryData, ChatMessage, FirebaseUser, DocumentItem } from './types';
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
  const [userDocuments, setUserDocuments] = useState<DocumentItem[]>([]);
  const [activeDocument, setActiveDocument] = useState<DocumentItem | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatSessionId, setChatSessionId] = useState<number>(0);
  
  // Summary State (New)
  const [fetchedSummary, setFetchedSummary] = useState<string | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  
  // UI State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Auth
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authView, setAuthView] = useState<'login' | 'register'>('login');

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        // Ensure user doc exists
        await createUserDocument(user.uid);
      }
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Documents Subscription
  useEffect(() => {
    let unsubscribeDocs: () => void;
    if (currentUser) {
      unsubscribeDocs = subscribeToUserDocuments(currentUser.uid, (docs) => {
        // Sort by newest first
        const sorted = [...docs].sort((a, b) => b.createdAt - a.createdAt);
        setUserDocuments(sorted);
        
        // Update active document if it exists in the new list
        if (activeDocument) {
             const updatedActive = sorted.find(d => d.id === activeDocument.id);
             if (updatedActive) {
                 setActiveDocument(updatedActive);
             } else {
                 // Document was deleted while active
                 setActiveDocument(null);
                 setView('dashboard');
             }
        }
      });
    }
    return () => {
      if (unsubscribeDocs) unsubscribeDocs();
    };
  }, [currentUser, activeDocument?.id]); 

  // --- Handlers ---

  const handleFileSelect = (file: File | null) => {
    if (file) {
      setSelectedFile(file);
      setError(null);
    }
  };

  const handleStartUpload = async () => {
    if (!selectedFile || !currentUser) {
      setError('Please select a PDF file first.');
      return;
    }
    
    setError(null);
    setIsLoading(true);
    setView('uploading');

    try {
      // 1. Upload to Storage
      const storageId = await uploadFileToFirebase(selectedFile);

      // 2. Add metadata to Firestore (Users collection)
      const newDoc = await addNewDocumentToUser(currentUser.uid, {
        name: selectedFile.name,
        storageId: storageId,
      });

      // 3. Trigger n8n (Background process)
      fetch(N8N_INGESTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fileName: storageId, 
          bucketName: FIREBASE_CONFIG.storageBucket,
          uid: currentUser.uid,
          docId: newDoc?.id 
        }),
      }).catch(err => console.error("Non-blocking n8n call failed locally:", err));
      
      // Reset and go to dashboard
      setSelectedFile(null);
      setIsLoading(false);
      setView('dashboard');

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Upload failed.';
      console.error("Upload Error:", err);
      setError(errorMessage);
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setUserDocuments([]);
    setActiveDocument(null);
    setView('dashboard');
  };

  const handleDeleteDocument = async (doc: DocumentItem) => {
      if (!currentUser) return;
      try {
          await deleteUserDocument(currentUser.uid, doc.id, doc.storageId);
          if (activeDocument?.id === doc.id) {
              handleBackToDashboard();
          }
      } catch (err) {
          console.error("Error deleting document:", err);
          alert("Could not delete document. Please try again.");
      }
  };

  const handleSelectChat = (doc: DocumentItem) => {
    setActiveDocument(doc);
    setChatMessages([]); // Reset chat for new doc
    setChatSessionId(Date.now()); // Create a numeric session ID for this chat instance
    setView('chat');
  };

  // Fetch summary when entering view
  const handleSelectSummary = async (doc: DocumentItem) => {
    setActiveDocument(doc);
    setView('view-summary');
    
    // Iniciar carga del resumen desde la colección externa
    setIsSummaryLoading(true);
    setFetchedSummary(null);
    
    try {
        const summaryDoc = await getDocumentSummary(doc.storageId);
        if (summaryDoc && summaryDoc.resumen) {
            setFetchedSummary(summaryDoc.resumen);
        } else {
            setFetchedSummary(null); // No existe aun
        }
    } catch (e) {
        console.error("Failed to load summary", e);
    } finally {
        setIsSummaryLoading(false);
    }
  };

  const handleBackToDashboard = () => {
    setView('dashboard');
    setActiveDocument(null);
    setFetchedSummary(null);
    setError(null);
  };

  // --- Chat Logic ---

  const handleSendMessage = async (query: string) => {
    if (!query.trim() || !activeDocument || !currentUser) return;

    const userMessage: ChatMessage = { sender: 'user', text: query };
    setChatMessages(prev => [...prev, userMessage]);
    
    const typingMessage: ChatMessage = { sender: 'bot', text: '...' };
    setChatMessages(prev => [...prev, typingMessage]);

    try {
      // Preparamos los datos requeridos por el webhook de n8n
      const payload = {
        query: query,
        sessionId: chatSessionId, // Numeric ID representing the current chat session
        fileName: activeDocument.storageId, 
        docId: activeDocument.id, 
        uid: currentUser.uid,
        bucketName: FIREBASE_CONFIG.storageBucket
      };

      const chatResponse = await fetch(N8N_CHAT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!chatResponse.ok) throw new Error(`HTTP Error: ${chatResponse.status}`);
      
      const rawResult = await chatResponse.json();
      console.log("N8N Chat Raw Response:", rawResult); // DEBUG

      let responseText = "No response from AI.";

      // 1. Manejo de Array (El formato que confirmaste: [ { output: "..." } ])
      if (Array.isArray(rawResult) && rawResult.length > 0) {
          const firstItem = rawResult[0];
          if (firstItem && typeof firstItem === 'object') {
              responseText = firstItem.output || firstItem.text || firstItem.message || JSON.stringify(firstItem);
          } else {
              responseText = String(firstItem);
          }
      } 
      // 2. Manejo de Objeto simple (por si acaso: { output: "..." })
      else if (rawResult && typeof rawResult === 'object') {
          responseText = rawResult.output || rawResult.text || rawResult.message || JSON.stringify(rawResult);
      } 
      // 3. Manejo de String directo
      else if (typeof rawResult === 'string') {
          responseText = rawResult;
      }

      const botResponse: ChatMessage = { sender: 'bot', text: responseText };

      // Elimina el mensaje de '...' y agrega la respuesta real
      setChatMessages(prev => [...prev.slice(0, -1), botResponse]);

    } catch (err) {
      console.error("Chat Error:", err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown Error';
      const errorResponse: ChatMessage = { sender: 'bot', text: `Error: ${errorMessage}. Please check console.` };
      setChatMessages(prev => [...prev.slice(0, -1), errorResponse]);
    }
  };

  // --- Render Helpers ---

  if (isAuthLoading) return <div className="min-h-screen flex items-center justify-center"><Loader text="Initializing..." /></div>;

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
           <button onClick={handleBackToDashboard} className="mb-4 text-sm text-blue-600 hover:underline flex items-center gap-1">
             <span>←</span> Back to Dashboard
           </button>
           <div className="bg-blue-50 p-3 sm:p-4 rounded-lg mb-4 border border-blue-100">
             <h2 className="text-lg sm:text-xl font-bold text-gray-800 break-words">{activeDocument.nombreDocumento}</h2>
             <span className="text-xs text-gray-500">ID: {activeDocument.id}</span>
           </div>
           <ChatSection 
             documentId={activeDocument.nombreDocumento} 
             messages={chatMessages} 
             onSendMessage={handleSendMessage} 
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
      } else {
          // Fallback
          if (activeDocument.resumen && activeDocument.resumen.trim().length > 0) {
              summaryToRender = { "Cached Analysis": activeDocument.resumen };
          } 
          else if (typeof activeDocument.summary === 'string' && activeDocument.summary.trim().length > 0) {
              summaryToRender = { "Legacy Summary": activeDocument.summary };
          } 
          else if (typeof activeDocument.summary === 'object') {
              summaryToRender = activeDocument.summary;
          } else {
              return (
                <div>
                    <button onClick={handleBackToDashboard} className="mb-4 text-sm text-blue-600 hover:underline flex items-center gap-1">
                        <span>←</span> Back to Dashboard
                    </button>
                    <div className="p-8 sm:p-12 text-center bg-white rounded-lg border border-gray-200">
                        <p className="text-gray-500 text-lg mb-4">Summary not ready yet.</p>
                        <p className="text-gray-400 text-sm mb-4">The AI is still processing this document or it hasn't been generated.</p>
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
      }

      return (
        <div>
           <button onClick={handleBackToDashboard} className="mb-4 text-sm text-blue-600 hover:underline flex items-center gap-1">
             <span>←</span> Back to Dashboard
           </button>
           <div className="mb-4 sm:mb-6">
             <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-1 break-words">{activeDocument.nombreDocumento}</h2>
             <span className="text-xs text-gray-500">Uploaded: {new Date(activeDocument.createdAt).toLocaleString()}</span>
           </div>
           <SummarySection summary={summaryToRender} />
        </div>
      );
    }

    // Default: Dashboard
    if (isLoading) return <Loader text="Processing..." />;
    
    if (view === 'dashboard' && selectedFile) {
        return (
            <div>
                 <button onClick={() => { setSelectedFile(null); setError(null); }} className="mb-4 text-sm text-gray-500 hover:text-gray-700">Cancel Upload</button>
                 <UploadSection 
                    onFileSelect={handleFileSelect}
                    onUpload={handleStartUpload}
                    selectedFile={selectedFile}
                    error={error}
                  />
            </div>
        )
    }

    return (
      <DocumentList 
        documents={userDocuments} 
        onSelectChat={handleSelectChat}
        onSelectSummary={handleSelectSummary}
        onUploadNew={() => setView('dashboard')} 
        onDelete={handleDeleteDocument}
      />
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 font-sans">
        <header className="bg-white shadow-sm sticky top-0 z-10">
            <div className="max-w-5xl mx-auto px-4 py-3 sm:py-4 flex justify-between items-center">
                <div className="flex items-center gap-2 cursor-pointer" onClick={handleBackToDashboard}>
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
            <div className={`bg-white rounded-xl shadow-lg p-4 sm:p-6 md:p-8 min-h-[500px] transition-all ${view === 'dashboard' ? '' : 'ring-1 ring-black/5'}`}>
                 {view === 'dashboard' && !selectedFile ? (
                     <DocumentList 
                        documents={userDocuments}
                        onSelectChat={handleSelectChat}
                        onSelectSummary={handleSelectSummary}
                        onUploadNew={() => { setSelectedFile({} as File); }} 
                        onDelete={handleDeleteDocument}
                     />
                 ) : null}

                 {view === 'dashboard' && selectedFile ? (
                      <div className="max-w-2xl mx-auto">
                        <div className="flex justify-between items-center mb-6">
                             <h2 className="text-lg sm:text-xl font-bold text-gray-800">Upload Document</h2>
                             <button onClick={() => setSelectedFile(null)} className="text-gray-400 hover:text-gray-600 text-sm">✕ Cancel</button>
                        </div>
                        <UploadSection 
                            onFileSelect={(f) => handleFileSelect(f)}
                            onUpload={handleStartUpload}
                            selectedFile={selectedFile instanceof File ? selectedFile : null}
                            error={error}
                        />
                      </div>
                 ) : null}
                 
                 {view !== 'dashboard' && renderContent()}
            </div>
        </main>

        <footer className="text-center py-6 text-gray-400 text-xs sm:text-sm">
            <p>Powered by React, Firebase & n8n</p>
        </footer>
    </div>
  );
};

export default App;
