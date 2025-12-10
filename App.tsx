
import React, { useState, useEffect } from 'react';
import { analyzeMedicalImage } from './services/geminiService';
import { analyzeMedicalImageOpenAI } from './services/openaiService';
import { storageService } from './services/storageService';
import { profileService } from './services/profileService';
import { AnalysisResult, AnalysisType, PatientContext, HistoryItem, Language, AiProvider, HistoryStatus, HistoricalValue, ChatMessage, UserProfile } from './types';
import FileUpload from './components/FileUpload';
import IndicatorCard from './components/IndicatorCard';
import MedicationCard from './components/MedicationCard';
import ChatAssistant from './components/ChatAssistant';
import ImageViewer from './components/ImageViewer';
import HistoryList from './components/HistoryList';
import ProfileSelector from './components/ProfileSelector';
import ShareCard from './components/ShareCard';
import html2canvas from 'html2canvas';

import { translations } from './locales';
import { 
  Stethoscope, 
  Activity, 
  ShieldCheck, 
  MessageSquare, 
  AlertOctagon,
  Sparkles,
  HelpCircle,
  ChevronLeft,
  Image as ImageIcon,
  Languages,
  Loader2,
  Copy,
  Check,
  CheckCircle2,
  Calendar,
  ClipboardList,
  Share2
} from 'lucide-react';

