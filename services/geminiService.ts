
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AnalysisResult, AnalysisType, PatientContext, Language, ChatMessage } from "../types";

// --- CONFIGURATION ---
// If BACKEND_URL is set (e.g. "https://my-medical-app.run.app"), the app will use the backend.
// Otherwise, it falls back to client-side API calls (Current Demo Mode).
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || ""; 

// Initialize the client-side SDK (Fallback)
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- SCHEMAS (Kept for client-side fallback) ---
const indicatorSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: "Name of the medical indicator" },
    value: { type: Type.STRING, description: "Original string value" },
    valueNumber: { type: Type.NUMBER, description: "Numeric value from 'value'. Null if non-numeric." },
    unit: { type: Type.STRING, description: "Unit (e.g. mg/dL)" },
    status: { 
      type: Type.STRING, 
      enum: ['HIGH', 'LOW', 'NORMAL', 'CRITICAL', 'BORDERLINE', 'UNKNOWN'],
      description: "Status" 
    },
    explanation: { type: Type.STRING, description: "Very short explanation (max 15 words)" },
    possibleCauses: { type: Type.STRING, description: "Common reasons (max 15 words)" },
    referenceRange: {
      type: Type.OBJECT,
      properties: {
        min: { type: Type.NUMBER },
        max: { type: Type.NUMBER }
      },
      description: "Min/max numeric range"
    },
    history: {
      type: Type.ARRAY,
      description: "Previous values from columns like 'Last Visit'",
      items: {
        type: Type.OBJECT,
        properties: {
          date: { type: Type.STRING, description: "Date or label" },
          value: { type: Type.NUMBER }
        }
      }
    }
  },
  required: ["name", "value", "status", "explanation", "possibleCauses"]
};

const medicationSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: "Medication name" },
    usage: { type: Type.STRING, description: "Dosage instructions" },
    warnings: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING },
      description: "Critical warnings"
    },
    sideEffects: { type: Type.STRING, description: "Side effects" },
    tips: { type: Type.STRING, description: "Tips" }
  },
  required: ["name", "usage", "warnings", "sideEffects", "tips"]
};

const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    type: { 
      type: Type.STRING, 
      enum: [AnalysisType.REPORT, AnalysisType.MEDICATION, AnalysisType.UNKNOWN],
    },
    summary: { type: Type.STRING, description: "Brief summary." },
    indicators: { 
      type: Type.ARRAY, 
      items: indicatorSchema,
      description: "List of indicators"
    },
    medication: {
      type: Type.OBJECT,
      ...medicationSchema,
      description: "Medication info"
    },
    questionsForDoctor: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING },
      description: "3-5 Questions to ask doctor." 
    },
    disclaimer: { type: Type.STRING, description: "Disclaimer." }
  },
  required: ["type", "summary", "questionsForDoctor", "disclaimer"]
};

// --- HELPER FUNCTIONS ---

const analyzeViaBackend = async (
  base64Images: string[], 
  context?: PatientContext,
  language: Language = 'zh'
): Promise<AnalysisResult> => {
  const response = await fetch(`${BACKEND_URL}/api/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ images: base64Images, context, language })
  });
  
  if (!response.ok) {
    const err = await response.json();
    throw new Error(err.error || "Backend Analysis Failed");
  }
  return await response.json();
};

const chatViaBackend = async (
  history: ChatMessage[], 
  newMessage: string, 
  analysisContext: AnalysisResult,
  language: Language = 'zh'
): Promise<string> => {
  const response = await fetch(`${BACKEND_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ history, message: newMessage, analysisContext, language })
  });

  if (!response.ok) {
    throw new Error("Backend Chat Failed");
  }
  const data = await response.json();
  return data.text;
};

// --- EXPORTED FUNCTIONS ---

