import { historicalCases, predictions, summary, type AnalysisCase, type Disease, type PredictionScore } from '@/lib/mockData';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

interface PredictApiResponse {
  filename: string;
  predictions: Record<Disease, number>;
}

async function toUploadFile(file: File | null, imageUrl: string): Promise<File> {
  if (file) return file;
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error('Could not load the sample X-ray image.');
  const blob = await response.blob();
  return new File([blob], 'sample-chest-xray.jpg', { type: blob.type || 'image/jpeg' });
}

export const mockAnalysisService = {
  async predict(file: File | null, imageUrl: string): Promise<AnalysisCase> {
    const upload = await toUploadFile(file, imageUrl);
    const formData = new FormData();
    formData.append('file', upload);

    const response = await fetch(`${API_BASE_URL}/predict`, {
      method: 'POST',
      body: formData,
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const detail = payload && typeof payload.detail === 'string' ? payload.detail : 'Prediction request failed.';
      throw new Error(detail);
    }
    if (!payload || !payload.predictions || typeof payload.predictions !== 'object') {
      throw new Error('The prediction API returned an invalid response.');
    }

    const scores = Object.entries(payload.predictions as Record<string, number>)
      .map(([disease, probability]) => ({
        disease: disease as Disease,
        probability: Math.max(0, Math.min(100, Number(probability) * 100)),
      }))
      .filter((item) => Number.isFinite(item.probability));

    const expected = predictions.map((item) => item.disease);
    if (scores.length !== expected.length || expected.some((name) => !scores.some((item) => item.disease === name))) {
      throw new Error('The API response does not contain all five expected disease predictions.');
    }

    const scoreMap = new Map(scores.map((item) => [item.disease, item.probability]));
    const orderedScores: PredictionScore[] = expected.map((disease) => ({
      disease,
      probability: Number((scoreMap.get(disease) ?? 0).toFixed(2)),
      description: predictions.find((item) => item.disease === disease)?.description,
    }));
    const topPrediction = [...orderedScores].sort((a, b) => b.probability - a.probability)[0];

    return {
      id: `RS-${Date.now().toString(36).toUpperCase()}`,
      date: new Date().toISOString(),
      finding: topPrediction ? `Highest score: ${topPrediction.disease}` : 'Predictions generated',
      confidence: topPrediction?.probability ?? 0,
      status: 'Completed',
      image: imageUrl,
      predictions: orderedScores,
    };
  },

  // These two adapters remain demo-only until their backend services are implemented.
  async gradcam(_disease: Disease) { return { demonstration: true }; },
  async retrieveCases() { return historicalCases; },
  predictions,
  summary,
};
