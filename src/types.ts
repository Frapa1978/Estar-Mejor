export interface HealthRecord {
  id?: number;
  type: 'hypertension' | 'glycemia' | 'weight';
  value1: number; // Systolic for BP, mg/dL for Glycemia, kg for Weight
  value2?: number; // Diastolic for BP
  value3?: number; // Pulse for BP
  notes?: string;
  timestamp: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}
