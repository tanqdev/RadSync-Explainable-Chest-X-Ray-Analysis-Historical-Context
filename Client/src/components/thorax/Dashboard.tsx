import { Link } from '@tanstack/react-router';
import { ArrowRight, ArrowUpRight, ScanLine, Files, ShieldCheck, Activity, Layers3, BrainCircuit, Fingerprint, Database, Sparkles, CircleCheck, ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import xray from '@/assets/chest-xray.jpg';
import { CaseTable } from './CaseTable';
import { useAnalyses } from './AnalysisContext';
import { Disclaimer, SectionHeading } from './Common';
const workflow = [{ icon: ScanLine, title: 'Upload X-ray', text: 'Start with a chest radiograph' }, { icon: BrainCircuit, title: 'AI classification', text: 'Five thoracic conditions' }, { icon: Fingerprint, title: 'Visual explanation', text: 'Computed Grad-CAM heatmaps' }, { icon: Database, title: 'Historical context', text: 'MIMIC-CXR retrieval (pending)' }];
export function Dashboard() {
  const { cases } = useAnalyses();
  const analysed = cases.length;
  const scores = cases.reduce((total, item) => total + (item.predictions?.length ?? 0), 0);
  const thresholdFindings = cases.reduce((total, item) => total + (item.predictions ?? []).filter((prediction) => prediction.threshold !== undefined && prediction.probability >= prediction.threshold).length, 0);
  const metrics = [
    { icon: Files, label: 'Total Analyses', value: String(analysed), detail: 'This browser session', kind: 'blue' },
    { icon: ShieldCheck, label: 'Disease Scores Returned', value: String(scores), detail: 'Five scores per completed analysis', kind: 'teal' },
    { icon: Activity, label: 'Above Threshold', value: String(thresholdFindings), detail: 'Validation-selected class thresholds', kind: 'amber' },
    { icon: Layers3, label: 'Model', value: 'DenseNet121', detail: 'Five-label classifier', kind: 'teal' },
  ];
  return <>
    <div className="page-heading"><div><div className="eyebrow">RESEARCH WORKSPACE</div><h1>Dashboard</h1><p>A clearer view into chest imaging.</p></div></div>
    <section className="dashboard-hero"><div className="hero-image"><img src={xray} alt="Illustrative frontal chest radiograph" width={1024} height={1024} /><div className="xray-cross top" /><div className="xray-cross bottom" /><span className="image-label">FRONTAL CHEST · PA VIEW</span><span className="image-demo">ILLUSTRATIVE IMAGE</span></div><div className="hero-copy"><span className="hero-eyebrow"><span className="status-dot" /> AI-ASSISTED CHEST IMAGING</span><h2>Chest X-Ray<br />Analysis<span>.</span></h2><p>AI-assisted classification and visual explanation<br className="desktop-break" /> of common thoracic conditions.</p><div className="hero-actions"><Button asChild size="lg"><Link to="/analyze"><Plus size={18} />Analyze New X-Ray<ArrowRight size={17} /></Link></Button><Button asChild size="lg" variant="outline"><Link to="/history">View History</Link></Button></div><div className="hero-footnote"><ShieldCheck size={14} /><span>Research-driven. Explainable. Context-aware.</span></div></div></section>
    <div className="metrics-grid">{metrics.map(({ icon: Icon, label, value, detail, kind }) => <article className="metric-card" key={label}><div className="metric-heading"><span>{label}</span><span className={`metric-icon ${kind}`}><Icon size={19} /></span></div><div className="metric-value">{value}</div><p>{label === 'Total Analyses' && <ArrowUpRight size={13} />}{detail}</p></article>)}</div>
    <div className="dashboard-lower"><section className="recent-section"><SectionHeading title="Recent Analyses" description="Your latest chest X-ray explorations."><Button asChild variant="ghost" size="sm"><Link to="/history">View all<ArrowRight size={15} /></Link></Button></SectionHeading><div className="table-frame"><CaseTable cases={cases.slice(0, 4)} /><div className="table-footer"><span><span className="status-dot" />DenseNet121 API predictions</span><span>Showing {Math.min(4, cases.length)} of {cases.length}</span></div></div></section><section className="workflow-section"><SectionHeading title="From image to insight" description="An explainable research workflow." /><div className="workflow-list">{workflow.map(({ icon: Icon, title, text }, index) => <div className="workflow-step" key={title}><span className="workflow-icon"><Icon size={19} /></span><div><span className="workflow-number">0{index + 1}</span><h3>{title}</h3><p>{text}</p></div>{index === 0 && <ChevronRight size={15} className="text-muted-foreground" />}</div>)}</div><div className="model-note"><Layers3 size={17} /><div><strong>Powered by DenseNet121</strong><span>Multi-label classification architecture</span></div><CircleCheck size={15} /></div></section></div>
    <div className="research-strip"><span className="research-strip-icon"><Sparkles size={21} /></span><div><h3>Five conditions. One comprehensive view.</h3><p>Atelectasis <span>·</span> Effusion <span>·</span> Infiltration <span>·</span> Mass <span>·</span> Nodule</p></div><Button asChild variant="ghost"><Link to="/about">Explore the research<ArrowUpRight size={16} /></Link></Button></div><Disclaimer compact />
  </>;
}
