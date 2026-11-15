export const disclaimer = 'This application is a research prototype and is not a medical diagnostic tool. AI predictions and retrieved historical cases are provided for research and educational purposes and should not replace professional medical evaluation.';
export const predictions = [
  { disease: 'Atelectasis', probability: 82, threshold: 66.55, description: 'Partial or complete collapse of a lung region.' },
  { disease: 'Effusion', probability: 21, threshold: 67.43, description: 'Fluid accumulation in the pleural space.' },
  { disease: 'Infiltration', probability: 74, threshold: 55.27, description: 'An abnormal increase in lung opacity.' },
  { disease: 'Mass', probability: 8, threshold: 78.71, description: 'A focal pulmonary opacity larger than 3 cm.' },
  { disease: 'Nodule', probability: 33, threshold: 85.55, description: 'A small focal pulmonary opacity.' },
] as const;
export type Disease = typeof predictions[number]['disease'];
export interface PredictionScore {
  disease: Disease;
  probability: number;
  threshold?: number;
  description?: string;
}
export interface AnalysisCase {
  id: string;
  date: string;
  finding: string;
  confidence: number;
  status: 'Completed' | 'Review suggested';
  image?: string;
  predictions?: PredictionScore[];
}
export const analyses: AnalysisCase[] = [];
export interface HistoricalCase { id: string; similarity: number; finding: string; report: string; observations: string[]; date: string }
export const historicalCases: HistoricalCase[] = [];
export const summary = '';
export const analysisSteps = ['Uploading image', 'Preprocessing image', 'Running DenseNet121 inference', 'Preparing prediction results'];
export function formatDate(date: string) { return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
