

import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AnalysisResult, AnalysisType, PatientContext, Language } from "../types";

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
    explanation: { type: Type.STRING, description: "Simple explanation of what this is" },
    possibleCauses: { type: Type.STRING, description: "Common reasons for abnormality" },
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
    4. Context: Age ${context?.age || 'N/A'}, Gender ${context?.gender || 'N/A'}.
    5. Output Language: ${languageName}.
    
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
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response from AI");
    }

    const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();

    return JSON.parse(cleanedText) as AnalysisResult;

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};