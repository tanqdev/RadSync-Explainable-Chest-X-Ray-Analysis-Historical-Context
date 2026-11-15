import { Info } from 'lucide-react';
import { predictions as demoPredictions, type PredictionScore } from '@/lib/mockData';
import { DemoBadge, SectionHeading } from './Common';

export function PredictionOverview({ results = demoPredictions }: { results?: readonly PredictionScore[] }) {
  return <section>
    <SectionHeading title="Disease Predictions" description="DenseNet121 multi-label classification results">
      <DemoBadge />
    </SectionHeading>
    {results.length === 0 ? <p>No model prediction data is available for this case.</p> : <div className="predictions-grid">
      {results.map(({ disease, probability, description }) => <article className="prediction-card" key={disease}>
        <div className="prediction-title"><h3>{disease}</h3>{description && <span tabIndex={0} className="info-tip" aria-label={description}><Info size={15} /><span className="tooltip-content">{description}</span></span>}</div>
        <div className="prediction-value">{probability.toFixed(1)}<span>%</span></div>
        <progress max={100} value={probability} aria-label={`${disease} model score: ${probability.toFixed(1)} percent`} />
        <div className="prediction-status"><span className="status-dot" />Model score</div>
        <span className="confidence-label">Sigmoid probability · Not a diagnosis</span>
      </article>)}
    </div>}
  </section>;
}
