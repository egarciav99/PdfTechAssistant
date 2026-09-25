import React from 'react';

/** Crédito de autoría con enlace a EG Solutions (igual en todos los proyectos de EG). */
const CreatedBy: React.FC<{ className?: string }> = ({ className = '' }) => (
  <p className={`text-[11px] text-gray-400 ${className}`}>
    Created by{' '}
    <a
      href="https://www.egsolutions.tech/?utm_source=pdf-tech-assistant&utm_medium=footer"
      target="_blank"
      rel="noopener"
      className="underline decoration-gray-300 underline-offset-2 hover:text-gray-600 transition-colors"
    >
      EG Solutions
    </a>
  </p>
);

export default CreatedBy;
