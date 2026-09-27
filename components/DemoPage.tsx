import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChatMessage } from '../types';
import { askDemo, getDemoInfo, DemoError, type DemoInfo } from '../services/demo';
import SummarySection from './SummarySection';
import ChatSection from './ChatSection';
import Loader from './Loader';
import LanguageSwitcher from './LanguageSwitcher';
import CreatedBy from './CreatedBy';
import { FileTextIcon } from './IconComponents';

const CONTACT_URL = 'https://www.egsolutions.tech/contacto?utm_source=pdf-tech-assistant&utm_medium=demo';

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

/** Demo pública sin login: preguntas sobre un documento de ejemplo, con límite diario. */
const DemoPage: React.FC = () => {
  const { t } = useTranslation();
  const [info, setInfo] = useState<DemoInfo | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [left, setLeft] = useState(0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getDemoInfo()
      .then((data) => {
        setInfo(data);
        setLeft(data.questionsLeft ?? 0);
      })
      .catch(() => setLoadError(true));
  }, []);

  const send = async (query: string) => {
    if (busy || left <= 0) return;
    setBusy(true);
    setMessages((prev) => [...prev, { sender: 'user', text: query }, { sender: 'bot', text: '...' }]);
    try {
      const data = await askDemo(query);
      setLeft(data.questionsLeft);
      setMessages((prev) => [...prev.slice(0, -1), { sender: 'bot', text: data.output }]);
    } catch (err) {
      const code = err instanceof DemoError ? err.code : 'error';
      if (code === 'limit' || code === 'busy') setLeft(0);
      const text = code === 'limit' ? t('demo.limitReached') : code === 'busy' ? t('demo.busy') : code === 'too_long' ? t('demo.tooLong') : t('demo.error');
      setMessages((prev) => [...prev.slice(0, -1), { sender: 'bot', text: `<div><p>${escapeHtml(text)}</p></div>` }]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <FileTextIcon className="w-6 h-6 text-blue-600 shrink-0" aria-hidden="true" />
            <span className="font-bold text-gray-800 truncate">{t('app.name')}</span>
            <span className="text-[11px] font-semibold uppercase tracking-wide bg-blue-100 text-blue-700 px-2 py-0.5 rounded">{t('demo.badge')}</span>
          </div>
          <LanguageSwitcher />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-6 sm:py-8 space-y-6">
        <section>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-800 mb-2">{t('demo.title')}</h1>
          <p className="text-gray-600">{t('demo.intro')}</p>
        </section>

        {!info && !loadError && <div className="py-12 flex justify-center"><Loader text={t('common.loading')} /></div>}

        {(loadError || (info && !info.available)) && (
          <p className="p-4 rounded-lg bg-white border border-gray-200 text-gray-600">{t('demo.unavailable')}</p>
        )}

        {info?.available && info.document && (
          <>
            <p className="text-sm text-gray-500">
              {t('demo.document')}: <strong className="text-gray-700">{info.document.name}</strong>
            </p>
            {info.document.summary && <SummarySection summary={{ resumen: info.document.summary }} />}
            <ChatSection
              documentId="demo"
              messages={messages}
              onSendMessage={send}
              isLoading={busy || left <= 0}
              note={left > 0 ? t('demo.questionsLeft', { count: left }) : t('demo.noQuestionsLeft')}
            />
          </>
        )}

        <section className="p-5 rounded-lg bg-blue-600 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="font-bold text-lg">{t('demo.ctaTitle')}</h2>
            <p className="text-sm text-blue-100">{t('demo.ctaText')}</p>
          </div>
          <a href={CONTACT_URL} target="_blank" rel="noopener" className="shrink-0 bg-white text-blue-700 font-semibold text-sm px-4 py-2.5 rounded-lg hover:bg-blue-50 text-center">
            {t('demo.ctaButton')}
          </a>
        </section>

        <CreatedBy className="text-center" />
      </main>
    </div>
  );
};

export default DemoPage;