const App: React.FC = () => {
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingStepIndex, setLoadingStepIndex] = useState(0); 
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<Language>('zh');
  const [activeHistoryId, setActiveHistoryId] = useState<string | null>(null);
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  // Profile State
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string>('');
  
  // Context State (Now linked to Profile)
  const [reportDate, setReportDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [showContext, setShowContext] = useState(false);

  // History State
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // UI State
  const [questionsCopied, setQuestionsCopied] = useState(false);
  const [fullReportCopied, setFullReportCopied] = useState(false);
  const [generatingShare, setGeneratingShare] = useState(false);

  const provider: AiProvider = process.env.AI_PROVIDER === 'openai' ? 'openai' : 'gemini';
  const t = translations[language];

  // Initialize
  useEffect(() => {
    const init = async () => {
      // 1. Profiles
      const savedProfiles = profileService.getProfiles();
      setProfiles(savedProfiles);
      const lastActive = profileService.getActiveProfileId();
      setActiveProfileId(lastActive);

      // 2. History
      await storageService.migrateFromLocalStorage();
      const stored = await storageService.getAll();
      const cleanedHistory = stored.map(item => {
        if (item.status === 'processing') {
           return { ...item, status: 'failed' as HistoryStatus, result: undefined, summary: t.taskInterrupted };
        }
        return item;
      });
      setHistory(cleanedHistory);
    };
    init();
  }, [t.taskInterrupted]);

  const activeProfile = profiles.find(p => p.id === activeProfileId) || profiles[0];

  // Helper to get Context
  const getCurrentContext = (): PatientContext => {
    return {
      ...activeProfile?.context,
      reportDate: reportDate
    };
  };

  const handleProfileChange = (id: string) => {
    setActiveProfileId(id);
    profileService.setActiveProfileId(id);
  };

  const handleProfilesUpdate = (updated: UserProfile[]) => {
    setProfiles(updated);
  };

  // Filter history based on active profile
  const filteredHistory = history.filter(h => 
    !h.profileId || h.profileId === activeProfileId
  );

  const saveToHistory = async (newItem: HistoryItem) => {
    try {
      const updated = await storageService.saveItem(newItem);
      setHistory(updated);
    } catch (e) {
      console.error("Failed to save to storage", e);
    }
  };

  const deleteHistoryItem = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      const updated = await storageService.deleteItem(id);
      setHistory(updated);
      if (activeHistoryId === id) {
        reset();
      }
    } catch (e) {
      console.error("Failed to delete", e);
    }
  };

  const clearHistory = async () => {
    if (confirm(t.confirmClear)) {
      await storageService.clear();
      setHistory([]);
      reset();
    }
  };

  const loadHistoryItem = (item: HistoryItem) => {
    if (item.status === 'processing') return; 
    
    if (item.result) {
      setResult(item.result);
      setActiveHistoryId(item.id);
      // Restore images from history if available
      setImages(item.originalImages || []); 
      setError(null);
      setReportDate(item.reportDate || new Date().toISOString().split('T')[0]);
      
      // If history item has profileId, switch to it?
      // Optional: enforce consistency or allow viewing other's history
      if (item.profileId && item.profileId !== activeProfileId) {
        // handleProfileChange(item.profileId); // Let's keep context manual for now to avoid jumpiness
      }
      
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const getIndicatorTrend = (indicatorName: string, currentVal: number, currentDate: string): HistoricalValue[] => {
    const trend: HistoricalValue[] = [];
    
    // Only compare within same profile
    const profileHistory = history.filter(h => !h.profileId || h.profileId === activeProfileId);
    
    profileHistory.forEach(item => {
      if (item.status === 'completed' && item.result?.type === AnalysisType.REPORT && item.result.indicators) {
        const match = item.result.indicators.find(i => 
          i.name === indicatorName || i.name.includes(indicatorName) || indicatorName.includes(i.name)
        );
        if (match && match.valueNumber !== undefined) {
          trend.push({
            date: item.reportDate || formatDateShort(item.timestamp),
            value: match.valueNumber,
            isCurrent: false
          });
        }
      }
    });

    trend.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const uniqueTrend: HistoricalValue[] = [];
    const seenDates = new Set();
    trend.forEach(item => {
      if (!seenDates.has(item.date)) {
        seenDates.add(item.date);
        uniqueTrend.push(item);
      }
    });

    return uniqueTrend.map(t => ({...t, isCurrent: t.date === currentDate}));
  };

  const formatDateShort = (timestamp: number) => {
    const d = new Date(timestamp);
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
  };

  const createThumbnail = async (base64: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const maxSize = 100;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > maxSize) { height *= maxSize / width; width = maxSize; }
        } else {
          if (height > maxSize) { width *= maxSize / height; height = maxSize; }
        }
        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.5));
      };
      img.onerror = () => resolve('');
      img.src = base64.startsWith('data:') ? base64 : `data:image/jpeg;base64,${base64}`;
    });
  };

  const handleAnalysis = async (base64List: string[], runInBackground: boolean) => {
    // These are full data URLs including the scheme
    const previewImages = base64List.map(b => `data:image/jpeg;base64,${b}`);
    const taskId = Date.now().toString();
    const thumbnail = await createThumbnail(base64List[0]);
    const currentContext = getCurrentContext();

    const processingItem: HistoryItem = {
      id: taskId,
      profileId: activeProfileId,
      timestamp: Date.now(),
      reportDate: reportDate,
      status: 'processing',
      thumbnail: thumbnail,
      chatHistory: [],
      originalImages: previewImages // Save full resolution images
    };

    if (runInBackground) {
      saveToHistory(processingItem);
      setImages([]);
      setResult(null);
      setError(null);
      setActiveHistoryId(null);
    } else {
      setImages(previewImages);
      setLoading(true);
      setError(null);
      setResult(null);
      setActiveHistoryId(taskId);
    }

    const performAnalysis = async () => {
      try {
        let data: AnalysisResult;
        if (provider === 'openai') {
          data = await analyzeMedicalImageOpenAI(base64List, currentContext, language);
        } else {
          data = await analyzeMedicalImage(base64List, currentContext, language);
        }

        const completedItem: HistoryItem = { ...processingItem, status: 'completed', result: data };
        await saveToHistory(completedItem);

        if (!runInBackground) {
          setResult(data);
          setLoading(false);
          setActiveHistoryId(taskId);
          // Ensure we scroll to top when result is ready
          window.scrollTo(0, 0);
        }
      } catch (err: any) {
        console.error(err);
        const errorMessage = err.message || t.errorGeneric;
        const failedItem: HistoryItem = { ...processingItem, status: 'failed', summary: errorMessage };
        await saveToHistory(failedItem);

        if (!runInBackground) {
          setError(errorMessage);
          setLoading(false);
          setActiveHistoryId(null);
        }
      }
    };
    performAnalysis();
  };

  const handleChatUpdate = async (newMessages: ChatMessage[]) => {
    if (!activeHistoryId) return;
    const currentItem = history.find(h => h.id === activeHistoryId);
    if (currentItem) {
      const updatedItem: HistoryItem = { ...currentItem, chatHistory: newMessages };
      await saveToHistory(updatedItem);
    }
  };

  const handleCopyQuestions = () => {
    if (!result?.questionsForDoctor) return;
    const text = result.questionsForDoctor.map((q, i) => `${i + 1}. ${q}`).join('\n');
    navigator.clipboard.writeText(text);
    setQuestionsCopied(true);
    setTimeout(() => setQuestionsCopied(false), 2000);
  };

  const handleCopyFullReport = () => {
    if (!result) return;
    
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

     let text = `【${t.appTitle}】\n\n${t.summaryTitle}:\n${result.summary}\n\n`;
     
     if (result.type === AnalysisType.REPORT && result.indicators) {
        text += `${t.indicatorsTitle}:\n`;
        result.indicators.forEach(ind => {
            text += `- ${ind.name}: ${ind.value} [${getStatusLabel(ind.status)}]\n`;
            if (ind.status !== 'NORMAL') {
                text += `  ${t.interpretation}: ${ind.explanation}\n`;
            }
        });
        text += '\n';
     }

     if (result.type === AnalysisType.MEDICATION && result.medication) {
        text += `${t.medicationLabel}: ${result.medication.name}\n`;
        text += `${t.usage}: ${result.medication.usage}\n`;
        if (result.medication.warnings.length) {
            text += `${t.warnings}: ${result.medication.warnings.join('; ')}\n`;
        }
        text += '\n';
     }
     
     if (result.questionsForDoctor?.length) {
        text += `${t.questionsTitle}:\n`;
        result.questionsForDoctor.forEach((q, i) => text += `${i+1}. ${q}\n`);
     }

     text += `\n${t.disclaimerTitle} ${t.disclaimerText}`;
     
     navigator.clipboard.writeText(text);
     setFullReportCopied(true);
     setTimeout(() => setFullReportCopied(false), 2000);
  };

  const handleGenerateShareCard = async () => {
    setGeneratingShare(true);
    const element = document.getElementById('share-card-container');
    if (element) {
      try {
        const canvas = await html2canvas(element, { useCORS: true, scale: 2 });
        canvas.toBlob(async (blob) => {
          if (blob) {
            const file = new File([blob], 'health-report.png', { type: 'image/png' });
            if (navigator.share) {
               await navigator.share({ files: [file], title: t.appTitle });
            } else {
               const url = URL.createObjectURL(blob);
               const a = document.createElement('a');
               a.href = url;
               a.download = 'health-report.png';
               a.click();
               URL.revokeObjectURL(url);
            }
          }
          setGeneratingShare(false);
        });
      } catch (e) {
        console.error("Share gen failed", e);
        setGeneratingShare(false);
      }
    }
  };

  const reset = () => {
    setImages([]);
    setResult(null);
    setError(null);
    setActiveHistoryId(null);
  };

  const toggleLanguage = () => {
    setLanguage(prev => prev === 'zh' ? 'en' : 'zh');
  };

  // Effects for loading step
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (loading) {
      setLoadingStepIndex(0);
      interval = setInterval(() => {
        setLoadingStepIndex(prev => prev < (t.loadingSteps?.length || 1) - 1 ? prev + 1 : prev);
      }, 2500);
    }
    return () => clearInterval(interval);
  }, [loading, t.loadingSteps]);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-gray-900 pb-20">
      
      {/* Hidden Share Card */}
      {result && (
        <ShareCard 
          id="share-card-container" 
          result={result} 
          profileName={activeProfile?.name || t.profileMe} 
          reportDate={reportDate} 
        />
      )}

      {viewingImage && (
        <ImageViewer src={viewingImage} onClose={() => setViewingImage(null)} />
      )}

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-teal-700">
            {(result || images.length > 0) && !loading ? (
              <button onClick={reset} className="mr-1 -ml-2 p-1 rounded-full hover:bg-gray-100 text-gray-600">
                <ChevronLeft className="w-6 h-6" />
              </button>
            ) : (
              <Stethoscope className="w-6 h-6" />
            )}
            <h1 className="text-lg font-bold tracking-tight">{t.appTitle}</h1>
          </div>
          <button onClick={toggleLanguage} className="text-gray-500 hover:text-teal-600 p-1.5 rounded-md text-xs font-bold flex gap-1 items-center">
            <Languages size={18} /> {language === 'zh' ? 'EN' : '中文'}
          </button>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 pt-6">
        
        {!result && !loading && !error && (
          <div className="space-y-6 animate-fadeIn">
            <div className="text-center space-y-2 mb-8">
              <h2 className="text-2xl font-bold text-gray-800">{t.heroTitle}</h2>
              <p className="text-gray-500 text-sm">{t.heroSubtitle}</p>
            </div>

            {/* Profile Selector */}
            <ProfileSelector 
              profiles={profiles}
              activeProfileId={activeProfileId}
              onProfileChange={handleProfileChange}
              onProfilesUpdate={handleProfilesUpdate}
              lang={language}
            />

            {/* Date Picker */}
            <div className="bg-white p-3 rounded-xl border border-gray-100 flex items-center justify-between">
              <label className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                <Calendar size={14} /> {t.reportDate}
              </label>
              <input 
                type="date" 
                className="bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
                value={reportDate}
                onChange={(e) => setReportDate(e.target.value)}
              />
            </div>

            <FileUpload onAnalyze={handleAnalysis} isAnalyzing={loading} lang={language} />

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

            {filteredHistory.length > 0 && (
              <HistoryList 
                history={filteredHistory}
                onSelect={loadHistoryItem}
                onDelete={deleteHistoryItem}
                onClear={clearHistory}
                lang={language}
              />
            )}
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="py-12 flex flex-col items-center justify-center animate-fadeIn min-h-[50vh]">
            <div className="mb-8 relative">
              <div className="w-16 h-16 border-4 border-teal-100 border-t-teal-500 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-teal-500 animate-pulse" />
              </div>
            </div>
            <div className="w-full max-w-[280px] space-y-4">
              {t.loadingSteps?.map((step, index) => {
                const isActive = index === loadingStepIndex;
                const isCompleted = index < loadingStepIndex;
                return (
                  <div key={index} className={`flex items-center gap-3 transition-all ${isActive ? 'scale-105' : 'opacity-70'}`}>
                    <div className="shrink-0">
                      {isCompleted ? <CheckCircle2 className="w-5 h-5 text-teal-500" /> : isActive ? <Loader2 className="w-5 h-5 text-teal-600 animate-spin" /> : <div className="w-5 h-5 rounded-full border-2 border-gray-100" />}
                    </div>
                    <span className={`text-sm font-medium ${isActive ? 'text-gray-800' : isCompleted ? 'text-teal-600' : 'text-gray-300'}`}>{step}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-white p-8 rounded-2xl shadow-lg text-center space-y-6 animate-fadeIn mt-10">
            <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto">
              <AlertOctagon className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">{t.errorTitle}</h3>
              <p className="text-gray-500 text-sm mt-2">{error}</p>
            </div>
            <button onClick={reset} className="w-full bg-gray-900 text-white py-3 rounded-xl font-medium shadow-lg">{t.retry}</button>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="space-y-6 animate-fadeIn pb-10">
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex gap-3 items-start shadow-sm">
              <AlertOctagon className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-900 leading-relaxed">
                <strong>{t.disclaimerTitle}</strong> {result.disclaimer || t.disclaimerText}
              </p>
            </div>

            {result.type === AnalysisType.UNKNOWN ? (
               <div className="bg-white p-6 rounded-2xl border border-gray-200 text-center space-y-4">
                 <HelpCircle className="w-12 h-12 text-gray-400 mx-auto" />
                 <h3 className="text-lg font-bold text-gray-800">{t.unknownTitle}</h3>
                 <p className="text-gray-600 text-sm">{t.unknownText}</p>
               </div>
            ) : (
              <>
                <section className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 relative">
                   <div className="flex justify-between items-start mb-3">
                      <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-teal-500" />
                        {t.summaryTitle}
                      </h2>
                      
                      <div className="flex gap-2">
                        <button
                          onClick={handleGenerateShareCard}
                          disabled={generatingShare}
                          className="flex items-center gap-1 text-xs font-medium text-teal-600 bg-teal-50 hover:bg-teal-100 px-2.5 py-1.5 rounded-lg transition-colors"
                        >
                           {generatingShare ? <Loader2 size={14} className="animate-spin" /> : <Share2 size={14} />}
                           {t.shareImage}
                        </button>
                        <button
                          onClick={handleCopyFullReport}
                          className="flex items-center gap-1 text-xs font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 px-2.5 py-1.5 rounded-lg transition-colors"
                        >
                          {fullReportCopied ? <Check size={14} /> : <ClipboardList size={14} />}
                          {fullReportCopied ? t.copied : t.copyFullReport}
                        </button>
                      </div>
                   </div>
                  <p className="text-gray-700 leading-relaxed text-sm">
                    {result.summary}
                  </p>
                </section>

                {result.type === AnalysisType.REPORT && result.indicators && (
                  <section>
                    <div className="flex items-center justify-between mb-4 px-1">
                      <h2 className="text-lg font-bold text-gray-900">{t.indicatorsTitle}</h2>
                      <span className="text-xs bg-gray-200 text-gray-700 px-2.5 py-1 rounded-full font-medium">
                        {t.extractedCount.replace('{count}', result.indicators.length.toString())}
                      </span>
                    </div>
                    <div className="space-y-1">
                      {result.indicators.map((indicator, idx) => {
                         const trend = indicator.valueNumber !== undefined 
                           ? getIndicatorTrend(indicator.name, indicator.valueNumber, reportDate)
                           : undefined;
                         return <IndicatorCard key={idx} indicator={indicator} historyTrend={trend} lang={language} />;
                      })}
                    </div>
                  </section>
                )}

                {result.type === AnalysisType.MEDICATION && result.medication && (
                  <section>
                    <MedicationCard data={result.medication} lang={language} />
                  </section>
                )}

                {result.questionsForDoctor && result.questionsForDoctor.length > 0 && (
                  <section className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl p-6 border border-indigo-100">
                    <div className="flex items-center justify-between mb-4">
                      <h2 className="text-lg font-bold text-indigo-900 flex items-center gap-2">
                        <MessageSquare className="w-5 h-5" />
                        {t.questionsTitle}
                      </h2>
                      <button onClick={handleCopyQuestions} className="flex items-center gap-1.5 text-xs font-medium text-indigo-600 bg-indigo-100 px-3 py-1.5 rounded-lg">
                        {questionsCopied ? <Check size={14} /> : <Copy size={14} />}
                        {questionsCopied ? t.copied : t.copy}
                      </button>
                    </div>
                    <ul className="space-y-3">
                      {result.questionsForDoctor.map((q, idx) => (
                        <li key={idx} className="flex gap-3 bg-white p-3 rounded-xl text-sm text-indigo-900 shadow-sm border border-indigo-50/50">
                          <span className="font-bold text-indigo-400 select-none bg-indigo-50 w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs">{idx + 1}</span>
                          <span className="mt-0.5">{q}</span>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                <ChatAssistant 
                  analysisResult={result} 
                  lang={language} 
                  initialMessages={activeHistoryId && history.find(h => h.id === activeHistoryId)?.chatHistory || []}
                  onMessagesUpdate={handleChatUpdate}
                  suggestedQuestions={result.questionsForDoctor || []}
                />
              </>
            )}

            {images.length > 0 && (
              <div className="mt-8 border-t border-gray-200 pt-6">
                <h3 className="text-sm font-bold text-gray-500 mb-3 uppercase tracking-wider flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" />
                  {t.originalImages} ({images.length})
                </h3>
                <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar snap-x snap-mandatory">
                  {images.map((img, index) => (
                    <div key={index} className="relative group cursor-pointer snap-start shrink-0" onClick={() => setViewingImage(img)}>
                      <img src={img} alt={`Original ${index + 1}`} className="h-24 w-24 object-cover rounded-xl border border-gray-200 shadow-sm transition-all hover:shadow-md" />
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
