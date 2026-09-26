import React, { useState, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth, useDocuments, useChat, useOrgs } from './hooks';
import type { AppState, SummaryData, DocumentItem, SupabaseUser } from './types';
import { isConfigured } from './config';
import UploadSection from './components/UploadSection';
import SummarySection from './components/SummarySection';
import ChatSection from './components/ChatSection';
import Loader from './components/Loader';
import DocumentList from './components/DocumentList';
import LanguageSwitcher from './components/LanguageSwitcher';
import { LoginScreen, NotConfiguredScreen, SetPasswordScreen, AuthLayout } from './components/AuthScreens';
import { MembersPanel } from './components/admin/MembersPanel';
import { OrgsPanel } from './components/admin/OrgsPanel';
import { BuildingIcon, FileTextIcon, LogOutIcon, UsersIcon } from './components/IconComponents';
import CreatedBy from './components/CreatedBy';

const App: React.FC = () => {
  if (!isConfigured()) return <NotConfiguredScreen />;
  return <AuthenticatedApp />;
};

const AuthenticatedApp: React.FC = () => {
  const { t } = useTranslation();
  const { currentUser, isLoading, mustSetPassword, passwordSet, logout } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader text={t('common.loading')} />
      </div>
    );
  }
  if (currentUser && mustSetPassword) return <SetPasswordScreen onDone={passwordSet} />;
  if (!currentUser) return <LoginScreen />;
  return <Workspace user={currentUser} onSignOut={logout} />;
};

const BackButton: React.FC<{ onClick: () => void }> = ({ onClick }) => {
  const { t } = useTranslation();
  return (
    <button onClick={onClick} className="mb-4 text-sm text-blue-600 hover:underline flex items-center gap-1" id="btn-back">
      <span aria-hidden="true">←</span> {t('common.back')}
    </button>
  );
};

