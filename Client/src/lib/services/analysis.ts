import { diseaseConfig, type AnalysisCase, type Disease, type PredictionScore } from '@/lib/mockData';

const API_BASE_URL = (import.meta.env['VITE_API_BASE_URL'] || 'http://127.0.0.1:8000').replace(/\/$/, '');

export interface HistoricalCaseResult {
  id: string;
  similarity: number;
  retrieval_class: string;
  report: string;
  source: string;
  image?: string | null;
}
export interface RetrievalResponse {
  triggered: boolean;
  reason: string;
  source: string;
  retrieval_class?: Disease;
  threshold_margin?: number;
  cases: HistoricalCaseResult[];
}
export interface SummaryResponse {
  summary: string;
  model: string;
  case_ids: string[];
}

function apiErrorMessage(payload: unknown, fallback: string): string {
  if (!payload || typeof payload !== 'object' || !('detail' in payload)) return fallback;
  const detail = (payload as { detail?: unknown }).detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) {
    const messages = detail.map((item) => {
      if (!item || typeof item !== 'object') return '';
      const error = item as { loc?: unknown[]; msg?: unknown };
      const location = Array.isArray(error.loc) ? error.loc.map(String).join('.') : 'request';
      const message = typeof error.msg === 'string' ? error.msg : 'Invalid value';
      return `${location}: ${message}`;
    }).filter(Boolean);
    if (messages.length) return messages.join('; ');
  }
  return fallback;
}

async function toUploadFile(file: File | null, imageUrl: string): Promise<File> {
  if (file) return file;
  const response = await fetch(imageUrl);
  if (!response.ok) throw new Error('Could not load the selected X-ray image.');
  const blob = await response.blob();
  const filename = blob.type === 'image/png' ? 'chest-xray.png' : 'chest-xray.jpg';
  return new File([blob], filename, { type: blob.type || 'image/jpeg' });
}

async function postImage(endpoint: string, file: File, extra?: Record<string, string>) {
  const formData = new FormData();
  formData.append('file', file);
  if (extra) Object.entries(extra).forEach(([key, value]) => formData.append(key, value));
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, { method: 'POST', body: formData });
  } catch {
    throw new Error(`Cannot reach the RadSync API at ${API_BASE_URL}. Start FastAPI and check VITE_API_BASE_URL.`);
  }
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(apiErrorMessage(payload, `Request failed (${response.status}).`));
  }
  return payload;
}

export const analysisService = {
  async predict(file: File | null, imageUrl: string): Promise<AnalysisCase> {
    const upload = await toUploadFile(file, imageUrl);
    const payload = await postImage('/predict', upload) as { filename: string; predictions: Record<Disease, number> };
    if (!payload?.predictions || typeof payload.predictions !== 'object') throw new Error('The prediction API returned an invalid response.');

    const expected = diseaseConfig.map((item) => item.disease);
    const scoreMap = payload.predictions;
    if (expected.some((name) => typeof scoreMap[name] !== 'number' || !Number.isFinite(scoreMap[name]))) {
      throw new Error('The API response does not contain all five expected disease predictions.');
    }

    const orderedScores: PredictionScore[] = expected.map((disease) => {
      const configuration = diseaseConfig.find((item) => item.disease === disease)!;
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
      highestScore: topPrediction?.probability ?? 0,
      status: detected.length > 0 ? 'Completed' : 'Review suggested',
      image: imageUrl,
      predictions: orderedScores,
    };
  },

  async gradcam(file: File | null, imageUrl: string, disease: Disease): Promise<{ heatmap: string; disease: Disease }> {
    const upload = await toUploadFile(file, imageUrl);
    const payload = await postImage('/gradcam', upload, { disease }) as { heatmap: string; disease: Disease };
    if (!payload?.heatmap?.startsWith('data:image/png;base64,')) {
      throw new Error('The Grad-CAM endpoint returned an invalid heatmap.');
    }
    return payload;
  },

  async retrieveCases(file: File | null, imageUrl: string, topK = 5): Promise<RetrievalResponse> {
    const upload = await toUploadFile(file, imageUrl);
    const payload = await postImage('/retrieve', upload, { top_k: String(topK) }) as RetrievalResponse;
    if (typeof payload?.triggered !== 'boolean' || !Array.isArray(payload.cases) || typeof payload.source !== 'string') {
      throw new Error('The historical retrieval endpoint returned an invalid response.');
    }
    return payload;
  },

  async summarize(predictions: readonly PredictionScore[], cases: HistoricalCaseResult[]): Promise<SummaryResponse> {
    const payload = {
      predictions: Object.fromEntries(predictions.map((item) => [item.disease, item.probability])),
      cases: cases.map((item) => ({
        id: item.id,
        similarity: item.similarity,
        retrieval_class: item.retrieval_class,
        report: item.report,
      })),
    };
    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch {
      throw new Error(`Cannot reach the RadSync API at ${API_BASE_URL}.`);
    }
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(apiErrorMessage(body, `Summary request failed (${response.status}).`));
    }
    if (typeof body?.summary !== 'string') throw new Error('The summary endpoint returned an invalid response.');
    return body as SummaryResponse;
  },
};
