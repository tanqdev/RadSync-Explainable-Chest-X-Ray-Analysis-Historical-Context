import { Link } from '@tanstack/react-router';
import { Download, Plus, Info, FileScan, Clock3, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import xray from '@/assets/chest-xray.jpg';
import { disclaimer, formatDate } from '@/lib/mockData';
import { useAnalyses } from './AnalysisContext';
import { Disclaimer, EmptyState } from './Common';
import { PredictionOverview } from './Predictions';
import { GradCAMViewer } from './GradCAMViewer';
import { HistoricalCases } from './HistoricalCases';

export function Results({ caseId }: { caseId: string }) {
  const { cases } = useAnalyses();
  const item = cases.find((entry) => entry.id === caseId);
  if (!item) return <><EmptyState title="Analysis unavailable" description="Uploaded analyses are kept only for this browser session. Start a new analysis to continue." /><Button asChild><Link to="/analyze">New Analysis<Plus /></Link></Button></>;
  const analysis = item;
  function downloadReport() {
    const scores = analysis.predictions ?? [];
    const text = `RadSync — Research Analysis Report\n${analysis.id}\n${new Date(analysis.date).toISOString()}\n\nMODEL OUTPUTS (PROBABILITIES; NOT A DIAGNOSIS)\n${scores.map((p) => `${p.disease}: ${p.probability.toFixed(2)}%`).join('\n')}\n\n\n${disclaimer}`;
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${analysis.id}-research-report.txt`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const scoreCount = analysis.predictions?.length ?? 0;
  return <><div className="page-heading"><div><div className="eyebrow">ANALYSIS RESULTS</div><h1>Model inference results.</h1><div className="results-meta"><span><FileScan size={14} />{analysis.id}</span><span><Clock3 size={14} />{formatDate(analysis.date)} · {new Date(analysis.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span></div></div><div className="result-actions"><Button variant="outline" onClick={downloadReport} disabled={!scoreCount}><Download />Download Report</Button><Button asChild><Link to="/analyze"><Plus />New Analysis</Link></Button></div></div>
    <div className="result-summary"><span className="result-summary-icon"><Info size={26} /></span><div><span className="eyebrow">DENSENET121 OUTPUT</span><h2>{scoreCount ? 'Five disease scores returned' : 'Prediction data unavailable'}</h2><p>Scores are sigmoid probabilities returned by the trained model. They are not calibrated clinical confidence values and do not constitute a diagnosis.</p></div><span className="ready-status"><CheckCircle2 size={14} />Live model output</span></div>
    <div className="results-sections"><PredictionOverview results={analysis.predictions ?? []} />
      <GradCAMViewer image={analysis.image || xray} />
      <HistoricalCases image={analysis.image || xray} predictions={analysis.predictions ?? []} />
      <Disclaimer />
    </div></>;
}
