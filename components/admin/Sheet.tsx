import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { XIcon } from '../IconComponents';

export const field = 'w-full px-3 py-2 rounded-xl border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm bg-white';
export const primaryButton = 'px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60';

/** Panel modal (en móvil ocupa la parte inferior de la pantalla). */
export function Sheet({ title, icon, onClose, children }: { title: string; icon: React.ReactNode; onClose: () => void; children: React.ReactNode }) {
  const { t } = useTranslation();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/40 flex items-end sm:items-center justify-center p-0 sm:p-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="bg-white w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">{icon}{title}</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:bg-gray-100" aria-label={t('common.close')}>
            <XIcon className="w-4 h-4" />
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

/** Traduce un error de los servicios (AppError.code) a un texto del idioma actual. */
export function useErrorText() {
  const { t } = useTranslation();
  return (err: unknown): string => {
    const code = (err as { code?: string })?.code;
    if (code === 'logoTooLarge') return t('orgSettings.logoTooLarge');
    if (code && t(`errors.${code}`, { defaultValue: '' })) return t(`errors.${code}`);
    return t('errors.generic');
  };
}
