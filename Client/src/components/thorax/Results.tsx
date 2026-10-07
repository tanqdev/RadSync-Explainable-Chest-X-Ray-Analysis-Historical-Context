import { Link } from '@tanstack/react-router';
import { Download, Plus, Sparkles, Info, CircleCheck, FileScan, Clock3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import xray from '@/assets/chest-xray.jpg';
import { disclaimer, formatDate, predictions, summary } from '@/lib/mockData';
import { useAnalyses } from './AnalysisContext';
import { DemoBadge, Disclaimer, EmptyState } from './Common';
import { PredictionOverview } from './Predictions';
import { GradCAMViewer } from './GradCAMViewer';
import { HistoricalCases } from './HistoricalCases';
export function Results({ caseId }: { caseId: string }) {
  const { cases } = useAnalyses();
  const item = cases.find((entry) => entry.id === caseId);
  if (!item) return <><EmptyState title="Analysis unavailable" description="Uploaded analyses are kept only for this browser session. Start a new analysis to continue." /><Button asChild><Link to="/analyze">New Analysis<Plus /></Link></Button></>;
  function downloadReport() {
    if (!item) return;
    const text = `ThoraxAI — Demonstration Research Report\n${item.id}\n${new Date(item.date).toISOString()}\n\nALL RESULTS ARE FIXED MOCK DATA\n${predictions.map((p) => `${p.disease}: ${p.probability}% (${p.probability >= 50 ? 'Detected' : 'Not Detected'})`).join('\n')}\n\nAI Context Summary (mock):\n${summary}\n\n${disclaimer}`;
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = `${item.id}-research-report.txt`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return <><div className="page-heading"><div><div className="eyebrow">ANALYSIS RESULTS</div><h1>From image to insight.</h1><div className="results-meta"><span><FileScan size={14} />{item.id}</span><span><Clock3 size={14} />{formatDate(item.date)} · {new Date(item.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span></div></div><div className="result-actions"><Button variant="outline" onClick={downloadReport}><Download />Download Report</Button><Button asChild><Link to="/analyze"><Plus />New Analysis</Link></Button></div></div><div className="result-summary"><span className="result-summary-icon"><Info size={26} /></span><div><span className="eyebrow">DEMONSTRATION RESULT</span><h2>Potential Findings Detected</h2><p>Two conditions exceed the illustrative 50% detection threshold. These fixed mock results are not a medical diagnosis.</p></div><DemoBadge /></div><div className="results-sections"><PredictionOverview /><GradCAMViewer image={item.image || xray} /><HistoricalCases /><section className="ai-summary"><span className="ai-summary-icon"><Sparkles size={22} /></span><div><div className="summary-heading"><h2>AI Context Summary</h2><span><CircleCheck size={13} />Generated from retrieved historical references</span></div><p>{summary}</p><small>Illustrative summary · No AI service has been called</small></div></section><Disclaimer /></div></>;
}
