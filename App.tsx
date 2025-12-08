import React, { useState, useEffect } from 'react';
import { analyzeMedicalImage } from './services/geminiService';
import { analyzeMedicalImageOpenAI } from './services/openaiService';
import { AnalysisResult, AnalysisType, PatientContext, HistoryItem, Language, AiProvider, HistoryStatus } from './types';
import FileUpload from './components/FileUpload';
import IndicatorCard from './components/IndicatorCard';
import MedicationCard from './components/MedicationCard';
import { translations } from './locales';
import { 
  Stethoscope, 
  Activity, 
  ShieldCheck, 
  MessageSquare, 
  UserCircle2,
  AlertOctagon,
  Sparkles,
  HelpCircle,
  ChevronLeft,
  Clock,
  Trash2,
  ChevronRight,
  FileText,
  Pill,
  Image as ImageIcon,
  Languages,
  Loader2,
  AlertCircle
} from 'lucide-react';

const App: React.FC = () => {
  // Now storing multiple images
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<Language>('zh');
  
  // Configuration driven provider
  const provider: AiProvider = process.env.AI_PROVIDER === 'openai' ? 'openai' : 'gemini';
  
  // Basic Context State
  const [context, setContext] = useState<PatientContext>({ age: '', gender: '', condition: '' });
  const [showContext, setShowContext] = useState(false);

  // History State
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Translations helper
  const t = translations[language];

  // Load history on mount
  useEffect(() => {
    const saved = localStorage.getItem('medical_guide_history');
    if (saved) {
      try {
        const parsedHistory: HistoryItem[] = JSON.parse(saved);
        // Mark any stuck "processing" items as "failed" on boot since we can't resume the promise
        const cleanedHistory = parsedHistory.map(item => {
          if (item.status === 'processing') {
             return { ...item, status: 'failed' as HistoryStatus, result: undefined, summary: t.taskInterrupted };
          }
          return item;
        });
        setHistory(cleanedHistory);
        // Save cleaned history back
        if (JSON.stringify(cleanedHistory) !== saved) {
          localStorage.setItem('medical_guide_history', JSON.stringify(cleanedHistory));
        }
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, [t.taskInterrupted]);

  const saveToHistory = (newItem: HistoryItem) => {
    setHistory(prev => {
      // Check if item exists (update) or is new (insert)
      const exists = prev.find(i => i.id === newItem.id);
      let updatedHistory;
      if (exists) {
        updatedHistory = prev.map(i => i.id === newItem.id ? newItem : i);
      } else {
        updatedHistory = [newItem, ...prev];
      }
      updatedHistory = updatedHistory.slice(0, 50); // Limit to 50
      
      try {
        localStorage.setItem('medical_guide_history', JSON.stringify(updatedHistory));
      } catch (e) {
        console.error("Failed to save history to localStorage", e);
      }
      return updatedHistory;
    });
  };

  const deleteHistoryItem = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = history.filter(h => h.id !== id);
    setHistory(updated);
    localStorage.setItem('medical_guide_history', JSON.stringify(updated));
  };

  const clearHistory = () => {
    if (confirm(t.confirmClear)) {
      setHistory([]);
      localStorage.removeItem('medical_guide_history');
    }
  };

  const loadHistoryItem = (item: HistoryItem) => {
    if (item.status === 'processing') return; // Cannot load processing item
    if (item.status === 'failed') return; // Failed item logic (maybe show retry?)
    
    if (item.result) {
      setResult(item.result);
      setImages([]); // History doesn't store full images
      setError(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleAnalysis = async (base64List: string[], runInBackground: boolean) => {
    const previewImages = base64List.map(b => `data:image/jpeg;base64,${b}`);
    const taskId = Date.now().toString();

    // 1. Create a "Processing" history item immediately
    const processingItem: HistoryItem = {
      id: taskId,
      timestamp: Date.now(),
      status: 'processing',
      thumbnail: previewImages[0] // Save a small preview if needed, or we rely on placeholders
    };

    // If background mode, add to history immediately and reset UI
    if (runInBackground) {
      saveToHistory(processingItem);
      // Reset UI to allow user to do other things
      setImages([]);
      setResult(null);
      setError(null);
      // We do NOT set global 'loading' state in background mode
      
      // Clear inputs for fresh start
      setContext({ age: '', gender: '', condition: '' });
    } else {
      // Foreground mode: standard loading state
      setImages(previewImages);
      setLoading(true);
      setError(null);
      setResult(null);
    }

    // 2. Define the async task
    const performAnalysis = async () => {
      try {
        let data: AnalysisResult;
        // Pass current context (closure captures the value at start time, safe even if context state resets)
        const currentContext = { ...context };
        
        if (provider === 'openai') {
          data = await analyzeMedicalImageOpenAI(base64List, currentContext, language);
        } else {
          data = await analyzeMedicalImage(base64List, currentContext, language);
        }

        // Success Update
        const completedItem: HistoryItem = {
          ...processingItem,
          status: 'completed',
          result: data
        };
        saveToHistory(completedItem);

        // If we were waiting in foreground, update the view immediately
        if (!runInBackground) {
          setResult(data);
          setLoading(false);
        }

      } catch (err: any) {
        console.error(err);
        const errorMessage = err.message || t.errorGeneric;
        
        // Failure Update
        const failedItem: HistoryItem = {
          ...processingItem,
          status: 'failed'
          // We could store the error message in the result summary for display in history
        };
        saveToHistory(failedItem);

        if (!runInBackground) {
          setError(errorMessage);
          setLoading(false);
        }
      }
    };

    // 3. Kick off the task
    performAnalysis();
  };

  const reset = () => {
    setImages([]);
    setResult(null);
    setError(null);
  };

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'zh' ? 'en' : 'zh');
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleString(language === 'en' ? 'en-US' : 'zh-CN', {
      month: 'numeric',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-gray-900 pb-20">
      
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-teal-700">
            {(result || images.length > 0) && !loading ? (
              <button 
                onClick={reset}
                className="mr-1 -ml-2 p-1 rounded-full text-gray-600 hover:bg-gray-100 hover:text-teal-700 transition-colors flex items-center"
                aria-label={t.back}
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            ) : (
              <Stethoscope className="w-6 h-6" />
            )}
            <h1 className="text-lg font-bold tracking-tight">{t.appTitle}</h1>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={toggleLanguage}
              className="text-gray-500 hover:text-teal-600 p-1.5 rounded-md hover:bg-gray-100 transition-colors flex items-center gap-1 text-xs font-bold border border-transparent hover:border-gray-200"
            >
              <Languages size={18} />
              {language === 'zh' ? 'EN' : '中文'}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-md mx-auto px-4 pt-6">
        
        {/* Intro / Context Selection / Upload */}
        {!result && !loading && !error && (
          <div className="space-y-6 animate-fadeIn">
            <div className="text-center space-y-2 mb-8">
              <h2 className="text-2xl font-bold text-gray-800">{t.heroTitle}</h2>
              <p className="text-gray-500 text-sm">{t.heroSubtitle}</p>
            </div>

            {/* Context Toggle */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 transition-all">
              <button 
                onClick={() => setShowContext(!showContext)}
                className="flex items-center justify-between w-full text-sm font-medium text-gray-600 mb-2"
              >
                <div className="flex items-center gap-2">
                  <UserCircle2 size={18} className="text-teal-600" />
                  <span>{t.userInfo}</span>
                </div>
                <span className="text-teal-600 text-xs bg-teal-50 px-2 py-1 rounded-md">{showContext ? t.collapse : t.expand}</span>
              </button>
              
              {showContext && (
                <div className="space-y-3 mt-4 pt-2 border-t border-gray-50 animate-fadeIn">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">{t.age}</label>
                      <input 
                        type="text" 
                        placeholder="例如: 65" 
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                        value={context.age}
                        onChange={(e) => setContext({...context, age: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">{t.gender}</label>
                      <select 
                        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                        value={context.gender}
                        onChange={(e) => setContext({...context, gender: e.target.value})}
                      >
                        <option value="">{t.notSelected}</option>
                        <option value="男">{t.male}</option>
                        <option value="女">{t.female}</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">{t.history}</label>
                    <input 
                      type="text" 
                      placeholder={t.historyPlaceholder} 
                      className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                      value={context.condition}
                      onChange={(e) => setContext({...context, condition: e.target.value})}
                    />
                  </div>
                </div>
              )}
            </div>

            <FileUpload onAnalyze={handleAnalysis} isAnalyzing={loading} lang={language} />

            {/* Feature Pills */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white p-3 rounded-xl border border-gray-100 flex flex-col items-center gap-2 text-center shadow-sm">
                <Activity className="text-teal-500 w-5 h-5" />
                <span className="text-xs font-medium text-gray-600">{t.featureIndicators}</span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-gray-100 flex flex-col items-center gap-2 text-center shadow-sm">
                <ShieldCheck className="text-blue-500 w-5 h-5" />
                <span className="text-xs font-medium text-gray-600">{t.featureSafety}</span>
              </div>
              <div className="bg-white p-3 rounded-xl border border-gray-100 flex flex-col items-center gap-2 text-center shadow-sm">
                <MessageSquare className="text-purple-500 w-5 h-5" />
                <span className="text-xs font-medium text-gray-600">{t.featureAdvice}</span>
              </div>
            </div>

            {/* History Section */}
            {history.length > 0 && (
              <div className="pt-6 animate-fadeIn">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-gray-800 flex items-center gap-2 text-sm uppercase tracking-wide">
                    <Clock className="w-4 h-4 text-gray-400" />
                    {t.historyTitle}
                  </h3>
                  <button onClick={clearHistory} className="text-xs text-gray-400 hover:text-red-500 transition-colors">
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
                        onClick={() => loadHistoryItem(item)}
                        className={`bg-white rounded-xl p-4 border transition-all relative group
                          ${isProcessing ? 'border-teal-200 bg-teal-50/50 cursor-wait' : 
                            isFailed ? 'border-red-200 bg-red-50/30 cursor-default' : 
                            'border-gray-100 shadow-sm active:scale-[0.98] cursor-pointer hover:border-teal-100'
                          }
                        `}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex gap-3 overflow-hidden">
                            {/* Icon / Status */}
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-colors
                              ${isProcessing ? 'bg-teal-100 text-teal-600' : 
                                isFailed ? 'bg-red-100 text-red-500' :
                                item.result?.type === AnalysisType.MEDICATION ? 'bg-blue-50 text-blue-500' : 'bg-teal-50 text-teal-500'}`}
                            >
                              {isProcessing ? <Loader2 size={20} className="animate-spin" /> : 
                               isFailed ? <AlertCircle size={20} /> :
                               item.result?.type === AnalysisType.MEDICATION ? <Pill size={20} /> : <FileText size={20} />
                              }
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                 <p className="text-xs font-medium text-gray-400">{formatDate(item.timestamp)}</p>
                                 {/* Status Label */}
                                 {isProcessing && (
                                   <span className="flex items-center gap-1 text-[10px] bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded border border-teal-200">
                                     <Loader2 className="w-3 h-3 animate-spin" />
                                     <span className="animate-pulse">{t.statusProcessing}</span>
                                   </span>
                                 )}
                                 {isFailed && (
                                   <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded">
                                     {t.statusFailed}
                                   </span>
                                 )}
                                 {!isProcessing && !isFailed && item.result && (
                                   <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                                     {item.result.type === AnalysisType.MEDICATION ? t.medicationLabel : t.reportLabel}
                                   </span>
                                 )}
                              </div>
                              
                              {/* Title */}
                              <p className="text-sm font-bold text-gray-800 truncate leading-snug">
                                {isProcessing ? t.loadingTitle : 
                                 isFailed ? t.errorTitle :
                                 item.result?.type === AnalysisType.MEDICATION 
                                   ? item.result.medication?.name || t.unknownLabel
                                   : t.healthReportLabel
                                }
                              </p>
                              
                              {/* Summary / Subtext */}
                              <p className="text-xs text-gray-500 truncate mt-1">
                                {isProcessing ? t.processingWait : 
                                 isFailed ? t.errorGeneric :
                                 item.result?.summary}
                              </p>
                            </div>
                          </div>
                          
                          <div className="flex flex-col items-end justify-between self-stretch">
                             <button 
                               onClick={(e) => deleteHistoryItem(e, item.id)}
                               className="p-1.5 -mr-1.5 text-gray-300 hover:text-red-400 hover:bg-red-50 rounded-full transition-colors z-10"
                             >
                               <Trash2 size={14} />
                             </button>
                             {item.status === 'completed' && (
                               <ChevronRight size={16} className="text-gray-300 group-hover:text-teal-500 transition-colors" />
                             )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Loading State (Only for Foreground) */}
        {loading && (
          <div className="py-20 flex flex-col items-center justify-center text-center space-y-8 animate-fadeIn">
            <div className="relative">
              <div className="w-20 h-20 border-4 border-teal-100 border-t-teal-500 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles className="w-8 h-8 text-teal-500 animate-pulse" />
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="text-xl font-bold text-gray-800">{t.loadingTitle}</h3>
              <p className="text-gray-500 text-sm max-w-[240px] mx-auto leading-relaxed">
                {t.loadingSubtitle.replace('{model}', provider === 'gemini' ? t.gemini : t.openai)}
              </p>
            </div>
          </div>
        )}

        {/* Error State (Only for Foreground) */}
        {error && (
          <div className="bg-white p-8 rounded-2xl shadow-lg text-center space-y-6 animate-fadeIn mt-10">
            <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto">
              <AlertOctagon className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">{t.errorTitle}</h3>
              <p className="text-gray-500 text-sm mt-2">{error}</p>
            </div>
            <button 
              onClick={reset}
              className="w-full bg-gray-900 text-white py-3 rounded-xl font-medium shadow-lg shadow-gray-200 active:scale-95 transition-transform"
            >
              {t.retry}
            </button>
          </div>
        )}

        {/* Results View */}
        {result && (
          <div className="space-y-6 animate-fadeIn pb-10">
            
            {/* Disclaimer Banner - Always Visible */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 items-start shadow-sm">
              <AlertOctagon className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-900 leading-relaxed">
                <strong>{t.disclaimerTitle}</strong> {result.disclaimer || t.disclaimerText}
              </p>
            </div>

            {/* Unknown Type Handling */}
            {result.type === AnalysisType.UNKNOWN ? (
               <div className="bg-white p-6 rounded-2xl border border-gray-200 text-center space-y-4">
                 <HelpCircle className="w-12 h-12 text-gray-400 mx-auto" />
                 <h3 className="text-lg font-bold text-gray-800">{t.unknownTitle}</h3>
                 <p className="text-gray-600 text-sm">
                   {t.unknownText}
                 </p>
               </div>
            ) : (
              <>
                {/* Summary Section */}
                <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
                  <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-teal-500" />
                    {t.summaryTitle}
                  </h2>
                  <p className="text-gray-700 leading-relaxed text-sm">
                    {result.summary}
                  </p>
                </section>

                {/* Dynamic Content based on Type */}
                {result.type === AnalysisType.REPORT && result.indicators && (
                  <section>
                    <div className="flex items-center justify-between mb-4 px-1">
                      <h2 className="text-lg font-bold text-gray-900">{t.indicatorsTitle}</h2>
                      <span className="text-xs bg-gray-200 text-gray-700 px-2.5 py-1 rounded-full font-medium">
                        {t.extractedCount.replace('{count}', result.indicators.length.toString())}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {result.indicators.map((indicator, idx) => (
                        <IndicatorCard key={idx} indicator={indicator} lang={language} />
                      ))}
                    </div>
                  </section>
                )}

                {result.type === AnalysisType.MEDICATION && result.medication && (
                  <section>
                    <MedicationCard data={result.medication} lang={language} />
                  </section>
                )}

                {/* Questions for Doctor */}
                {result.questionsForDoctor && result.questionsForDoctor.length > 0 && (
                  <section className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl p-6 border border-indigo-100">
                    <h2 className="text-lg font-bold text-indigo-900 mb-4 flex items-center gap-2">
                      <MessageSquare className="w-5 h-5" />
                      {t.questionsTitle}
                    </h2>
                    <ul className="space-y-3">
                      {result.questionsForDoctor.map((q, idx) => (
                        <li key={idx} className="flex gap-3 bg-white p-3 rounded-xl text-sm text-indigo-900 shadow-sm border border-indigo-50/50">
                          <span className="font-bold text-indigo-400 select-none bg-indigo-50 w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs">
                            {idx + 1}
                          </span>
                          <span className="mt-0.5">{q}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </>
            )}

            {/* Original Images Preview Gallery */}
            {images.length > 0 && (
              <div className="mt-8 border-t border-gray-200 pt-6">
                <h3 className="text-sm font-bold text-gray-500 mb-3 uppercase tracking-wider flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" />
                  {t.originalImages} ({images.length})
                </h3>
                <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar snap-x snap-mandatory">
                  {images.map((img, index) => (
                    <div 
                      key={index} 
                      className="relative group cursor-pointer snap-start shrink-0" 
                      onClick={() => window.open(img)}
                    >
                      <img 
                        src={img} 
                        alt={`Original ${index + 1}`} 
                        className="h-24 w-24 object-cover rounded-xl border border-gray-200 shadow-sm transition-all hover:shadow-md" 
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 rounded-xl transition-colors" />
                    </div>
                  ))}
                </div>
              </div>
            )}
            
          </div>
        )}

      </main>
    </div>
  );
};

export default App;