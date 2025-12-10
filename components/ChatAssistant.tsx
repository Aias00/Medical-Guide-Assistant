
import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, User, Loader2, MessageSquare, Sparkles, Mic, MicOff, Volume2 } from 'lucide-react';
import { AnalysisResult, ChatMessage, Language } from '../types';
import { sendChatMessage } from '../services/geminiService';
import { translations } from '../locales';

interface Props {
  analysisResult: AnalysisResult;
  lang: Language;
  initialMessages?: ChatMessage[];
  onMessagesUpdate?: (messages: ChatMessage[]) => void;
  suggestedQuestions?: string[];
}

// Add type definition for Web Speech API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const ChatAssistant: React.FC<Props> = ({ 
  analysisResult, 
  lang, 
  initialMessages = [], 
  onMessagesUpdate,
  suggestedQuestions = []
}) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);
  const t = translations[lang];

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Sync with initialMessages if they change externally (e.g. switching history items)
  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  const handleSend = async (textOverride?: string) => {
    const textToSend = textOverride || input;
    if (!textToSend.trim() || isLoading) return;

    const newMessages: ChatMessage[] = [
      ...messages,
      { role: 'user', content: textToSend }
    ];

    setMessages(newMessages);
    onMessagesUpdate?.(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const responseText = await sendChatMessage(newMessages, textToSend, analysisResult, lang);
      
      const finalMessages: ChatMessage[] = [
        ...newMessages,
        { role: 'model', content: responseText }
      ];
      setMessages(finalMessages);
      onMessagesUpdate?.(finalMessages);
    } catch (error) {
      console.error(error);
      const errorMessages: ChatMessage[] = [
        ...newMessages,
        { role: 'model', content: lang === 'zh' ? '抱歉，我现在无法回答。请稍后再试。' : 'Sorry, I cannot answer right now. Please try again later.' }
      ];
      setMessages(errorMessages);
      onMessagesUpdate?.(errorMessages);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      return;
    }

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      alert(t.voiceInputNotSupported);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognitionRef.current = new SpeechRecognition();
    recognitionRef.current.lang = lang === 'zh' ? 'zh-CN' : 'en-US';
    recognitionRef.current.continuous = false;
    recognitionRef.current.interimResults = false;

    recognitionRef.current.onstart = () => {
      setIsListening(true);
    };

    recognitionRef.current.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current.onerror = (event: any) => {
      console.error("Speech recognition error", event.error);
      setIsListening(false);
    };

    recognitionRef.current.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      if (transcript) {
        setInput(prev => prev + (prev ? ' ' : '') + transcript);
      }
    };

    recognitionRef.current.start();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-[500px]">
      {/* Header */}
      <div className="bg-teal-600 p-4 text-white flex items-center justify-between shrink-0">
        <div>
          <h2 className="font-bold flex items-center gap-2">
            <Bot size={20} />
            {t.chatTitle}
          </h2>
          <p className="text-teal-100 text-xs mt-0.5">{t.chatSubtitle}</p>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/50">
        {messages.length === 0 && (
          <div className="text-center text-gray-400 my-8 space-y-2">
            <Bot size={32} className="mx-auto text-teal-200" />
            <p className="text-sm">{t.chatPlaceholder}</p>
          </div>
        )}

        {messages.map((msg, idx) => (
          <div 
            key={idx} 
            className={`flex items-start gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div 
              className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 
                ${msg.role === 'user' ? 'bg-gray-800 text-white' : 'bg-teal-100 text-teal-700'}`
              }
            >
              {msg.role === 'user' ? <User size={14} /> : <Bot size={14} />}
            </div>
            <div 
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm
                ${msg.role === 'user' 
                  ? 'bg-gray-800 text-white rounded-tr-sm' 
                  : 'bg-white text-gray-800 border border-gray-100 rounded-tl-sm'}`
              }
            >
              {msg.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex items-start gap-2.5">
             <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center shrink-0">
               <Bot size={14} />
             </div>
             <div className="bg-white border border-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm flex items-center gap-2 text-gray-500 text-sm">
               <Loader2 size={14} className="animate-spin" />
               {t.thinking}
             </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Questions (Quick Ask) */}
      {!isLoading && suggestedQuestions.length > 0 && (
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 overflow-x-auto whitespace-nowrap no-scrollbar flex gap-2">
          <div className="flex items-center gap-1 text-xs font-bold text-teal-600 mr-1 sticky left-0 bg-gray-50 pr-2">
            <Sparkles size={12} />
            {t.featureAdvice}:
          </div>
          {suggestedQuestions.map((q, i) => (
            <button
              key={i}
              onClick={() => handleSend(q)}
              className="inline-block px-3 py-1 bg-white border border-teal-100 text-teal-700 text-xs rounded-full hover:bg-teal-50 hover:border-teal-200 transition-colors shadow-sm"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input Area */}
      <div className="p-3 bg-white border-t border-gray-100 shrink-0">
        <div className="relative flex items-end gap-2">
          {/* Voice Input Button */}
          <button
            onClick={toggleListening}
            className={`p-3 rounded-xl transition-all duration-200 flex items-center justify-center
              ${isListening 
                ? 'bg-red-50 text-red-500 animate-pulse border border-red-200' 
                : 'bg-gray-50 text-gray-400 hover:text-teal-600 hover:bg-teal-50 border border-transparent'
              }
            `}
            title={t.voiceInput}
          >
            {isListening ? <MicOff size={20} /> : <Mic size={20} />}
          </button>

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyPress}
            placeholder={isListening ? t.listening : t.chatPlaceholder}
            className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:bg-white resize-none max-h-32 min-h-[46px]"
            rows={1}
            style={{ minHeight: '46px' }}
          />
          <button
            onClick={() => handleSend()}
            disabled={!input.trim() || isLoading}
            className={`p-3 rounded-xl flex items-center justify-center transition-all
              ${!input.trim() || isLoading 
                ? 'bg-gray-100 text-gray-300 cursor-not-allowed' 
                : 'bg-teal-600 text-white shadow-lg shadow-teal-200 hover:bg-teal-700 active:scale-95'}`
              }
          >
            <Send size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatAssistant;
