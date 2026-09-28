import React, { useLayoutEffect, useRef, useState } from 'react';
import { cleanModelHtml } from '../services/modelHtml';
import { useTranslation } from 'react-i18next';
import type { SummaryData } from '../types';
import { ClipboardListIcon } from './IconComponents';

/** Altura del resumen plegado (px). */
const COLLAPSED_HEIGHT = 220;

interface SummarySectionProps {
  summary: SummaryData;
  /** Muestra solo el principio del resumen con un botón para ampliarlo (se usa en la demo). */
  collapsible?: boolean;
}

const SummarySection: React.FC<SummarySectionProps> = ({ summary, collapsible = false }) => {
  const { t } = useTranslation();
  const contentRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  // Solo hay botón si el resumen es más alto que la parte plegada.
  useLayoutEffect(() => {
    if (!collapsible || !contentRef.current) return;
    setOverflows(contentRef.current.scrollHeight > COLLAPSED_HEIGHT + 40);
  }, [collapsible, summary]);

  const collapsed = collapsible && overflows && !expanded;

  return (
    <div id="summary" className="p-3 sm:p-6 bg-blue-50 border border-blue-200 rounded-lg overflow-hidden">
      <div className="flex items-center mb-3 sm:mb-4">
        <ClipboardListIcon className="w-5 h-5 sm:w-6 sm:h-6 text-blue-700 mr-2 sm:mr-3 flex-shrink-0"/>
        <h2 className="text-lg sm:text-2xl font-bold text-gray-800 truncate">{t('summary.title')}</h2>
      </div>
      <div
        ref={contentRef}
        id="summary-content"
        className={`space-y-4 relative ${collapsed ? 'overflow-hidden' : ''}`}
        style={collapsed ? { maxHeight: COLLAPSED_HEIGHT } : undefined}
      >
        {Object.entries(summary).map(([key, value]) => (
          <div key={key} className="p-3 sm:p-4 bg-white rounded-md shadow-sm overflow-hidden text-sm sm:text-base text-gray-700">
            <div
              className="prose prose-sm max-w-none text-gray-700 break-words overflow-x-auto"
              dangerouslySetInnerHTML={{ __html: cleanModelHtml(value) }}
            />
          </div>
        ))}
        {collapsed && <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-blue-50 to-transparent pointer-events-none" aria-hidden="true" />}
      </div>
      {collapsible && overflows && (
        <button
          type="button"
          id="btn-summary-toggle"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls="summary-content"
          className="mt-3 text-sm font-semibold text-blue-700 hover:underline"
        >
          {expanded ? t('summary.showLess') : t('summary.showMore')}
        </button>
      )}
    </div>
  );
};

export default SummarySection;
