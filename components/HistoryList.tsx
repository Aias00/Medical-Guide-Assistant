
import React from 'react';
import { HistoryItem, AnalysisType } from '../types';
import { Clock, Trash2, Loader2, AlertCircle, Pill, FileText, Activity } from 'lucide-react';
import { translations } from '../locales';

interface Props {
  history: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  onDelete: (e: React.MouseEvent, id: string) => void;
  onClear: () => void;
  lang: 'zh' | 'en';
}

const HistoryList: React.FC<Props> = ({ history, onSelect, onDelete, onClear, lang }) => {
  const t = translations[lang];

  const formatDateShort = (timestamp: number) => {
    const d = new Date(timestamp);
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
  };

  return (
    <div className="pt-6 animate-fadeIn">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm uppercase tracking-wide">
          <Clock className="w-4 h-4 text-gray-400" />
          {t.historyTitle}
        </h3>
        <button onClick={onClear} className="text-xs text-gray-400 hover:text-red-500 transition-colors">
          {t.clearHistory}
        </button>
      </div>
      <div className="space-y-3">
        {history.map(item => {
          const isProcessing = item.status === 'processing';
          const isFailed = item.status === 'failed';
          
          return (
            <div 
              key={item.id} 
              onClick={() => onSelect(item)}
              className={`bg-white rounded-xl p-3 border transition-all relative group
                ${isProcessing ? 'border-teal-200 bg-teal-50/30 cursor-wait' : 
                  isFailed ? 'border-red-200 bg-red-50/30 cursor-default' : 
                  'border-gray-100 shadow-sm hover:shadow-md active:scale-[0.99] cursor-pointer hover:border-teal-200'
                }
              `}
            >
              <div className="flex gap-3">
                {/* Thumbnail / Icon */}
                <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-lg shrink-0 overflow-hidden border border-black/5 relative
                    ${isProcessing ? 'bg-teal-50' : isFailed ? 'bg-red-50' : 'bg-gray-50'}
                `}>
                  {item.thumbnail ? (
                      <img src={item.thumbnail} alt="thumb" className="w-full h-full object-cover" />
                  ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-300">
                        {item.result?.type === AnalysisType.MEDICATION ? <Pill size={24} /> : <FileText size={24} />}
                      </div>
                  )}
                  {/* Overlay Icon for Type */}
                  <div className="absolute bottom-0 right-0 p-1 bg-white/90 rounded-tl-lg backdrop-blur-sm">
                      {isProcessing ? <Loader2 size={12} className="animate-spin text-teal-600" /> :
                      isFailed ? <AlertCircle size={12} className="text-red-500" /> :
                      item.result?.type === AnalysisType.MEDICATION ? <Pill size={12} className="text-blue-500" /> : <Activity size={12} className="text-teal-500" />
                      }
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                    {/* Header: Title + Date */}
                    <div className="flex justify-between items-start gap-2">
                      <h4 className="font-bold text-gray-900 text-sm truncate leading-tight">
                          {isProcessing ? t.loadingTitle : 
                          isFailed ? t.errorTitle :
                          item.result?.type === AnalysisType.MEDICATION 
                            ? (item.result.medication?.name || t.unknownLabel)
                            : t.healthReportLabel
                          }
                      </h4>
                      <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap bg-gray-100 px-1.5 py-0.5 rounded">
                          {item.reportDate || formatDateShort(item.timestamp)}
                      </span>
                    </div>

                    {/* Summary */}
                    <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed my-1">
                      {isProcessing ? t.processingWait : 
                        isFailed ? (item.summary || t.errorGeneric) :
                        item.result?.summary}
                    </p>

                    {/* Badges Footer */}
                    <div className="flex items-center gap-2">
                      {isProcessing ? (
                        <span className="text-[10px] font-medium text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-100">
                          {t.statusProcessing}
                        </span>
                      ) : isFailed ? (
                        <span className="text-[10px] font-medium text-red-600 bg-red-50 px-1.5 py-0.5 rounded border border-red-100">
                          {t.statusFailed}
                        </span>
                      ) : (
                        <>
                          <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${
                            item.result?.type === AnalysisType.MEDICATION 
                              ? 'bg-blue-50 text-blue-600 border-blue-100' 
                              : 'bg-teal-50 text-teal-600 border-teal-100'
                          }`}>
                            {item.result?.type === AnalysisType.MEDICATION ? t.medicationLabel : t.reportLabel}
                          </span>
                          
                          {item.result?.type === AnalysisType.REPORT && item.result.indicators && (
                            <span className="text-[10px] text-gray-400 flex items-center gap-0.5">
                              <Activity size={10} /> {item.result.indicators.length}
                            </span>
                          )}
                        </>
                      )}
                    </div>
                </div>
                
                {/* Delete Action */}
                <div className="flex flex-col justify-center border-l border-gray-100 pl-2 ml-1">
                    <button 
                      onClick={(e) => onDelete(e, item.id)}
                      className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
                    </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default HistoryList;
