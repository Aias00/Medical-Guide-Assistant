

import React, { useState } from 'react';
import { Indicator, Language } from '../types';
import { ChevronDown, ChevronUp, AlertCircle, CheckCircle, Info, MinusCircle } from 'lucide-react';
import IndicatorChart from './IndicatorChart';
import { translations } from '../locales';

interface Props {
  indicator: Indicator;
  lang: Language;
}

const IndicatorCard: React.FC<Props> = ({ indicator, lang }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const t = translations[lang];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'HIGH':
      case 'LOW':
      case 'CRITICAL':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'BORDERLINE':
        return 'text-amber-600 bg-amber-50 border-amber-200';
      case 'NORMAL':
        return 'text-teal-700 bg-teal-50 border-teal-200';
      default:
        return 'text-gray-700 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'HIGH':
        return <span className="flex items-center text-xs font-bold uppercase">↑ {t.high}</span>;
      case 'LOW':
        return <span className="flex items-center text-xs font-bold uppercase">↓ {t.low}</span>;
      case 'BORDERLINE':
        return <span className="flex items-center gap-1 text-xs font-bold uppercase"><MinusCircle className="w-3 h-3" /> {t.borderline}</span>;
      case 'CRITICAL':
        return <span className="flex items-center gap-1 text-xs font-bold uppercase"><AlertCircle className="w-3 h-3" /> {t.critical}</span>;
      case 'NORMAL':
        return <CheckCircle className="w-4 h-4" />;
      default:
        return <Info className="w-4 h-4" />;
    }
  };

  return (
    <div 
      className={`mb-3 border rounded-xl overflow-hidden transition-all duration-200 ${getStatusColor(indicator.status)} border-opacity-60 shadow-sm`}
    >
      <div 
        className="p-4 flex items-center justify-between cursor-pointer active:bg-black/5"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-gray-900">{indicator.name}</h3>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider bg-white/60 shadow-sm flex items-center gap-1`}>
              {getStatusIcon(indicator.status)}
            </span>
          </div>
          <p className="text-sm font-mono text-gray-700 font-medium">{indicator.value}</p>
        </div>
        <button className="text-gray-500 hover:text-gray-800">
          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
      </div>

      {isExpanded && (
        <div className="px-4 pb-4 pt-0 text-sm">
          <div className="h-px bg-black/5 w-full mb-3" />
          <div className="space-y-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">{t.interpretation}</p>
              <p className="text-gray-800 leading-relaxed">{indicator.explanation}</p>
            </div>
            
            {/* Visual Chart */}
            <IndicatorChart indicator={indicator} lang={lang} />

            {(indicator.status !== 'NORMAL') && (
              <div className="bg-white/50 p-3 rounded-lg mt-3">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">{t.causes}</p>
                <p className="text-gray-800 leading-relaxed">{indicator.possibleCauses}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default IndicatorCard;