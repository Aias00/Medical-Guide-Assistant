
export enum AnalysisType {
  REPORT = 'REPORT',
  MEDICATION = 'MEDICATION',
  UNKNOWN = 'UNKNOWN'
}

export type Language = 'zh' | 'en';

export type AiProvider = 'gemini' | 'openai';

export interface ReferenceRange {
  min: number;
  max: number;
}

export interface HistoricalValue {
  date: string; // "2023-01", "Previous", etc.
  value: number;
  isCurrent?: boolean; // UI helper
}

export interface Indicator {
  name: string;
  value: string;
  valueNumber?: number; // Numeric value for plotting
  unit?: string;
  status: 'HIGH' | 'LOW' | 'NORMAL' | 'CRITICAL' | 'BORDERLINE' | 'UNKNOWN';
  explanation: string; // Plain language explanation
  possibleCauses: string; // Common reasons (non-diagnostic)
  referenceRange?: ReferenceRange;
  history?: HistoricalValue[];
}

export interface MedicationInfo {
  name: string;
  usage: string; // Simplified usage
  warnings: string[]; // Important alerts
  sideEffects: string; // Common side effects
  tips: string; // Practical tips (e.g., take with food)
}

export interface AnalysisResult {
  type: AnalysisType;
  summary: string; // General simplified summary
  indicators?: Indicator[]; // For reports
  medication?: MedicationInfo; // For drugs
  questionsForDoctor: string[]; // Suggested questions
  disclaimer: string; // Safety warning
}

export interface UserProfile {
  id: string;
  name: string;
  relation: string; // e.g. "Father", "Mother", "Me"
  avatarColor: string; // Hex color
  context: PatientContext;
}

export interface PatientContext {
  age?: string;
  gender?: string;
  condition?: string; // Medical history
  reportDate?: string; // Date of the actual report content
}

export type HistoryStatus = 'processing' | 'completed' | 'failed';

export type ChatRole = 'user' | 'model';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface HistoryItem {
  id: string;
  profileId?: string; // Link to a specific user profile
  timestamp: number; // Created At
  reportDate?: string; // User specified date of the report content
  status: HistoryStatus;
  result?: AnalysisResult; // Optional because it might be processing
  thumbnail?: string; // Optional: save a tiny thumbnail for the list
  summary?: string; // Optional error message or summary
  chatHistory?: ChatMessage[]; // Persisted chat conversation
  originalImages?: string[]; // Persist original full-res images
}
