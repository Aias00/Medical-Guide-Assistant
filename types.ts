

export enum AnalysisType {
  REPORT = 'REPORT',
  MEDICATION = 'MEDICATION',
  UNKNOWN = 'UNKNOWN'
}

export type Language = 'zh' | 'en';

export interface ReferenceRange {
  min: number;
  max: number;
}

export interface HistoricalValue {
  date: string; // "2023-01", "Previous", etc.
  value: number;
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

export interface PatientContext {
  age?: string;
  gender?: string;
  condition?: string;
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  result: AnalysisResult;
}