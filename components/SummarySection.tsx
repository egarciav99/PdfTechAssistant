
import React from 'react';
import type { SummaryData } from '../types';
import { ClipboardListIcon } from './IconComponents';

interface SummarySectionProps {
  summary: SummaryData;
}

const SummarySection: React.FC<SummarySectionProps> = ({ summary }) => {
  return (
    <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-center mb-4">
        <ClipboardListIcon className="w-6 h-6 text-blue-700 mr-3"/>
        <h2 className="text-2xl font-bold text-gray-800">Technical Summary</h2>
      </div>
      <dl className="space-y-4">
        {Object.entries(summary).map(([key, value]) => (
          <div key={key} className="p-4 bg-white rounded-md shadow-sm">
            <dt className="text-sm font-semibold text-gray-500 capitalize">{key.replace(/_/g, ' ')}</dt>
            <dd className="mt-1 text-base text-gray-700">
               {/* Check if value looks like HTML (starts with < and ends with > roughly) or just contains tags. 
                   For safety, we can use a simple check, or just render properly. 
                   Since n8n might return HTML formatted text, we use dangerouslySetInnerHTML safely here. */}
               {typeof value === 'string' && /<[a-z][\s\S]*>/i.test(value) ? (
                 <div 
                   className="prose prose-sm max-w-none" 
                   dangerouslySetInnerHTML={{ __html: value }} 
                 />
               ) : (
                 value
               )}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
};

export default SummarySection;