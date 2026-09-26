import React from 'react';
import { useTranslation } from 'react-i18next';
import { LANGUAGES, currentLanguage } from '../i18n';
import { GlobeIcon } from './IconComponents';

/** Selector de idioma (es/en). La elección se guarda en el navegador. */
const LanguageSwitcher: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { t, i18n } = useTranslation();
  return (
    <label className={`flex items-center gap-1 text-sm text-gray-500 ${className}`}>
      <GlobeIcon className="w-4 h-4" aria-hidden="true" />
      <span className="sr-only">{t('language.label')}</span>
      <select
        id="language-select"
        value={currentLanguage()}
        onChange={(e) => i18n.changeLanguage(e.target.value)}
        className="bg-transparent border border-gray-200 rounded-md px-1.5 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        aria-label={t('language.label')}
      >
        {LANGUAGES.map((lng) => (
          <option key={lng} value={lng}>{t(`language.${lng}`)}</option>
        ))}
      </select>
    </label>
  );
};

export default LanguageSwitcher;
