import { historicalCases, predictions, summary, type AnalysisCase, type Disease } from '@/lib/mockData';
const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
// Replace these mock adapters with the future FastAPI calls. No network calls are made.
export const mockAnalysisService = {
  async predict(image: string): Promise<AnalysisCase> {
    await delay(3600);
    return { id: `TX-DEMO-${Date.now().toString().slice(-6)}`, date: new Date().toISOString(), finding: 'Atelectasis', confidence: 82, status: 'Completed', image };
  },
  async gradcam(disease: Disease) { await delay(650); return { disease, demonstration: true }; },
  async retrieveCases() { await delay(800); return historicalCases; },
  predictions,
  summary,
};