export const analyzeMedicalImage = async (
  base64Images: string[], 
  context?: PatientContext,
  language: Language = 'zh'
): Promise<AnalysisResult> => {
  
  // 1. BACKEND MODE
  if (BACKEND_URL) {
    console.log("Using Backend API");
    return analyzeViaBackend(base64Images, context, language);
  }

  // 2. CLIENT-SIDE MODE (Fallback)
  console.log("Using Client-Side Gemini SDK");
  const languageName = language === 'en' ? 'ENGLISH' : 'CHINESE (Simplified)';

  const systemInstruction = `
    You are a supportive, professional Medical Interpreter Assistant. 
    
    CRITICAL RULES:
    1. DO NOT provide a medical diagnosis.
    2. ALWAYS include a disclaimer.
    3. Translate complex jargon into simple language.
    4. Context: Age ${context?.age || 'N/A'}, Gender ${context?.gender || 'N/A'}, Condition ${context?.condition || 'N/A'}.
    5. Output Language: ${languageName}.
    6. **EXTREMELY CONCISE**: Keep explanations UNDER 15 WORDS. This is vital to prevent response truncation.
    
    ANALYSIS LOGIC:
    - Multi-page support: Merge info from all images.
    - REPORTS: 
      - Extract 'valueNumber', 'unit', 'referenceRange'. 
      - Extract 'history' column data if present.
    - MEDICATION: Summarize usage, warnings.
  `;

  try {
    const imageParts = base64Images.map(img => ({
      inlineData: {
        mimeType: 'image/jpeg',
        data: img
      }
    }));

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: {
        parts: [
          ...imageParts,
          {
            text: `Analyze images. Extract structured data. Respond in ${languageName}.`
          }
        ]
      },
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.1,
        maxOutputTokens: 16384, // Increased limit for supported models
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response from AI");
    }

    const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();

    try {
      return JSON.parse(cleanedText) as AnalysisResult;
    } catch (parseError) {
      console.error("JSON Parse Error:", parseError);
      
      // Attempt BASIC repair for truncated JSON
      try {
        let fixedText = cleanedText;
        if (fixedText.lastIndexOf('}]') === -1 && fixedText.includes('"indicators": [')) {
            const lastItemEnd = fixedText.lastIndexOf('}');
            if (lastItemEnd > fixedText.indexOf('"indicators": [')) {
                fixedText = fixedText.substring(0, lastItemEnd + 1) + '] }';
                return JSON.parse(fixedText) as AnalysisResult;
            }
        }
      } catch (repairError) {
        console.error("JSON Repair Failed:", repairError);
      }

      if (cleanedText.length > 10000) {
        throw new Error(language === 'zh' 
          ? "报告内容极长，分析结果被截断。建议您分批上传图片（每次1-2张）以获得完整结果。"
          : "The report is too long and the result was truncated. Please try uploading fewer pages (1-2 at a time)."
        );
      }
      throw new Error(language === 'zh'
        ? "数据解析失败 (JSON Error)，请确保图片清晰或稍后重试。"
        : "Failed to parse analysis data (JSON Error). Please ensure images are clear or try again."
      );
    }

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};

export const sendChatMessage = async (
  history: ChatMessage[], 
  newMessage: string, 
  analysisContext: AnalysisResult,
  language: Language = 'zh'
): Promise<string> => {
  
  // 1. BACKEND MODE
  if (BACKEND_URL) {
    return chatViaBackend(history, newMessage, analysisContext, language);
  }

  // 2. CLIENT-SIDE MODE
  const languageName = language === 'en' ? 'ENGLISH' : 'CHINESE (Simplified)';

  const systemInstruction = `
    You are a helpful, empathetic medical assistant. Chat with user about their report.
    
    CONTEXT:
    Analysis: ${JSON.stringify(analysisContext).substring(0, 10000)} ... (truncated if too long)

    RULES:
    1. Answer based on context.
    2. DO NOT diagnose.
    3. Keep answers concise.
    4. Respond in ${languageName}.
  `;

  try {
    const recentHistory = history.slice(-6); // Reduced history context

    const contents = recentHistory.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.content }]
    }));

    contents.push({
      role: 'user',
      parts: [{ text: newMessage }]
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
      }
    });

    return response.text || "I'm sorry, I couldn't generate a response.";

  } catch (error) {
    console.error("Chat Error:", error);
    throw error;
  }
};
