
const express = require('express');
const cors = require('cors');
const { GoogleGenAI, Type } = require("@google/genai");

const app = express();
const port = process.env.PORT || 8080;

// Enable CORS for frontend access
app.use(cors());

// Increase payload limit for base64 images
app.use(express.json({ limit: '50mb' }));

// Initialize Gemini Client
// In production (Google Cloud Run), process.env.API_KEY will be injected securely
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Schemas (Matching Frontend Types) ---
const indicatorSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    value: { type: Type.STRING },
    valueNumber: { type: Type.NUMBER },
    unit: { type: Type.STRING },
    status: { type: Type.STRING, enum: ['HIGH', 'LOW', 'NORMAL', 'CRITICAL', 'BORDERLINE', 'UNKNOWN'] },
    explanation: { type: Type.STRING },
    possibleCauses: { type: Type.STRING },
    referenceRange: {
      type: Type.OBJECT,
      properties: { min: { type: Type.NUMBER }, max: { type: Type.NUMBER } }
    },
    history: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: { date: { type: Type.STRING }, value: { type: Type.NUMBER } }
      }
    }
  },
  required: ["name", "value", "status", "explanation", "possibleCauses"]
};

const medicationSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    usage: { type: Type.STRING },
    warnings: { type: Type.ARRAY, items: { type: Type.STRING } },
    sideEffects: { type: Type.STRING },
    tips: { type: Type.STRING }
  },
  required: ["name", "usage", "warnings", "sideEffects", "tips"]
};

const responseSchema = {
  type: Type.OBJECT,
  properties: {
    type: { type: Type.STRING, enum: ['REPORT', 'MEDICATION', 'UNKNOWN'] },
    summary: { type: Type.STRING },
    indicators: { type: Type.ARRAY, items: indicatorSchema },
    medication: { type: Type.OBJECT, ...medicationSchema },
    questionsForDoctor: { type: Type.ARRAY, items: { type: Type.STRING } },
    disclaimer: { type: Type.STRING }
  },
  required: ["type", "summary", "questionsForDoctor", "disclaimer"]
};

// --- Routes ---

app.get('/', (req, res) => {
  res.send('Medical Guide Assistant Backend is Running');
});

app.post('/api/analyze', async (req, res) => {
  try {
    const { images, context, language } = req.body;
    
    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ error: "No images provided" });
    }

    const languageName = language === 'en' ? 'ENGLISH' : 'CHINESE (Simplified)';
    const systemInstruction = `
      You are a supportive, professional Medical Interpreter Assistant. 
      CRITICAL RULES:
      1. DO NOT provide a medical diagnosis.
      2. ALWAYS include a disclaimer.
      3. Translate complex jargon into simple language.
      4. Context: Age ${context?.age || 'N/A'}, Gender ${context?.gender || 'N/A'}, Condition ${context?.condition || 'N/A'}.
      5. Output Language: ${languageName}.
      6. **EXTREMELY CONCISE**: Keep explanations UNDER 15 WORDS.
      
      ANALYSIS LOGIC:
      - Multi-page support: Merge info from all images.
      - REPORTS: Extract 'valueNumber', 'unit', 'referenceRange', 'history'.
      - MEDICATION: Summarize usage, warnings.
    `;

    const imageParts = images.map(img => ({
      inlineData: { mimeType: 'image/jpeg', data: img }
    }));

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: {
        parts: [...imageParts, { text: `Analyze images. Extract structured data. Respond in ${languageName}.` }]
      },
      config: {
        systemInstruction: systemInstruction,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.1,
        maxOutputTokens: 16384,
      }
    });

    const text = response.text;
    
    // Basic JSON Cleanup logic similar to frontend
    const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    // We try to parse it here to ensure validity before sending to client
    let jsonData;
    try {
      jsonData = JSON.parse(cleanedText);
    } catch (e) {
      console.warn("Backend JSON Parse failed, attempting repair...");
       // Basic repair attempt (simplified version of frontend logic)
       if (cleanedText.includes('"indicators": [') && cleanedText.lastIndexOf('}]') === -1) {
          const lastItemEnd = cleanedText.lastIndexOf('}');
          const fixedText = cleanedText.substring(0, lastItemEnd + 1) + '] }';
          jsonData = JSON.parse(fixedText);
       } else {
         throw e;
       }
    }

    res.json(jsonData);

  } catch (error) {
    console.error("Backend Analysis Error:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

app.post('/api/chat', async (req, res) => {
  try {
    const { history, message, analysisContext, language } = req.body;
    const languageName = language === 'en' ? 'ENGLISH' : 'CHINESE (Simplified)';

    const systemInstruction = `
      You are a helpful, empathetic medical assistant.
      CONTEXT: Analysis: ${JSON.stringify(analysisContext).substring(0, 5000)} ...
      RULES: 1. Answer based on context. 2. DO NOT diagnose. 3. Concise. 4. Respond in ${languageName}.
    `;

    // Limit history
    const recentHistory = history.slice(-6).map(msg => ({
      role: msg.role,
      parts: [{ text: msg.content }]
    }));

    const contents = [
      ...recentHistory,
      { role: 'user', parts: [{ text: message }] }
    ];

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
      }
    });

    res.json({ text: response.text });

  } catch (error) {
    console.error("Backend Chat Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
