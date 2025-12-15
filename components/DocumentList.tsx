
import React, { useState } from 'react';
import type { DocumentItem } from '../types';
import { FileTextIcon, ClipboardListIcon, SendIcon, TrashIcon } from './IconComponents';

interface DocumentListProps {
  documents: DocumentItem[];
  onSelectChat: (doc: DocumentItem) => void;
  onSelectSummary: (doc: DocumentItem) => void;
  onUploadNew: () => void;
  onDelete: (doc: DocumentItem) => void;
}

const DocumentList: React.FC<DocumentListProps> = ({ documents, onSelectChat, onSelectSummary, onUploadNew, onDelete }) => {
  // Estado para rastrear qué documento está esperando confirmación de eliminación
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDeleteInteraction = (e: React.MouseEvent, doc: DocumentItem) => {
      e.stopPropagation();
      e.preventDefault();

      if (confirmDeleteId === doc.id) {
          // Segundo clic: El usuario confirmó, procedemos a borrar
          console.log("Deleting document:", doc.id);
          onDelete(doc);
          setConfirmDeleteId(null);
      } else {
          // Primer clic: Mostramos estado de confirmación visual
          console.log("Requesting delete confirmation for:", doc.id);
          setConfirmDeleteId(doc.id);
          
          // Opcional: Cancelar confirmación después de 3 segundos si no confirma
          setTimeout(() => {
              setConfirmDeleteId(currentId => currentId === doc.id ? null : currentId);
          }, 3000);
      }
  };

  return (
    <div className="w-full space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">My Documents</h2>
        <button
          onClick={onUploadNew}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm font-medium"
        >
          + Upload New
        </button>
      </div>

      {documents.length === 0 ? (
        <div className="text-center p-12 bg-white rounded-xl border border-dashed border-gray-300">
            <FileTextIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-lg">No documents uploaded yet.</p>
            <p className="text-gray-400 text-sm mb-6">Upload your first PDF to get started.</p>
            <button onClick={onUploadNew} className="text-blue-600 font-semibold hover:underline">
                Upload now
            </button>
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc) => {
            // Ya no comprobamos si existe el resumen aquí, porque vive en otra colección.
            // Siempre permitimos intentar ver el resumen.
            const isConfirming = confirmDeleteId === doc.id;

            return (
              <div key={doc.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition-shadow flex flex-col justify-between h-full group">
                
                {/* Header: Icono a la izquierda, (ID + Botón Borrar) a la derecha */}
                <div className="flex items-start justify-between mb-3">
                    <div className="p-2 bg-blue-50 rounded-lg">
                        <FileTextIcon className="w-6 h-6 text-blue-600" />
                    </div>
                    
                    <div className="flex items-center gap-2 relative">
                        <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-1 rounded select-none">ID: {doc.id}</span>
                        
                        {/* Botón de eliminar inteligente con 2 estados */}
                        <button 
                            type="button"
                            onClick={(e) => handleDeleteInteraction(e, doc)}
                            className={`relative z-20 flex items-center justify-center transition-all duration-200 rounded-md border shadow-sm ${
                                isConfirming 
                                ? 'bg-red-600 text-white border-red-700 px-3 py-1 hover:bg-red-700' 
                                : 'bg-white text-gray-400 border-transparent hover:border-red-100 hover:bg-red-50 hover:text-red-600 p-2'
                            }`}
                            title={isConfirming ? "Click again to confirm deletion" : "Delete document"}
                            aria-label={isConfirming ? "Confirm delete" : `Delete ${doc.nombreDocumento}`}
                        >
                            {isConfirming ? (
                                <span className="text-xs font-bold whitespace-nowrap">Confirm?</span>
                            ) : (
                                <TrashIcon className="w-5 h-5 pointer-events-none" />
                            )}
                        </button>
                    </div>
                </div>
                
                {/* Info Documento */}
                <div>
                  <h3 className="font-semibold text-gray-800 truncate mb-1" title={doc.nombreDocumento}>
                    {doc.nombreDocumento}
                  </h3>
                  <p className="text-xs text-gray-500 mb-4">
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </p>
                </div>
                
                {/* Botones de Acción */}
                <div className="flex gap-2 mt-auto">
                  <button
                    type="button"
                    onClick={() => onSelectSummary(doc)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200"
                  >
                    <ClipboardListIcon className="w-4 h-4" />
                    Summary
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectChat(doc)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg text-sm font-medium transition-colors"
                  >
                    <SendIcon className="w-4 h-4" />
                    Chat
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DocumentList;