const Workspace: React.FC<{ user: SupabaseUser; onSignOut: () => Promise<void> }> = ({ user, onSignOut }) => {
  const { t, i18n } = useTranslation();
  const orgs = useOrgs(user.id);
  const { currentOrg, role, isSuperadmin } = orgs;
  const isAdmin = role === 'admin';

  const [view, setView] = useState<AppState>('dashboard');
  const [activeDocument, setActiveDocument] = useState<DocumentItem | null>(null);
  const [fetchedSummary, setFetchedSummary] = useState<string | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState(false);
  const [showUploadView, setShowUploadView] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [panel, setPanel] = useState<'members' | 'orgs' | null>(null);

  const docs = useDocuments(currentOrg?.id ?? null, user.id);
  const chat = useChat(user.id, activeDocument?.id ?? null);

  const handleBackToDashboard = useCallback(() => {
    setView('dashboard');
    setActiveDocument(null);
    setFetchedSummary(null);
    setSelectedFile(null);
    setShowUploadView(false);
  }, []);

  // Al cambiar de empresa se vuelve a la lista de documentos.
  useEffect(() => {
    handleBackToDashboard();
  }, [currentOrg?.id, handleBackToDashboard]);

  const handleStartUpload = useCallback(async () => {
    if (!selectedFile || docs.isLoading) return;
    setView('uploading');
    try {
      await docs.uploadDocument(selectedFile);
      setSelectedFile(null);
      setShowUploadView(false);
    } catch {
      // El error se muestra en el aviso general.
    } finally {
      setView('dashboard');
    }
  }, [selectedFile, docs]);

  const handleDeleteDocument = useCallback(async (doc: DocumentItem) => {
    try {
      await docs.deleteDocument(doc);
      if (activeDocument?.id === doc.id) handleBackToDashboard();
    } catch {
      // El error se muestra en el aviso general.
    }
  }, [docs, activeDocument, handleBackToDashboard]);

  const handleSelectChat = useCallback((doc: DocumentItem) => {
    setActiveDocument(doc);
    setView('chat');
  }, []);

  const handleSelectSummary = useCallback(async (doc: DocumentItem) => {
    setActiveDocument(doc);
    setView('view-summary');
    setIsSummaryLoading(true);
    setFetchedSummary(null);
    try {
      const summaryDoc = await docs.fetchSummary(doc.id);
      if (summaryDoc?.resumen) setFetchedSummary(summaryDoc.resumen);
    } finally {
      setIsSummaryLoading(false);
    }
  }, [docs]);

  const handleSendChatMessage = useCallback(async (query: string) => {
    if (!activeDocument) return;
    await chat.sendMessage(query, activeDocument, user.id);
  }, [activeDocument, chat, user.id]);

  const globalError = docs.error ? t(docs.error) : chat.error;
  const clearGlobalError = () => {
    docs.clearError();
    chat.clearError();
  };

  if (orgs.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader text={t('common.loading')} />
      </div>
    );
  }

  // Sin empresa y sin ser superadmin: no hay nada que mostrar.
  if (!currentOrg && !isSuperadmin) {
    return (
      <AuthLayout>
        <div className="w-full max-w-sm bg-white border border-gray-200 rounded-2xl shadow-sm p-6 text-center" role="alert">
          <h2 className="text-lg font-bold text-gray-800 mb-2">{t('org.noOrgsTitle')}</h2>
          <p className="text-sm text-gray-600 mb-4">{orgs.error || t('org.noOrgsBody')}</p>
          <button onClick={onSignOut} className="text-sm text-blue-700 hover:underline">{t('auth.signOut')}</button>
        </div>
      </AuthLayout>
    );
  }

  const renderContent = () => {
    if (!currentOrg) {
      return <p className="text-gray-500 text-center py-12">{t('orgs.empty')}</p>;
    }

    if (view === 'uploading') return <Loader text={t('upload.uploading')} />;

    if (view === 'chat' && activeDocument) {
      return (
        <div>
          <BackButton onClick={handleBackToDashboard} />
          <div className="bg-blue-50 p-3 sm:p-4 rounded-lg mb-4 border border-blue-100">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800 break-words">{activeDocument.nombreDocumento}</h2>
          </div>
          <ChatSection
            documentId={activeDocument.nombreDocumento}
            messages={chat.messages}
            onSendMessage={handleSendChatMessage}
            onNewChat={chat.resetChat}
            isLoading={chat.isLoading}
          />
        </div>
      );
    }

    if (view === 'view-summary' && activeDocument) {
      if (isSummaryLoading) return <Loader text={t('summary.fetching')} />;

      const header = (
        <>
          <BackButton onClick={handleBackToDashboard} />
          <div className="mb-4 sm:mb-6">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-1 break-words">{activeDocument.nombreDocumento}</h2>
            <span className="text-xs text-gray-500">
              {t('summary.uploadedAt', { date: new Date(activeDocument.createdAt).toLocaleString(i18n.resolvedLanguage) })}
            </span>
          </div>
        </>
      );

      if (!fetchedSummary) {
        return (
          <div>
            {header}
            <div className="p-8 sm:p-12 text-center bg-white rounded-lg border border-gray-200">
              <p className="text-gray-500 text-lg mb-4">{t('summary.notReady')}</p>
              <p className="text-gray-400 text-sm mb-4">{t('summary.notReadyHint')}</p>
              <button onClick={() => handleSelectSummary(activeDocument)} className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition">
                {t('common.refresh')}
              </button>
            </div>
          </div>
        );
      }

      const summaryToRender: SummaryData = { summary: fetchedSummary };
      return (
        <div>
          {header}
          <SummarySection summary={summaryToRender} />
        </div>
      );
    }

    if (docs.isLoading && docs.documents.length === 0) return <Loader text={t('common.loading')} />;

    if (showUploadView) {
      return (
        <div className="max-w-2xl mx-auto">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg sm:text-xl font-bold text-gray-800">{t('upload.title')}</h2>
            <button onClick={() => { setSelectedFile(null); setShowUploadView(false); }} className="text-gray-400 hover:text-gray-600 text-sm">
              ✕ {t('common.cancel')}
            </button>
          </div>
          <UploadSection
            onFileSelect={setSelectedFile}
            onUpload={handleStartUpload}
            selectedFile={selectedFile}
            error={null}
            isUploading={docs.isLoading}
          />
        </div>
      );
    }

    return (
      <DocumentList
        documents={docs.documents}
        currentUserId={user.id}
        isAdmin={isAdmin}
        onSelectChat={handleSelectChat}
        onSelectSummary={handleSelectSummary}
        onUploadNew={() => setShowUploadView(true)}
        onDelete={handleDeleteDocument}
        onRetry={docs.retryDocument}
        onRefresh={docs.reload}
      />
    );
  };

  const orgCount = orgs.access?.orgs.length ?? 0;

  return (
    <div className="min-h-screen flex flex-col bg-gray-50 font-sans">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap justify-between items-center gap-3">
          <button type="button" className="flex items-center gap-3 min-w-0 text-left" onClick={handleBackToDashboard}>
            {currentOrg?.logo_url
              ? <img src={currentOrg.logo_url} alt="" className="h-8 sm:h-10 max-w-[120px] object-contain" id="org-logo" />
              : <FileTextIcon className="w-7 h-7 sm:w-8 sm:h-8 text-blue-600 flex-shrink-0" />}
            <span className="min-w-0">
              <span className="block text-base sm:text-lg font-bold text-gray-800 truncate" id="org-name-header">
                {currentOrg?.name || t('app.name')}
              </span>
              {currentOrg && (
                <span className="block text-xs text-gray-500 truncate" id="org-tagline">
                  {t('app.tagline', { specialty: t(`specialties.${currentOrg.specialty}`) })}
                </span>
              )}
            </span>
          </button>

          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            {orgCount > 1 && currentOrg && (
              <select
                value={currentOrg.id}
                onChange={(e) => orgs.selectOrg(e.target.value)}
                aria-label={t('org.switchLabel')}
                id="org-switcher"
                className="max-w-[180px] border border-gray-200 rounded-md px-2 py-1 text-sm"
              >
                {orgs.access?.orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            )}
            {isSuperadmin && (
              <button onClick={() => setPanel('orgs')} id="btn-orgs" className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg">
                <BuildingIcon className="w-4 h-4" /> <span className="hidden sm:inline">{t('org.companies')}</span>
              </button>
            )}
            {isAdmin && currentOrg && (
              <button onClick={() => setPanel('members')} id="btn-members" className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg">
                <UsersIcon className="w-4 h-4" /> <span className="hidden sm:inline">{t('org.users')}</span>
              </button>
            )}
            <LanguageSwitcher />
            <span className="text-sm text-gray-500 hidden md:flex items-center gap-2">
              {user.email}
              <span className="text-[11px] font-semibold uppercase tracking-wide bg-gray-100 text-gray-600 rounded px-1.5 py-0.5" id="role-badge">
                {isSuperadmin ? t('roles.superadmin') : role ? t(`roles.${role}`) : ''}
              </span>
            </span>
            <button onClick={onSignOut} id="btn-signout" className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm">
              <LogOutIcon className="w-5 h-5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">{t('auth.signOut')}</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-grow w-full max-w-5xl mx-auto p-3 sm:p-6 md:p-8">
        {globalError && (
          <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg shadow-sm flex justify-between items-start" role="alert">
            <p className="text-sm text-red-700">{globalError}</p>
            <button onClick={clearGlobalError} className="text-red-400 hover:text-red-600 focus:outline-none" aria-label={t('common.dismiss')}>✕</button>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 md:p-8 min-h-[500px]">
          {renderContent()}
        </div>
      </main>

      <footer className="text-center py-6 text-gray-400 text-xs sm:text-sm">
        <p>{t('app.poweredBy')}</p>
        <CreatedBy className="mt-1" />
      </footer>

      {panel === 'members' && currentOrg && (
        <MembersPanel
          key={currentOrg.id}
          org={currentOrg}
          currentUserId={user.id}
          onClose={() => setPanel(null)}
          onOrgChanged={() => orgs.refresh(currentOrg.id)}
        />
      )}
      {panel === 'orgs' && orgs.access && (
        <OrgsPanel
          orgs={orgs.access.orgs}
          onClose={() => setPanel(null)}
          onCreated={(id) => { setPanel(null); orgs.refresh(id); }}
          onOpen={(id) => { setPanel(null); orgs.selectOrg(id); }}
        />
      )}
    </div>
  );
};

export default App;
