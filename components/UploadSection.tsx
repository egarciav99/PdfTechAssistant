
import React, { useRef } from 'react';
import { UploadCloudIcon } from './IconComponents';

interface UploadSectionProps {
  onFileSelect: (file: File) => void;
  onUpload: () => void;
  selectedFile: File | null;
  error: string | null;
}

const UploadSection: React.FC<UploadSectionProps> = ({ onFileSelect, onUpload, selectedFile, error }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      onFileSelect(event.target.files[0]);
    }
  };

  const handleDragOver = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDrop = (event: React.DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.dataTransfer.files && event.dataTransfer.files[0]) {
        onFileSelect(event.dataTransfer.files[0]);
    }
  };

  return (
    <div className="flex flex-col items-center w-full">
      <label
        htmlFor="pdf-upload"
        className="w-full flex flex-col items-center justify-center p-8 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors"
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        <UploadCloudIcon className="w-12 h-12 text-gray-400 mb-4" />
        <p className="text-lg text-gray-700 font-semibold">
          {selectedFile ? selectedFile.name : 'Drag & drop a PDF file here'}
        </p>
        <p className="text-sm text-gray-500">or click to browse</p>
        <input
          id="pdf-upload"
          type="file"
          accept=".pdf"
          className="hidden"
          ref={fileInputRef}
          onChange={handleFileChange}
        />
      </label>
      {error && <p className="text-red-500 mt-2 text-sm">{error}</p>}
      <button
        onClick={onUpload}
        disabled={!selectedFile}
        className="mt-6 w-full sm:w-auto px-8 py-3 bg-blue-600 text-white font-bold rounded-lg shadow-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all transform hover:scale-105"
      >
        Upload and Analyze Document
      </button>
    </div>
  );
};

export default UploadSection;
