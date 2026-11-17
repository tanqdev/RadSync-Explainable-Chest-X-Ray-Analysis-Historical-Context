import { ScanLine, BrainCircuit, Fingerprint, Database, Sparkles, ArrowDown, FlaskConical, Code2, Layers3, CheckCircle2 } from 'lucide-react';
import { Disclaimer, SectionHeading } from './Common';

const capabilities = [
  { icon: BrainCircuit, title: 'Multi-label classification', status: 'Implemented', text: 'DenseNet121 returns probability scores for Atelectasis, Effusion, Infiltration, Mass, and Nodule through the FastAPI prediction endpoint.' },
  { icon: Fingerprint, title: 'Explainable AI', status: 'Implemented', text: 'Class-specific Grad-CAM overlays are computed from model gradients and displayed alongside the predictions.' },
  { icon: Database, title: 'Historical case retrieval', status: 'Implemented', text: 'An uncertainty-triggered retrieval service searches a locally built Indiana University / Open-i SQLite index and returns similar reference studies with their source reports.' },
  { icon: Sparkles, title: 'Contextual summaries', status: 'Implemented', text: 'A deterministic local evidence summary is available by default. An optional Gemini model can produce a report-grounded summary when configured.' },
];

export function About() {
  return <>
    <div className="page-heading">
      <div><div className="eyebrow">THE RESEARCH</div><h1>About RadSync</h1><p>Chest X-Ray Classification, Explainability & Historical Context</p></div>
      <span className="demo-badge"><FlaskConical size={13} />University research prototype</span>
    </div>
    <section className="about-overview">
      <div>
        <span className="eyebrow">PROJECT OVERVIEW</span>
        <h2>Making medical AI<br />more interpretable.</h2>
        <p>RadSync is a research prototype that combines multi-label classification of five thoracic findings with class-specific Grad-CAM visual explanations and retrieval of similar historical chest X-ray studies.</p>
        <p>On the held-out NIH test predictions, the classifier achieved Macro ROC-AUC 0.8094, Macro F1-score 0.4256, mean per-class accuracy 85.3360%, and exact-match accuracy 49.8782%. These metrics evaluate classification only; they do not validate localization, retrieval, or clinical performance.</p>
        <p>Historical reports come from a separate Indiana University / Open-i reference collection. They provide context only and are not ground-truth labels for the NIH-trained classifier.</p>
      </div>
      <div className="about-mark"><ScanLine size={85} strokeWidth={1} /><span>Rad<span>Sync</span></span><small>CLASSIFY · EXPLAIN · CONTEXTUALIZE</small></div>
    </section>
    <div className="capability-grid">
      {capabilities.map(({ icon: Icon, title, status, text }) => <article className="capability" key={title}>
        <Icon size={23} /><span className="capability-status"><CheckCircle2 size={13} />{status}</span><h3>{title}</h3><p>{text}</p>
      </article>)}
    </div>
    <section className="about-section">
      <SectionHeading title="Technology Stack" description="The technologies used in the current research prototype." />
      <div className="stack-grid">
        <div><Code2 size={21} /><h3>Frontend</h3><div className="technology-badges">{['React', 'TypeScript', 'TanStack Router', 'Vite'].map((name) => <span key={name}>{name}</span>)}</div></div>
        <div><Layers3 size={21} /><h3>ML & Backend</h3><div className="technology-badges">{['Python', 'PyTorch', 'DenseNet121', 'FastAPI', 'Grad-CAM', 'NumPy', 'SQLite', 'Google Gemini API (optional)'].map((name) => <span key={name}>{name}</span>)}</div></div>
      </div>
    </section>
    <section className="about-section">
      <SectionHeading title="Research Workflow" description="From uploaded image to explainable predictions and reference context." />
      <div className="research-pipeline">
        {['Chest X-Ray', 'Preprocessing', 'DenseNet121', 'Disease Predictions', 'Grad-CAM', 'Historical Retrieval', 'Contextual Summary'].map((label, index) => <div key={label}><span className="pipeline-number">0{index + 1}</span><span>{label}</span>{index < 6 && <ArrowDown size={17} />}</div>)}
      </div>
    </section>
    <Disclaimer />
  </>;
}
