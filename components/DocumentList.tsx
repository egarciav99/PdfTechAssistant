import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DocumentItem } from '../types';
import { FileTextIcon, ClipboardListIcon, SendIcon, TrashIcon, RefreshIcon } from './IconComponents';

interface DocumentListProps {
  documents: DocumentItem[];
  /** Usuario actual: puede borrar lo que subió. */
  currentUserId: string;
  /** El admin de la empresa puede borrar cualquier documento. */
  isAdmin: boolean;
  onSelectChat: (doc: DocumentItem) => void;
  onSelectSummary: (doc: DocumentItem) => void;
  onUploadNew: () => void;
  onDelete: (doc: DocumentItem) => void;
  onRetry: (doc: DocumentItem) => void;
  onRefresh: () => void;
}

const STATUS_STYLES: Record<NonNullable<DocumentItem['status']>, string> = {
  uploaded: 'bg-gray-100 text-gray-600',
  processing: 'bg-amber-50 text-amber-700',
  ready: 'bg-emerald-50 text-emerald-700',
  error: 'bg-red-50 text-red-700',
};

const DocumentList: React.FC<DocumentListProps> = ({
  documents, currentUserId, isAdmin, onSelectChat, onSelectSummary, onUploadNew, onDelete, onRetry, onRefresh,
}) => {
  const { t, i18n } = useTranslation();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDeleteInteraction = (e: React.MouseEvent, doc: DocumentItem) => {
    e.stopPropagation();
    e.preventDefault();

    if (confirmDeleteId === doc.id) {
      onDelete(doc);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(doc.id);
      setTimeout(() => {
        setConfirmDeleteId((currentId) => (currentId === doc.id ? null : currentId));
      }, 3000);
    }
  };

  return (
    <div className="w-full space-y-4 sm:space-y-6">
      <div className="flex justify-between items-center gap-2 mb-4 sm:mb-6">
        <h2 className="text-xl sm:text-2xl font-bold text-gray-800">{t('documents.title')}</h2>
        <div className="flex items-center gap-2">
          <button onClick={onRefresh} className="p-2 text-gray-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg" title={t('common.refresh')} aria-label={t('common.refresh')}>
            <RefreshIcon className="w-4 h-4" />
          </button>
          <button
            onClick={onUploadNew}
            id="btn-upload-new"
            className="px-3 py-2 sm:px-4 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium text-sm sm:text-base whitespace-nowrap"
          >
            {t('documents.upload')}
          </button>
        </div>
      </div>

      {documents.length === 0 ? (
        <div className="text-center p-8 sm:p-12 bg-white rounded-xl border border-dashed border-gray-300">
          <FileTextIcon className="w-10 h-10 sm:w-12 sm:h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-base sm:text-lg">{t('documents.empty')}</p>
          <p className="text-gray-400 text-xs sm:text-sm mb-6">{t('documents.emptyHint')}</p>
          <button onClick={onUploadNew} className="text-blue-600 font-semibold hover:underline text-sm sm:text-base">
            {t('documents.uploadNow')}
          </button>
        </div>
      ) : (
        <ul className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" id="documents-list">
          {documents.map((doc) => {
            const isConfirming = confirmDeleteId === doc.id;
            const mine = doc.uploadedBy === currentUserId;
            const canDelete = isAdmin || mine;
            const status = doc.status ?? 'uploaded';
            const canRetry = status === 'error' && canDelete;

            return (
              <li key={doc.id} data-document-name={doc.nombreDocumento} className="bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow flex flex-col justify-between h-full group">
                <div className="flex items-start justify-between mb-3">
                  <div className="p-2 bg-blue-50 rounded-lg flex-shrink-0">
                    <FileTextIcon className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                  </div>

                  <div className="flex items-center gap-2 relative">
                    <span className={`text-xs font-semibold px-2 py-1 rounded select-none ${STATUS_STYLES[status]}`} data-status={status}>
                      {t(`documents.status.${status}`)}
                    </span>

                    {canDelete && (
                      <button
                        type="button"
                        onClick={(e) => handleDeleteInteraction(e, doc)}
                        aria-label={t('documents.delete')}
                        title={t('documents.delete')}
                        className={`relative z-20 flex items-center justify-center transition-all duration-200 rounded-md border shadow-sm ${
                          isConfirming
                            ? 'bg-red-600 text-white border-red-700 px-3 py-1 hover:bg-red-700'
                            : 'bg-white text-gray-400 border-transparent hover:border-red-100 hover:bg-red-50 hover:text-red-600 p-1 sm:p-2'
                        }`}
                      >
                        {isConfirming ? (
                          <span className="text-xs font-bold whitespace-nowrap">{t('documents.confirmDelete')}</span>
                        ) : (
                          <TrashIcon className="w-4 h-4 sm:w-5 sm:h-5 pointer-events-none" />
                        )}
                      </button>
                    )}
                  </div>
                </div>

                <div className="mb-4">
                  <h3 className="font-semibold text-gray-800 truncate mb-1 text-sm sm:text-base" title={doc.nombreDocumento}>
                    {doc.nombreDocumento}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {new Date(doc.createdAt).toLocaleDateString(i18n.resolvedLanguage)}
                    {mine && <span className="text-gray-400"> · {t('documents.mine')}</span>}
                  </p>
                </div>

                <div className="flex gap-2 mt-auto">
                  {canRetry ? (
                    <button
                      type="button"
                      onClick={() => onRetry(doc)}
                      className="flex-1 flex items-center justify-center gap-1 sm:gap-2 px-2 py-2 rounded-lg text-xs sm:text-sm font-medium bg-red-50 text-red-700 hover:bg-red-100 border border-red-200"
                    >
                      <RefreshIcon className="w-3 h-3 sm:w-4 sm:h-4" />
                      {t('documents.retry')}
                    </button>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => onSelectSummary(doc)}
                        className="flex-1 flex items-center justify-center gap-1 sm:gap-2 px-2 py-2 rounded-lg text-xs sm:text-sm font-medium transition-colors bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                      >
                        <ClipboardListIcon className="w-3 h-3 sm:w-4 sm:h-4" />
                        {t('documents.summary')}
                      </button>
                      <button
                        type="button"
                        onClick={() => onSelectChat(doc)}
                        className="flex-1 flex items-center justify-center gap-1 sm:gap-2 px-2 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg text-xs sm:text-sm font-medium transition-colors"
                      >
                        <SendIcon className="w-3 h-3 sm:w-4 sm:h-4" />
                        {t('documents.chat')}
                      </button>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default DocumentList;
