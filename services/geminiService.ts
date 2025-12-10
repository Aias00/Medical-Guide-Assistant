import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AnalysisResult, AnalysisType, PatientContext, Language, ChatMessage } from "../types";

// Initialize the client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Define the schema for the output
const indicatorSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: "Name of the medical indicator" },
    value: { type: Type.STRING, description: "Original string value as shown in report" },
    valueNumber: { type: Type.NUMBER, description: "Numeric value extracted from 'value'. Null if not numeric." },
    unit: { type: Type.STRING, description: "Unit of measurement (e.g. mg/dL, %)" },
    status: { 
      type: Type.STRING, 
      enum: ['HIGH', 'LOW', 'NORMAL', 'CRITICAL', 'BORDERLINE', 'UNKNOWN'],
      description: "Status. CRITICAL for dangerous values." 
    },
    explanation: { type: Type.STRING, description: "Simple explanation of what this is (max 20 words)" },
    possibleCauses: { type: Type.STRING, description: "Common reasons for abnormality (max 20 words)" },
    referenceRange: {
      type: Type.OBJECT,
      properties: {
        min: { type: Type.NUMBER },
        max: { type: Type.NUMBER }
      },
      description: "Numeric min/max reference range. If '< 5', min=0, max=5."
    },
    history: {
      type: Type.ARRAY,
      description: "Previous values found in the same row (e.g. from 'Previous Result' column)",
      items: {
        type: Type.OBJECT,
        properties: {
          date: { type: Type.STRING, description: "Date or label e.g. '2023-05' or 'Previous'" },
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
    name: { type: Type.STRING, description: "Name of the medication" },
    usage: { type: Type.STRING, description: "Simplified dosage and administration instructions" },
    warnings: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING },
      description: "Critical warnings or contraindications"
    },
    sideEffects: { type: Type.STRING, description: "Common side effects in plain language" },
    tips: { type: Type.STRING, description: "Helpful tips" }
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
    summary: { type: Type.STRING, description: "Reassuring summary of findings." },
    indicators: { 
      type: Type.ARRAY, 
      items: indicatorSchema,
      description: "List of extracted indicators"
    },
    medication: {
      type: Type.OBJECT,
      ...medicationSchema,
      description: "Medication details"
    },
    questionsForDoctor: { 
      type: Type.ARRAY, 
      items: { type: Type.STRING },
      description: "Questions to ask doctor." 
    },
    disclaimer: { type: Type.STRING, description: "Strict disclaimer." }
  },
  required: ["type", "summary", "questionsForDoctor", "disclaimer"]
};

export const analyzeMedicalImage = async (
  base64Images: string[], 
  context?: PatientContext,
  language: Language = 'zh'
): Promise<AnalysisResult> => {
  
  const languageName = language === 'en' ? 'ENGLISH' : 'CHINESE (Simplified)';

  const systemInstruction = `
    You are a supportive, professional Medical Interpreter Assistant. 
    
    CRITICAL RULES:
    1. DO NOT provide a medical diagnosis.
    2. ALWAYS include a disclaimer.
    3. Translate complex jargon into simple language.
    4. Context: Age ${context?.age || 'N/A'}, Gender ${context?.gender || 'N/A'}, Condition ${context?.condition || 'N/A'}.
    5. Output Language: ${languageName}.
    6. **BE CONCISE**: Keep explanations short (under 30 words) to ensure the response fits within limits.
    
    ANALYSIS LOGIC:
    - Multi-page support: Merge info from all images.
    - REPORTS: 
      - Extract 'valueNumber' (numeric) and 'unit'. 
      - Extract 'referenceRange' (min/max numeric) if available.
      - **CRITICAL**: If the report has columns for historical data (e.g., "Last Visit", "2023/12/01"), extract them into the 'history' array for that indicator.
    - MEDICATION: Summarize usage, warnings.
    - UNKNOWN: If content is unclear.
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
            text: `Analyze these images. Extract structured data including numeric values, ranges, and any historical comparisons found in the table rows. Please respond in ${languageName}.`
          }
        ]
      },
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.1,
        maxOutputTokens: 8192, // Explicitly increase output token limit to prevent JSON truncation
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response from AI");
    }

    // Improve cleanup to handle cases where model might output Markdown fences despite JSON mime type
    const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();

    try {
      return JSON.parse(cleanedText) as AnalysisResult;
    } catch (parseError) {
      console.error("JSON Parse Error:", parseError);
      console.log("Raw Text Length:", cleanedText.length);
      // If the text is very long, it likely got truncated.
      if (cleanedText.length > 50000) {
        throw new Error(language === 'zh' 
          ? "报告内容过多，无法一次性分析。请尝试分批上传（例如每次1-2张图片）。"
          : "The report is too long to analyze at once. Please try uploading fewer pages (e.g., 1-2 pages at a time)."
        );
      }
      throw new Error(language === 'zh'
        ? "数据解析失败，请确保图片清晰或稍后重试。"
        : "Failed to parse analysis data. Please ensure images are clear or try again."
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
  const languageName = language === 'en' ? 'ENGLISH' : 'CHINESE (Simplified)';

  const systemInstruction = `
    You are a helpful, empathetic medical assistant. You are chatting with a user about their medical report.
    
    CONTEXT:
    The user has just uploaded a report with the following analysis:
    ${JSON.stringify(analysisContext)}

    RULES:
    1. Answer questions based specifically on the provided analysis context.
    2. If the user asks about something not in the report, give a general answer but clarify it's not in their report.
    3. DO NOT diagnose or prescribe. Always advise consulting a doctor for specific medical decisions.
    4. Keep answers concise, encouraging, and easy to understand.
    5. Respond in ${languageName}.
  `;

  try {
    // Limit history to last 10 messages to prevent token overflow
    const recentHistory = history.slice(-10);

    // Map internal history to Gemini format
    const contents = recentHistory.map(msg => ({
      role: msg.role,
      parts: [{ text: msg.content }]
    }));

    // Add new message
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