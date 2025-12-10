

import React, { useState } from 'react';
import { Indicator, Language, HistoricalValue } from '../types';
import { ChevronDown, ChevronUp, AlertCircle, CheckCircle, Info, MinusCircle, Share2, Check, Volume2 } from 'lucide-react';
import IndicatorChart from './IndicatorChart';
import { translations } from '../locales';

interface Props {
  indicator: Indicator;
  historyTrend?: HistoricalValue[]; // Global history across reports
  lang: Language;
}

const IndicatorCard: React.FC<Props> = ({ indicator, historyTrend, lang }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isShared, setIsShared] = useState(false);
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

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'HIGH': return t.high;
      case 'LOW': return t.low;
      case 'BORDERLINE': return t.borderline;
      case 'CRITICAL': return t.critical;
      case 'NORMAL': return t.normal;
      default: return status;
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

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    const textToShare = `【${t.appTitle}】\n${indicator.name}: ${indicator.value}\n${t.interpretation}: ${getStatusLabel(indicator.status)}\n\n${indicator.explanation}`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: indicator.name,
          text: textToShare
        });
      } catch (error) {
        console.log("Share canceled or failed", error);
      }
    } else {
      try {
        await navigator.clipboard.writeText(textToShare);
        setIsShared(true);
        setTimeout(() => setIsShared(false), 2000);
      } catch (err) {
        console.error("Copy failed", err);
      }
    }
  };

  const handleSpeak = (e: React.MouseEvent) => {
    e.stopPropagation();
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(indicator.name);
      // Ensure we speak in the target language (which usually matches the text)
      utterance.lang = lang === 'zh' ? 'zh-CN' : 'en-US';
      window.speechSynthesis.speak(utterance);
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
            <button
              onClick={handleSpeak}
              className="text-gray-400 hover:text-teal-600 p-1 rounded-full hover:bg-white/50 transition-colors"
              title={t.playAudio}
            >
              <Volume2 size={14} />
            </button>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider bg-white/60 shadow-sm flex items-center gap-1 ml-1`}>
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
          <div className="flex items-center justify-between mb-3 mt-1">
            <div className="h-px bg-black/5 flex-1" />
            <button 
              onClick={handleShare}
              className="ml-3 flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-teal-600 transition-colors bg-white/50 px-2 py-1 rounded-lg"
            >
              {isShared ? <Check size={12} /> : <Share2 size={12} />}
              {isShared ? t.copied : t.share}
            </button>
          </div>
          
          <div className="space-y-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-1">{t.interpretation}</p>
              <p className="text-gray-800 leading-relaxed">{indicator.explanation}</p>
            </div>
            
            {/* Visual Chart with aggregated history if available */}
            <IndicatorChart indicator={indicator} globalHistory={historyTrend} lang={lang} />

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
