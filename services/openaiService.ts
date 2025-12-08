import { AnalysisResult, AnalysisType, PatientContext, Language } from "../types";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// JSON Schema Definition for OpenAI response_format
const analysisResultSchema = {
  type: "object",
  properties: {
    type: { 
      type: "string", 
      enum: ["REPORT", "MEDICATION", "UNKNOWN"],
      description: "Type of the medical document"
    },
    summary: { type: "string", description: "Reassuring summary of findings" },
    indicators: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          value: { type: "string" },
          valueNumber: { type: ["number", "null"] },
          unit: { type: ["string", "null"] },
          status: { 
            type: "string", 
            enum: ['HIGH', 'LOW', 'NORMAL', 'CRITICAL', 'BORDERLINE', 'UNKNOWN'] 
          },
          explanation: { type: "string" },
          possibleCauses: { type: "string" },
          referenceRange: {
            type: ["object", "null"],
            properties: {
              min: { type: "number" },
              max: { type: "number" }
            }
          },
          history: {
            type: "array",
            items: {
              type: "object",
              properties: {
                date: { type: "string" },
                value: { type: "number" }
              }
            }
          }
        },
        required: ["name", "value", "status", "explanation", "possibleCauses"]
      }
    },
    medication: {
      type: ["object", "null"],
      properties: {
        name: { type: "string" },
        usage: { type: "string" },
        warnings: { type: "array", items: { type: "string" } },
        sideEffects: { type: "string" },
        tips: { type: "string" }
      },
      required: ["name", "usage", "warnings", "sideEffects", "tips"]
    },
    questionsForDoctor: {
      type: "array",
      items: { type: "string" }
    },
    disclaimer: { type: "string" }
  },
  required: ["type", "summary", "questionsForDoctor", "disclaimer"]
};

export const analyzeMedicalImageOpenAI = async (
  base64Images: string[], 
  context?: PatientContext,
  language: Language = 'zh'
): Promise<AnalysisResult> => {
  
  if (!OPENAI_API_KEY) {
    throw new Error("OpenAI API Key is missing. Please check your environment variables.");
  }

  const languageName = language === 'en' ? 'ENGLISH' : 'CHINESE (Simplified)';

  const systemInstruction = `
    You are a supportive, professional Medical Interpreter Assistant. 
    
    CRITICAL RULES:
    1. DO NOT provide a medical diagnosis.
    2. ALWAYS include a disclaimer.
    3. Translate complex jargon into simple language.
    4. Context: Age ${context?.age || 'N/A'}, Gender ${context?.gender || 'N/A'}.
    5. Output Language: ${languageName}.
    6. Return PURE JSON matching the provided schema.
    
    ANALYSIS LOGIC:
    - Multi-page support: Merge info from all images.
    - REPORTS: 
      - Extract 'valueNumber' (numeric) and 'unit'. 
      - Extract 'referenceRange' (min/max numeric) if available.
      - **CRITICAL**: If the report has columns for historical data (e.g., "Last Visit", "2023/12/01"), extract them into the 'history' array for that indicator.
    - MEDICATION: Summarize usage, warnings.
    - UNKNOWN: If content is unclear or unrelated.
  `;

  const messages = [
    {
      role: "system",
      content: systemInstruction
    },
    {
      role: "user",
      content: [
        { type: "text", text: `Analyze these medical images and extract structured data. Please respond in ${languageName}.` },
        ...base64Images.map(img => ({
          type: "image_url",
          image_url: {
            url: `data:image/jpeg;base64,${img}`
          }
        }))
      ]
    }
  ];

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: messages,
        max_tokens: 4096,
        temperature: 0.1,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error?.message || "OpenAI API Error");
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;
    
    if (!content) {
      throw new Error("No content received from OpenAI");
    }

    return JSON.parse(content) as AnalysisResult;

  } catch (error) {
    console.error("OpenAI Analysis Error:", error);
    throw error;
  }
};