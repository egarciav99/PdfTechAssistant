
import React from 'react';
import DOMPurify from 'dompurify';
import type { SummaryData } from '../types';
import { ClipboardListIcon } from './IconComponents';

interface SummarySectionProps {
  summary: SummaryData;
}

const SummarySection: React.FC<SummarySectionProps> = ({ summary }) => {
  return (
    <div className="p-3 sm:p-6 bg-blue-50 border border-blue-200 rounded-lg overflow-hidden">
      <div className="flex items-center mb-3 sm:mb-4">
        <ClipboardListIcon className="w-5 h-5 sm:w-6 sm:h-6 text-blue-700 mr-2 sm:mr-3 flex-shrink-0"/>
        <h2 className="text-lg sm:text-2xl font-bold text-gray-800 truncate">Technical Summary</h2>
      </div>
      <dl className="space-y-4">
        {Object.entries(summary).map(([key, value]) => (
          <div key={key} className="p-3 sm:p-4 bg-white rounded-md shadow-sm overflow-hidden">
            <dt className="text-xs sm:text-sm font-semibold text-gray-500 capitalize mb-2">{key.replace(/_/g, ' ')}</dt>
            <dd className="mt-1 text-sm sm:text-base text-gray-700">
               {typeof value === 'string' ? (
                 <div 
                   className="prose prose-sm max-w-none text-gray-700 break-words overflow-x-auto" 
                   dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(value) }} 
                 />
               ) : (
                 <span className="break-words">{value}</span>
               )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
};

export default SummarySection;
