import { useEffect, useRef, useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { UploadCloud, ScanLine, FileImage, X, ArrowRight, LoaderCircle, ShieldCheck, ImagePlus, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { analysisService } from '@/lib/services/analysis';
import xray from '@/assets/chest-xray.jpg';
import { useAnalyses } from './AnalysisContext';
import { Disclaimer } from './Common';
interface SelectedImage { name: string; size: number; url: string; file: File | null }
export function Analyze() {
  const [file, setFile] = useState<SelectedImage | null>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  const { addCase } = useAnalyses();
  const navigate = useNavigate();
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  function selectFile(selected?: File) {
    setError('');
    if (!selected) return;
    if (!['image/png', 'image/jpeg'].includes(selected.type)) { setError('Please choose a PNG, JPG, or JPEG image.'); return; }
    if (selected.size > 10 * 1024 * 1024) { setError('This image is too large. Please choose a file under 10 MB.'); return; }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = () => { if (!mounted.current) return; if (typeof reader.result === 'string') setFile({ name: selected.name, size: selected.size, url: reader.result, file: selected }); setUploading(false); };
    reader.onerror = () => { if (!mounted.current) return; setUploading(false); setError('We could not open this image. Please try another file.'); };
    reader.readAsDataURL(selected);
  }
  async function analyze() {
    if (!file || analyzing) return;
    setAnalyzing(true); setError('');
    try {
      const result = await analysisService.predict(file.file, file.url);
      if (!mounted.current) return;
      addCase(result);
      await navigate({ to: '/results/$caseId', params: { caseId: result.id } });
    } catch (cause) {
      if (!mounted.current) return;
      setError(cause instanceof Error ? cause.message : 'The analysis request failed. Please try again.');
      setAnalyzing(false);
    }
  }
  return <><div className="page-heading"><div><div className="eyebrow">NEW ANALYSIS</div><h1>Analyze X-Ray</h1><p>From a single image to explainable insights.</p></div></div><div className="analysis-layout"><section className="upload-section"><div className="section-heading"><div><h2>Upload Chest X-Ray</h2><p>Upload a chest X-ray image for AI-assisted analysis.</p></div><span className="step-pill">STEP 01</span></div><input ref={fileInput} type="file" className="sr-only" aria-label="Upload chest X-ray image" accept="image/png,image/jpeg" onChange={(event) => selectFile(event.target.files?.[0])} disabled={analyzing} />
    {file ? <div className="uploaded-preview"><div className="preview-image"><img src={file.url} alt="Selected chest X-ray" onError={() => { setFile(null); setError('This file is not a readable image. Please select another PNG or JPEG.'); }} /></div><div className="uploaded-file"><span className="upload-file-icon"><FileImage size={22} /></span><div><strong>{file.name}</strong><span>{(file.size / 1024 / 1024).toFixed(2)} MB · Ready for analysis</span></div><Button variant="ghost" size="icon" disabled={analyzing} aria-label="Remove selected image" onClick={() => { setFile(null); if (fileInput.current) fileInput.current.value = ''; }}><X /></Button></div></div> : <div className={`upload-dropzone ${dragging ? 'dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); selectFile(event.dataTransfer.files[0]); }}><span className="upload-symbol">{uploading ? <LoaderCircle className="animate-spin" size={32} /> : <UploadCloud size={32} />}</span><h3>{uploading ? 'Preparing your image…' : 'Drag & drop your chest X-ray here'}</h3><p>or choose an image from your device</p><Button variant="outline" onClick={() => fileInput.current?.click()} disabled={uploading}><ImagePlus size={17} />Browse files</Button><span className="supported-formats">PNG, JPG, JPEG <span>·</span> Up to 10 MB</span></div>}
    {error && <div className="upload-error" role="alert"><AlertCircle size={17} />{error}</div>}
    {analyzing ? <div className="analysis-progress" role="status" aria-live="polite"><div className="progress-heading"><LoaderCircle className="animate-spin" size={19} /><h3>Running DenseNet121 inference…</h3><span>Waiting for API</span></div><p>Image uploaded. The backend is processing the X-ray and calculating five disease probabilities.</p></div> : <div className="upload-actions"><span><ShieldCheck size={15} />Image is sent to the configured RadSyn API</span><Button size="lg" disabled={!file || uploading} onClick={analyze}><ScanLine />Analyze X-Ray<ArrowRight /></Button></div>}
    </section><aside className="analysis-notes"><span className="note-eyebrow">CURRENT ANALYSIS</span><h2>Real model<br />classification.</h2>{['Five disease probabilities', 'DenseNet121 inference via FastAPI', 'Results saved for this browser session', 'Research-use disclaimer'].map((label, index) => <div className="analysis-benefit" key={label}><span>0{index + 1}</span>{label}</div>)}<div className="sample-option"><img src={xray} alt="Demonstration chest radiograph" width={1024} height={1024} /><div><strong>Try the sample image</strong><p>Send the bundled sample through the real model API.</p><Button variant="link" onClick={() => { setFile({ name: 'sample-chest-xray.jpg', size: 428000, url: xray, file: null }); setError(''); }} disabled={analyzing}>Use sample X-ray<ArrowRight /></Button></div></div><p className="demo-note">Predictions are generated by the trained classifier. They are not a medical diagnosis.</p></aside></div><Disclaimer /></>;
}
