import { useEffect, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { UploadCloud, ScanLine, FileImage, X, ArrowRight, Check, LoaderCircle, ShieldCheck, ImagePlus, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { mockAnalysisService } from '@/lib/services/mockAnalysis';
import { analysisSteps } from '@/lib/mockData';
import xray from '@/assets/chest-xray.jpg';
import { useAnalyses } from './AnalysisContext';
import { DemoBadge, Disclaimer } from './Common';
interface SelectedImage { name: string; size: number; url: string }
export function Analyze() {
  const [file, setFile] = useState<SelectedImage | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  const { addCase } = useAnalyses();
  const navigate = useNavigate();
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => { if (!analyzing) return; const timer = setInterval(() => setStep((current) => Math.min(3, current + 1)), 900); return () => clearInterval(timer); }, [analyzing]);
  function selectFile(selected?: File) {
    setError('');
    if (!selected) return;
    if (!['image/png', 'image/jpeg'].includes(selected.type)) { setError('Please choose a PNG, JPG, or JPEG image.'); return; }
    if (selected.size > 10 * 1024 * 1024) { setError('This image is too large. Please choose a file under 10 MB.'); return; }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = () => { if (!mounted.current) return; if (typeof reader.result === 'string') setFile({ name: selected.name, size: selected.size, url: reader.result }); setUploading(false); };
    reader.onerror = () => { if (!mounted.current) return; setUploading(false); setError('We could not open this image. Please try another file.'); };
    reader.readAsDataURL(selected);
  }
  async function analyze() {
    if (!file || analyzing) return;
    setAnalyzing(true); setStep(0); setError('');
    try { const result = await mockAnalysisService.predict(file.url); if (!mounted.current) return; addCase(result); await navigate({ to: '/results/$caseId', params: { caseId: result.id } }); }
    catch { if (!mounted.current) return; setError('The demonstration analysis could not complete. Please try again.'); setAnalyzing(false); }
  }
  return <><div className="page-heading"><div><div className="eyebrow">NEW ANALYSIS</div><h1>Analyze X-Ray</h1><p>From a single image to explainable insights.</p></div><DemoBadge /></div><div className="analysis-layout"><section className="upload-section"><div className="section-heading"><div><h2>Upload Chest X-Ray</h2><p>Upload a chest X-ray image for AI-assisted analysis.</p></div><span className="step-pill">STEP 01</span></div><input ref={fileInput} type="file" className="sr-only" aria-label="Upload chest X-ray image" accept="image/png,image/jpeg" onChange={(event) => selectFile(event.target.files?.[0])} disabled={analyzing} />
    {file ? <div className="uploaded-preview"><div className="preview-image"><img src={file.url} alt="Selected chest X-ray" onError={() => { setFile(null); setError('This file is not a readable image. Please select another PNG or JPEG.'); }} /></div><div className="uploaded-file"><span className="upload-file-icon"><FileImage size={22} /></span><div><strong>{file.name}</strong><span>{(file.size / 1024 / 1024).toFixed(2)} MB · Ready for analysis</span></div><Button variant="ghost" size="icon" disabled={analyzing} aria-label="Remove selected image" onClick={() => { setFile(null); if (fileInput.current) fileInput.current.value = ''; }}><X /></Button></div></div> : <div className={`upload-dropzone ${dragging ? 'dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); selectFile(event.dataTransfer.files[0]); }}><span className="upload-symbol">{uploading ? <LoaderCircle className="animate-spin" size={32} /> : <UploadCloud size={32} />}</span><h3>{uploading ? 'Preparing your image…' : 'Drag & drop your chest X-ray here'}</h3><p>or choose an image from your device</p><Button variant="outline" onClick={() => fileInput.current?.click()} disabled={uploading}><ImagePlus size={17} />Browse files</Button><span className="supported-formats">PNG, JPG, JPEG <span>·</span> Up to 10 MB</span></div>}
    {error && <div className="upload-error" role="alert"><AlertCircle size={17} />{error}</div>}
    {analyzing ? <div className="analysis-progress" role="status" aria-live="polite"><div className="progress-heading"><LoaderCircle className="animate-spin" size={19} /><h3>Analyzing X-Ray…</h3><span>{Math.round((step + 1) / 4 * 100)}%</span></div><progress value={step + 1} max={4} />{analysisSteps.map((label, index) => <div className={`analysis-step ${index <= step ? 'current' : ''}`} key={label}>{index < step ? <Check size={16} /> : index === step ? <LoaderCircle size={16} className="animate-spin" /> : <span className="step-circle">{index + 1}</span>}<span>{label}</span>{index < step && <small>Complete</small>}</div>)}</div> : <div className="upload-actions"><span><ShieldCheck size={15} />Images stay in your browser</span><Button size="lg" disabled={!file || uploading} onClick={analyze}><ScanLine />Analyze X-Ray<ArrowRight /></Button></div>}
    </section><aside className="analysis-notes"><span className="note-eyebrow">YOUR ANALYSIS INCLUDES</span><h2>A comprehensive<br />research perspective.</h2>{['Five disease probabilities', 'Grad-CAM attention visualization', 'Similar historical references', 'AI-generated contextual summary'].map((label, index) => <div className="analysis-benefit" key={label}><span>0{index + 1}</span>{label}</div>)}<div className="sample-option"><img src={xray} alt="Demonstration chest radiograph" width={1024} height={1024} /><div><strong>Just exploring?</strong><p>Try an illustrative sample image.</p><Button variant="link" onClick={() => { setFile({ name: 'sample-chest-xray.jpg', size: 428000, url: xray }); setError(''); }} disabled={analyzing}>Use sample X-ray<ArrowRight /></Button></div></div><p className="demo-note">This demonstration returns fixed mock predictions. No machine-learning inference is performed.</p></aside></div><Disclaimer /></>;
}
