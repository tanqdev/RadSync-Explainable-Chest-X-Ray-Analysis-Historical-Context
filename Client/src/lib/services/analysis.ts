import { historicalCases, predictions, type AnalysisCase, type Disease, type PredictionScore } from '@/lib/mockData';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

async function toUploadFile(file: File | null, imageUrl: string): Promise<File> {
  if (file) return file;
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error('Could not load the sample X-ray image.');
  const blob = await response.blob();
  return new File([blob], 'sample-chest-xray.jpg', { type: blob.type || 'image/jpeg' });
}

async function postImage(endpoint: string, file: File, extra?: Record<string, string>) {
  const formData = new FormData();
  formData.append('file', file);
  if (extra) Object.entries(extra).forEach(([key, value]) => formData.append(key, value));
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, { method: 'POST', body: formData });
  } catch {
    throw new Error(`Cannot reach the RadSyn API at ${API_BASE_URL}. Start the FastAPI server and check VITE_API_BASE_URL.`);
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = payload && typeof payload.detail === 'string' ? payload.detail : `Request failed (${response.status}).`;
    throw new Error(detail);
  }
  return payload;
}

export const analysisService = {
  async predict(file: File | null, imageUrl: string): Promise<AnalysisCase> {
    const upload = await toUploadFile(file, imageUrl);
    const payload = await postImage('/predict', upload) as { filename: string; predictions: Record<Disease, number> };
    if (!payload?.predictions || typeof payload.predictions !== 'object') throw new Error('The prediction API returned an invalid response.');

    const expected = predictions.map((item) => item.disease);
    const scoreMap = payload.predictions;
    if (expected.some((name) => typeof scoreMap[name] !== 'number')) throw new Error('The API response does not contain all five expected disease predictions.');

    const orderedScores: PredictionScore[] = expected.map((disease) => {
      const configuration = predictions.find((item) => item.disease === disease)!;
      return {
        disease,
        probability: Number((scoreMap[disease] * 100).toFixed(2)),
        threshold: configuration.threshold,
        description: configuration.description,
      };
    });
    const detected = orderedScores.filter((item) => item.threshold !== undefined && item.probability >= item.threshold);
    const topPrediction = [...orderedScores].sort((a, b) => b.probability - a.probability)[0];

    return {
      id: `RS-${Date.now().toString(36).toUpperCase()}`,
      date: new Date().toISOString(),
      finding: detected.length ? detected.map((item) => item.disease).join(', ') : 'No scores above validation thresholds',
      confidence: topPrediction?.probability ?? 0,
      status: 'Completed',
      image: imageUrl,
      predictions: orderedScores,
    };
  },

  async gradcam(file: File | null, imageUrl: string, disease: Disease): Promise<{ heatmap: string; disease: Disease }> {
    const upload = await toUploadFile(file, imageUrl);
    return await postImage('/gradcam', upload, { disease }) as { heatmap: string; disease: Disease };
  },

  // Historical retrieval is intentionally empty until the MIMIC-CXR index is configured.
  async retrieveCases() { return historicalCases; },
  predictions,
};
