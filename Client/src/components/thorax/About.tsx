import { ScanLine, BrainCircuit, Fingerprint, Database, Sparkles, ArrowDown, FlaskConical, Code2, Layers3, CheckCircle2, Clock3 } from 'lucide-react';
import { Disclaimer, SectionHeading } from './Common';

const capabilities = [
  { icon: BrainCircuit, title: 'Multi-label classification', status: 'Implemented', text: 'DenseNet121 returns probabilities for Atelectasis, Effusion, Infiltration, Mass, and Nodule through the FastAPI prediction endpoint.' },
  { icon: Fingerprint, title: 'Explainable AI', status: 'Implemented', text: 'The backend computes class-specific Grad-CAM overlays from the trained model and returns them to the frontend.' },
  { icon: Database, title: 'Historical case retrieval', status: 'Pending dataset', text: 'The MIMIC-CXR index and region-aware case similarity service still need to be configured with authorized image/report data.' },
  { icon: Sparkles, title: 'Contextual AI summaries', status: 'Pending integration', text: 'The planned LLM summary will be grounded in retrieved historical reports and clearly presented as non-diagnostic context.' },
];

export function About() {
  return <>
    <div className="page-heading">
      <div><div className="eyebrow">THE RESEARCH</div><h1>About RadSyn</h1><p>Chest X-Ray Classification, Localization & Historical Context</p></div>
      <span className="demo-badge"><FlaskConical size={13} />University research prototype</span>
    </div>
    <section className="about-overview">
      <div>
        <span className="eyebrow">PROJECT OVERVIEW</span>
        <h2>Making medical AI<br />more interpretable.</h2>
        <p>RadSyn is a research prototype for multi-label classification of five thoracic conditions from chest X-ray images. It connects a trained DenseNet121 model to a web interface through a FastAPI backend and computes class-specific Grad-CAM visualizations.</p>
        <p>The classifier has been evaluated on a held-out test set, achieving Macro ROC-AUC 0.8094 and Macro F1-score 0.4256. Historical case retrieval and LLM-based summaries are not connected yet.</p>
      </div>
      <div className="about-mark"><ScanLine size={85} strokeWidth={1} /><span>Rad<span>Syn</span></span><small>CLASSIFY · EXPLAIN · CONTEXTUALIZE</small></div>
    </section>
    <div className="capability-grid">
      {capabilities.map(({ icon: Icon, title, status, text }) => <article className="capability" key={title}>
        <Icon size={23} /><span className="capability-status">{status === 'Implemented' ? <CheckCircle2 size={13} /> : <Clock3 size={13} />}{status}</span><h3>{title}</h3><p>{text}</p>
      </article>)}
    </div>
    <section className="about-section">
      <SectionHeading title="Technology Stack" description="Current implementation and planned data services." />
      <div className="stack-grid">
        <div><Code2 size={21} /><h3>Frontend</h3><div className="technology-badges">{['React', 'TypeScript', 'TanStack Start', 'Vite', 'Tailwind CSS'].map((name) => <span key={name}>{name}</span>)}</div></div>
        <div><Layers3 size={21} /><h3>ML & Backend</h3><div className="technology-badges">{['PyTorch', 'DenseNet121', 'FastAPI', 'Grad-CAM', 'MIMIC-CXR (pending)', 'LLM / RAG (pending)'].map((name) => <span key={name}>{name}</span>)}</div></div>
      </div>
    </section>
    <section className="about-section">
      <SectionHeading title="Research Workflow" description="The current pipeline and remaining integration stages." />
      <div className="research-pipeline">
        {['Chest X-Ray', 'Preprocessing', 'DenseNet121', 'Disease Predictions', 'Grad-CAM', 'Historical Retrieval', 'Contextual Summary'].map((label, index) => <div key={label}><span className="pipeline-number">0{index + 1}</span><span>{label}</span>{index < 6 && <ArrowDown size={17} />}</div>)}
      </div>
    </section>
    <Disclaimer />
  </>;
}
