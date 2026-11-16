import { useEffect, useState } from 'react';
import { AlertCircle, BookOpenText, BrainCircuit, LoaderCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PredictionScore } from '@/lib/mockData';
import { analysisService, type RetrievalResponse, type SummaryResponse } from '@/lib/services/analysis';
import { EmptyState, SectionHeading } from './Common';

interface HistoricalCasesProps {
  image: string;
  predictions: readonly PredictionScore[];
}

export function HistoricalCases({ image, predictions }: HistoricalCasesProps) {
  const [retrieval, setRetrieval] = useState<RetrievalResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setRetrieval(null);
    setSummary(null);
    analysisService.retrieveCases(null, image)
      .then((result) => { if (active) setRetrieval(result); })
      .catch((cause) => {
        if (active) setError(cause instanceof Error ? cause.message : 'Historical retrieval failed.');
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [image]);

  async function generateSummary() {
    if (!retrieval?.cases.length || summaryLoading) return;
    setSummaryLoading(true);
    setSummaryError('');
    try {
      const result = await analysisService.summarize(predictions, retrieval.cases);
      setSummary(result);
    } catch (cause) {
      setSummaryError(cause instanceof Error ? cause.message : 'The historical context summary could not be generated.');
    } finally {
      setSummaryLoading(false);
    }
  }

  return (
    <section>
      <SectionHeading
        title="Similar Historical Cases"
        description="Uncertainty-triggered retrieval from the dataset configured on the RadSyn backend. Historical records are contextual references, not diagnostic evidence."
      />
      {loading && (
        <div className="historical-loading" role="status">
          <LoaderCircle className="animate-spin" /> Searching the historical case index…
        </div>
      )}
      {!loading && error && (
        <div className="medical-caution" role="alert">
          <AlertCircle size={16} /> {error}
        </div>
      )}
      {!loading && !error && retrieval && !retrieval.triggered && (
        <EmptyState title="Historical retrieval was not triggered" description={retrieval.reason} />
      )}
      {!loading && !error && retrieval?.triggered && retrieval.cases.length === 0 && (
        <EmptyState
          title="No similar historical studies found"
          description={`Retrieval was triggered for ${retrieval.retrieval_class}, but the configured index returned no matching studies.`}
        />
      )}
      {!loading && !error && retrieval?.cases.length ? (
        <>
          <div className="historical-grid">
            {retrieval.cases.map((item) => (
              <article className="historical-card" key={item.id}>
                <div className="historical-card-header">
                  <span><BookOpenText size={15} /> {item.id}</span>
                  <span className="similarity-badge">{item.similarity.toFixed(1)}% similar</span>
                </div>
                {item.image ? (
                  <div className="historical-image">
                    <img src={item.image} alt={`De-identified reference radiograph ${item.id}`} loading="lazy" />
                    <span>{(item.source || retrieval.source || 'HISTORICAL REFERENCE').toUpperCase()}</span>
                  </div>
                ) : null}
                <div className="historical-content">
                  <h3>{item.finding}</h3>
                  <p>{item.report || 'No report text was available for this study.'}</p>
                  <small>{item.source || retrieval.source}</small>
                </div>
              </article>
            ))}
          </div>
          <div className="ai-summary">
            <span className="ai-summary-icon"><BrainCircuit size={22} /></span>
            <div>
              <div className="summary-heading">
                <h2>Historical Context Summary</h2>
                <span>{summary ? `Generated · ${summary.model}` : 'LLM optional'}</span>
              </div>
              <p>
                The summary compares model probability scores with retrieved report text. It is contextual research support, not a diagnosis or treatment recommendation.
              </p>
              {!summary && (
                <Button variant="outline" onClick={generateSummary} disabled={summaryLoading}>
                  {summaryLoading ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
                  {summaryLoading ? 'Generating summary…' : 'Generate contextual summary'}
                </Button>
              )}
              {summaryError && <p className="medical-caution" role="alert"><AlertCircle size={15} /> {summaryError}</p>}
              {summary && (
                <div className="historical-summary-text">
                  <p>{summary.summary}</p>
                  <small>Generated with {summary.model} · References: {summary.case_ids.join(', ')}</small>
                </div>
              )}
            </div>
          </div>
        </>
      ) : null}
    </section>
  );
}
