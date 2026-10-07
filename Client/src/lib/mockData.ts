export const disclaimer = 'This application is a research prototype and is not a medical diagnostic tool. AI predictions and retrieved historical cases are provided for research and educational purposes and should not replace professional medical evaluation.';
export const predictions = [
  { disease: 'Atelectasis', probability: 82, description: 'Partial or complete collapse of a lung region.' },
  { disease: 'Effusion', probability: 21, description: 'Fluid accumulation in the pleural space.' },
  { disease: 'Infiltration', probability: 74, description: 'An abnormal increase in lung opacity.' },
  { disease: 'Mass', probability: 8, description: 'A focal pulmonary opacity larger than 3 cm.' },
  { disease: 'Nodule', probability: 33, description: 'A small focal pulmonary opacity.' },
] as const;
export type Disease = typeof predictions[number]['disease'];
export interface AnalysisCase { id: string; date: string; finding: string; confidence: number; status: 'Completed' | 'Review suggested'; image?: string }
export const analyses: AnalysisCase[] = [
  { id: 'TX-2026-0048', date: '2026-10-06T14:32:00', finding: 'Atelectasis', confidence: 82, status: 'Completed' },
  { id: 'TX-2026-0047', date: '2026-10-06T11:18:00', finding: 'Infiltration', confidence: 74, status: 'Completed' },
  { id: 'TX-2026-0046', date: '2026-10-05T16:45:00', finding: 'Effusion', confidence: 91, status: 'Completed' },
  { id: 'TX-2026-0045', date: '2026-10-05T10:06:00', finding: 'Nodule', confidence: 58, status: 'Review suggested' },
  { id: 'TX-2026-0044', date: '2026-10-04T15:22:00', finding: 'No findings above threshold', confidence: 96, status: 'Completed' },
  { id: 'TX-2026-0043', date: '2026-10-04T09:51:00', finding: 'Atelectasis', confidence: 88, status: 'Completed' },
];
export interface HistoricalCase { id: string; similarity: number; finding: string; report: string; observations: string[]; date: string }
export const historicalCases: HistoricalCase[] = [
  { id: 'MIMIC-00123', similarity: 91, finding: 'Pleural Effusion', date: 'De-identified reference study', report: 'Small bilateral pleural effusions with associated bibasilar opacities. Cardiomediastinal silhouette is within normal limits. No pneumothorax.', observations: ['Blunting of the costophrenic angles', 'Associated lower-lung opacity', 'No pneumothorax identified'] },
  { id: 'MIMIC-00451', similarity: 87, finding: 'Atelectasis', date: 'De-identified reference study', report: 'Linear opacities at the left lung base may represent subsegmental atelectasis. Lung volumes are mildly decreased. No large pleural effusion.', observations: ['Linear left basilar opacity', 'Mildly reduced lung volumes', 'No large pleural effusion'] },
  { id: 'MIMIC-00872', similarity: 84, finding: 'Infiltration', date: 'De-identified reference study', report: 'Patchy airspace opacities in the bilateral lower lung fields. Findings are nonspecific and require clinical correlation. No acute osseous abnormality.', observations: ['Patchy lower-lung airspace opacities', 'Bilateral distribution', 'Clinical correlation required'] },
];
export const summary = 'The current image demonstrates model-predicted features associated with atelectasis and infiltration. Retrieved historical cases show overlapping radiographic patterns involving lower-lung regions. These historical cases are provided as contextual references and should not be interpreted as a diagnosis.';
export const analysisSteps = ['Image preprocessing', 'Disease classification', 'Explainability generation', 'Historical case retrieval'];
export function formatDate(date: string) { return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); }
