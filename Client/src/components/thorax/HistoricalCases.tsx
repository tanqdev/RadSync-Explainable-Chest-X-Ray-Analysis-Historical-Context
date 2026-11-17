import { useEffect, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowRight,
  BookOpenText,
  BrainCircuit,
  CheckCircle2,
  Database,
  FileText,
  GitBranch,
  Image as ImageIcon,
  LoaderCircle,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PredictionScore } from '@/lib/mockData';
import { analysisService, type RetrievalResponse, type SummaryResponse } from '@/lib/services/analysis';
import { EmptyState, SectionHeading } from './Common';
import './historical-context.css';

interface HistoricalCasesProps {
  image: string;
  predictions: readonly PredictionScore[];
}

interface ReportBlock {
  label: string;
  text: string;
}

function scoreWidth(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function getReportBlocks(report: string): ReportBlock[] {
  const cleaned = report.trim();
  if (!cleaned) return [];

  const parts = cleaned.split(/(?:^|\n)\s*(FINDINGS|IMPRESSION|INDICATION|COMPARISON|HISTORY|TECHNIQUE)\s*:\s*/gi);
  const blocks: ReportBlock[] = [];

  for (let index = 1; index < parts.length; index += 2) {
    const text = parts[index + 1]?.trim();
    if (text) blocks.push({ label: parts[index], text });
  }

  if (blocks.length) return blocks.slice(0, 2);

  return [{
    label: 'Report excerpt',
    text: cleaned.length > 420 ? `${cleaned.slice(0, 417).trimEnd()}…` : cleaned,
  }];
}

const pipeline = [
  {
    number: '01',
    label: 'INPUT',
    title: 'Query image',
    detail: 'The uploaded chest radiograph enters the research pipeline.',
    icon: <ImageIcon size={16} />,
  },
  {
    number: '02',
    label: 'CLASSIFIER',
    title: 'DenseNet121',
    detail: 'Produces five sigmoid probability outputs.',
    icon: <BrainCircuit size={16} />,
  },
  {
    number: '03',
    label: 'UNCERTAINTY GATE',
    title: 'Threshold check',
    detail: 'Selects the class whose score is nearest its validation threshold.',
    icon: <Activity size={16} />,
  },
  {
    number: '04',
    label: 'CANDIDATE POOL',
    title: 'Class filter',
    detail: 'Searches the historical index within the selected retrieval class.',
    icon: <Database size={16} />,
  },
  {
    number: '05',
    label: 'RANKING',
    title: 'Two-signal match',
    detail: 'Combines label-vector similarity and a Grad-CAM region descriptor.',
    icon: <GitBranch size={16} />,
  },
  {
    number: '06',
    label: 'REFERENCE',
    title: 'Top retrieved cases',
    detail: 'Returns ranked reference images and their source report text.',
    icon: <FileText size={16} />,
  },
];

function RetrievalFlowchart() {
  return (
    <article className="hc-panel">
      <div className="hc-panel-head">
        <div>
          <div className="hc-kicker"><GitBranch size={13} /> Retrieval logic</div>
          <h3>How RadSync finds historical context</h3>
          <p>Follow the path from the uploaded image to the ranked reference reports.</p>
        </div>
      </div>
      <div className="hc-pipeline" aria-label="Historical retrieval flowchart">
        {pipeline.map((step) => (
          <div className="hc-flow-step" key={step.number}>
            <div className="hc-flow-top">
              <span className="hc-flow-number">{step.number} / {step.label}</span>
              <span className="hc-flow-icon">{step.icon}</span>
            </div>
            <h4>{step.title}</h4>
            <p>{step.detail}</p>
          </div>
        ))}
      </div>
      <div className="hc-flow-foot">
        <strong>Ranking formula:</strong> 65% label-vector similarity + 35% Grad-CAM region-descriptor similarity.
        The combined value is used to order candidate references; it is not a calibrated clinical probability.
      </div>
    </article>
  );
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
    setSummaryError('');
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

  const rankedPredictions = [...predictions].sort((left, right) => right.probability - left.probability);
  const bestRankScore = retrieval?.cases.length
    ? Math.max(...retrieval.cases.map((item) => scoreWidth(item.similarity)))
    : 0;

  return (
    <section className="historical-context-section">
      <SectionHeading
        title="Historical Context"
        description="A visual comparison workspace for model outputs and retrieved de-identified reference reports. These records provide research context, not a diagnosis."
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
        <div className="hc-workspace">
          <div className="hc-evidence-boundary">
            <ShieldAlert size={15} />
            <span><strong>Retrieval not triggered:</strong> {retrieval.reason} The flow below shows where the uncertainty gate sits in the pipeline; no historical records were ranked for this image.</span>
          </div>
          <RetrievalFlowchart />
        </div>
      )}

      {!loading && !error && retrieval?.triggered && retrieval.cases.length === 0 && (
        <div className="hc-workspace">
          <EmptyState
            title="No similar historical studies found"
            description={`Retrieval was triggered for ${retrieval.retrieval_class || 'the selected class'}, but the configured index returned no matching studies.`}
          />
          <RetrievalFlowchart />
        </div>
      )}

      {!loading && !error && retrieval?.triggered && retrieval.cases.length > 0 && (
        <div className="hc-workspace">
          <div className="hc-overview">
            <article className="hc-panel">
              <div className="hc-panel-head">
                <div>
                  <div className="hc-kicker"><Activity size={13} /> Current model output</div>
                  <h3>Five-class probability profile</h3>
                  <p>Scores from this image, sorted from highest to lowest.</p>
                </div>
                <span className="hc-live-pill"><span className="status-dot" /> Model output</span>
              </div>
              {rankedPredictions.length ? (
                <div className="hc-score-list">
                  {rankedPredictions.map((item) => (
                    <div className="hc-score-item" key={item.disease}>
                      <span className="hc-score-name">{item.disease}</span>
                      <div className="hc-score-track" aria-label={`${item.disease}: ${item.probability.toFixed(1)} percent`}>
                        <span style={{ width: `${scoreWidth(item.probability)}%` }} />
                      </div>
                      <span className="hc-score-value">{item.probability.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="hc-score-empty">No model probabilities are available for this analysis.</div>
              )}
            </article>

            <article className="hc-panel">
              <div className="hc-panel-head">
                <div>
                  <div className="hc-kicker"><Database size={13} /> Retrieval snapshot</div>
                  <h3>Reference index results</h3>
                  <p>What the retrieval service returned for this query.</p>
                </div>
                <span className="hc-live-pill"><CheckCircle2 size={12} /> Retrieved</span>
              </div>
              <div className="hc-stats-grid">
                <div className="hc-stat">
                  <span className="hc-stat-label">Index category</span>
                  <strong className="hc-stat-value">{retrieval.retrieval_class || '—'}</strong>
                  <span className="hc-stat-foot">RadSync-assigned retrieval metadata</span>
                </div>
                <div className="hc-stat">
                  <span className="hc-stat-label">Reference records</span>
                  <strong className="hc-stat-value">{retrieval.cases.length}</strong>
                  <span className="hc-stat-foot">Returned by the local index</span>
                </div>
                <div className="hc-stat">
                  <span className="hc-stat-label">Highest ranking score</span>
                  <strong className="hc-stat-value">{bestRankScore.toFixed(1)}<span style={{ fontSize: 10, fontWeight: 500 }}>/100</span></strong>
                  <span className="hc-stat-foot">Prototype similarity score, not confidence</span>
                </div>
                <div className="hc-stat">
                  <span className="hc-stat-label">Reference source</span>
                  <strong className="hc-stat-value" style={{ fontSize: 12 }}>{retrieval.source || 'Configured index'}</strong>
                  <span className="hc-stat-foot">Dataset used for historical retrieval</span>
                </div>
              </div>
            </article>
          </div>

          <RetrievalFlowchart />

          <div className="hc-cases-heading">
            <div>
              <h3>Retrieved reference studies</h3>
              <p>Each card keeps the source report separate from RadSync's index category.</p>
            </div>
            <span className="hc-cases-count"><BookOpenText size={14} /> {retrieval.cases.length} ranked records</span>
          </div>

          <div className="hc-cases-grid">
            {retrieval.cases.map((item, index) => {
              const reportBlocks = getReportBlocks(item.report || '');
              const rankScore = scoreWidth(item.similarity);
              return (
                <article className="hc-case-card" key={item.id}>
                  <div className="hc-case-top">
                    <span className="hc-case-id"><span className="hc-rank">#{index + 1}</span>{item.id}</span>
                    <span className="hc-rank-score">Rank score {rankScore.toFixed(1)}/100</span>
                  </div>

                  <div className="hc-case-main">
                    <div className="hc-case-image">
                      {item.image ? (
                        <img src={item.image} alt={`De-identified reference radiograph ${item.id}`} loading="lazy" />
                      ) : (
                        <span className="hc-case-image-placeholder"><ImageIcon size={23} /> Image unavailable</span>
                      )}
                    </div>
                    <div className="hc-case-meta">
                      <div className="hc-class-label">MODEL-ASSIGNED INDEX CATEGORY</div>
                      <div className="hc-class-value">{item.retrieval_class}</div>
                      <div className="hc-source-label">{item.source || retrieval.source || 'Historical reference dataset'}</div>
                      <div className="hc-rank-meter">
                        <div className="hc-rank-meter-head"><span>Prototype ranking score</span><strong>{rankScore.toFixed(1)}%</strong></div>
                        <div className="hc-rank-meter-track"><span style={{ width: `${rankScore}%` }} /></div>
                      </div>
                    </div>
                  </div>

                  <div className="hc-report-content">
                    <div className="hc-report-title"><FileText size={13} /> Source report excerpts</div>
                    {reportBlocks.length ? (
                      <div className="hc-report-sections">
                        {reportBlocks.map((block, blockIndex) => (
                          <div className="hc-report-section" key={`${block.label}-${blockIndex}`}>
                            <strong>{block.label}</strong>
                            <p>{block.text.length > 420 ? `${block.text.slice(0, 417).trimEnd()}…` : block.text}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="hc-report-empty">No source report text was available for this record.</p>
                    )}
                    {item.report && (
                      <details className="hc-report-full">
                        <summary>Read complete source report</summary>
                        <p>{item.report}</p>
                      </details>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          <article className="hc-panel">
            <div className="hc-summary-panel">
              <div className="hc-summary-title">
                <span className="hc-summary-icon"><BrainCircuit size={19} /></span>
                <div>
                  <h3>Research synthesis</h3>
                  <p>Structured evidence is shown above. Generate a concise narrative when you need a text interpretation of the same inputs.</p>
                </div>
              </div>

              {!summary && (
                <div className="hc-summary-action">
                  <Button variant="outline" onClick={generateSummary} disabled={summaryLoading}>
                    {summaryLoading ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
                    {summaryLoading ? 'Generating narrative…' : 'Generate narrative summary'}
                    {!summaryLoading && <ArrowRight size={14} />}
                  </Button>
                  <span className="hc-summary-disclaimer">Uses current model scores and the retrieved source reports.</span>
                </div>
              )}

              {summaryError && <p className="hc-summary-error" role="alert"><AlertCircle size={14} /> {summaryError}</p>}

              {summary && (
                <details className="hc-narrative" open>
                  <summary>
                    <span>Generated narrative · {summary.model}</span>
                    <span>{summary.case_ids.length} source references</span>
                  </summary>
                  <div className="hc-narrative-body">
                    <p>{summary.summary}</p>
                    <small>References: {summary.case_ids.join(', ') || 'No case IDs returned'} · Generated with {summary.model}</small>
                  </div>
                </details>
              )}

              <div className="hc-evidence-boundary">
                <ShieldAlert size={15} />
                <span><strong>Interpretation boundary:</strong> model probabilities are not diagnoses. The index category is assigned by RadSync for retrieval and is not an original radiologist label. Retrieved reports are historical references, and ranking scores are not clinical confidence values.</span>
              </div>
            </div>
          </article>
        </div>
      )}
    </section>
  );
}
