

import React, { useRef, useState } from 'react';
import { Camera, Upload, X, File as FileIcon, Loader2, Plus, Zap } from 'lucide-react';
import { Language } from '../types';
import { translations } from '../locales';

interface Props {
  onAnalyze: (base64Images: string[], runInBackground: boolean) => void;
  isAnalyzing?: boolean;
  lang: Language;
}

interface StagedFile {
  id: string;
  file: File;
  status: 'reading' | 'ready' | 'error';
  previewUrl?: string; // Full data URL for display
  base64Data?: string; // Raw base64 for API
}

const FileUpload: React.FC<Props> = ({ onAnalyze, isAnalyzing = false, lang }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const [runInBackground, setRunInBackground] = useState(false);
  const t = translations[lang];

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files));
    }
    // Reset input value to allow selecting same files again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const processFiles = (files: File[]) => {
    const newFiles: StagedFile[] = files.map(file => ({
      id: Math.random().toString(36).substring(7),
      file,
      status: 'reading'
    }));

    setStagedFiles(prev => [...prev, ...newFiles]);

    // Process each file
    newFiles.forEach(stagedFile => {
      if (!stagedFile.file.type.startsWith('image/')) {
        updateFileStatus(stagedFile.id, 'error');
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        // Remove data URL prefix for API
        const base64Data = base64.split(',')[1];
        
        setStagedFiles(prev => prev.map(f => {
          if (f.id === stagedFile.id) {
            return { 
              ...f, 
              status: 'ready', 
              previewUrl: base64, 
              base64Data: base64Data 
            };
          }
          return f;
        }));
      };
      reader.onerror = () => {
        updateFileStatus(stagedFile.id, 'error');
      };
      reader.readAsDataURL(stagedFile.file);
    });
  };

  const updateFileStatus = (id: string, status: 'reading' | 'ready' | 'error') => {
    setStagedFiles(prev => prev.map(f => f.id === id ? { ...f, status } : f));
  };

  const removeFile = (id: string) => {
    setStagedFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleStartAnalysis = () => {
    const readyFiles = stagedFiles.filter(f => f.status === 'ready' && f.base64Data);
    if (readyFiles.length > 0) {
      onAnalyze(readyFiles.map(f => f.base64Data!), runInBackground);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Drop Zone */}
      <div 
        className={`relative group border-2 border-dashed rounded-3xl p-8 transition-all duration-300 text-center cursor-pointer
          ${dragActive ? 'border-teal-500 bg-teal-50 scale-[1.02]' : 'border-gray-300 hover:border-teal-400 hover:bg-gray-50'}
          ${stagedFiles.length > 0 ? 'py-6 border-gray-200' : 'py-10'}
        `}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input 
          ref={fileInputRef}
          type="file" 
          accept="image/*" 
          multiple
          className="hidden" 
          onChange={handleFileChange}
        />
        
        <div className="flex flex-col items-center justify-center gap-3">
          {stagedFiles.length === 0 ? (
            <>
              <div className="w-16 h-16 bg-gradient-to-tr from-teal-500 to-emerald-400 rounded-full flex items-center justify-center shadow-lg group-hover:shadow-xl transition-all">
                <Camera className="text-white w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="font-bold text-gray-800 text-lg">{t.uploadTitle}</h3>
                <p className="text-gray-500 text-sm max-w-xs mx-auto">
                  {t.uploadSubtitle}
                </p>
              </div>
            </>
          ) : (
             <div className="flex items-center gap-2 text-teal-600 font-medium">
                <Plus className="w-5 h-5" />
                <span>{t.addMore}</span>
             </div>
          )}
        </div>
      </div>

      {/* Staging Area */}
      {stagedFiles.length > 0 && (
        <div className="space-y-4 animate-fadeIn">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {stagedFiles.map((file) => (
              <div key={file.id} className="relative group rounded-xl overflow-hidden border border-gray-200 bg-white shadow-sm aspect-square">
                {file.status === 'reading' ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50">
                    <Loader2 className="w-6 h-6 text-teal-500 animate-spin mb-2" />
                    <span className="text-xs text-gray-400">{t.reading}</span>
                  </div>
                ) : file.status === 'error' ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-50">
                    <X className="w-6 h-6 text-red-400 mb-2" />
                    <span className="text-xs text-red-400">{t.readError}</span>
                  </div>
                ) : (
                  <>
                    <img 
                      src={file.previewUrl} 
                      alt="preview" 
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                    />
                    {/* Overlay with File Name */}
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-white text-[10px] truncate">{file.file.name}</p>
                    </div>
                  </>
                )}
                
                {/* Remove Button */}
                <button 
                  onClick={(e) => { e.stopPropagation(); removeFile(file.id); }}
                  className="absolute top-1 right-1 bg-black/50 hover:bg-red-500 text-white p-1 rounded-full backdrop-blur-sm transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                >
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
          
          {/* Background Toggle */}
          <div 
            className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors"
            onClick={() => setRunInBackground(!runInBackground)}
          >
            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${runInBackground ? 'bg-teal-500 border-teal-500' : 'bg-white border-gray-300'}`}>
              {runInBackground && <Zap className="w-3 h-3 text-white" fill="currentColor" />}
            </div>
            <div className="flex-1">
              <span className="text-sm font-semibold text-gray-700 block">{t.runInBackground}</span>
              <span className="text-xs text-gray-400 block">{t.runInBackgroundTip}</span>
            </div>
          </div>

          {/* Action Button */}
          <button
            onClick={handleStartAnalysis}
            disabled={isAnalyzing || stagedFiles.some(f => f.status === 'reading') || stagedFiles.length === 0}
            className={`w-full py-3.5 rounded-xl font-bold text-lg shadow-lg transition-all flex items-center justify-center gap-2
              ${isAnalyzing || stagedFiles.length === 0
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                : 'bg-teal-600 text-white hover:bg-teal-700 hover:shadow-teal-200 active:scale-[0.98]'
              }
            `}
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                {t.analyzing.replace('{count}', stagedFiles.length.toString())}
              </>
            ) : (
              <>
                {t.startAnalysis.replace('{count}', stagedFiles.length.toString())}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default FileUpload;