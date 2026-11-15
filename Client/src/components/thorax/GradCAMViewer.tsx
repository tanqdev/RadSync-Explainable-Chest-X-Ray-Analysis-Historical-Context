import { useEffect, useState } from 'react';
import { Expand, LoaderCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { diseaseConfig, type Disease } from '@/lib/mockData';
import { analysisService } from '@/lib/services/analysis';
import { SectionHeading } from './Common';

export function GradCAMViewer({ image }: { image: string }) {
  const [disease, setDisease] = useState<Disease>('Atelectasis');
  const [loading, setLoading] = useState(false);
  const [heatmap, setHeatmap] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<'original' | 'heatmap' | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setHeatmap(null);
    analysisService.gradcam(null, image, disease)
      .then((result) => { if (active) setHeatmap(result.heatmap); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : 'Grad-CAM could not be generated.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [disease, image]);

  const originalVisual = <div className="radiograph"><img src={image} alt="Original chest X-ray" /><span className="radiograph-label">FRONTAL CHEST RADIOGRAPH</span></div>;
  const heatmapVisual = <div className="radiograph"><img src={heatmap ?? image} alt={heatmap ? `Computed Grad-CAM heatmap for ${disease}` : 'Grad-CAM awaiting generation'} /><span className="radiograph-label">{heatmap ? `GRAD-CAM · ${disease.toUpperCase()}` : 'GRAD-CAM OUTPUT'}</span>{loading && <div className="image-loading" role="status"><LoaderCircle className="animate-spin" />Generating Grad-CAM…</div>}</div>;

  return <section>
    <SectionHeading title="Visual Explanation" description="Computed Grad-CAM heatmap for the selected disease.">
      <label className="disease-selector">Explain prediction for:<select value={disease} onChange={(event) => setDisease(event.target.value as Disease)}>{diseaseConfig.map(({ disease: label }) => <option key={label}>{label}</option>)}</select></label>
    </SectionHeading>
    <div className="visual-grid">
      <div className="visual-panel"><div className="visual-title"><h3>Original X-Ray</h3><Button variant="ghost" size="icon" aria-label="Expand original X-ray" onClick={() => setExpanded('original')}><Expand size={16} /></Button></div>{originalVisual}</div>
      <div className="visual-panel"><div className="visual-title"><h3>Grad-CAM Visualization</h3><Button variant="ghost" size="icon" aria-label="Expand Grad-CAM" onClick={() => setExpanded('heatmap')} disabled={!heatmap}><Expand size={16} /></Button></div>{heatmapVisual}<div className="heatmap-legend"><span>Low attention</span><span className="legend-spectrum" /><span>High attention</span></div></div>
    </div>
    {error && <p className="medical-caution" role="alert"><AlertCircle size={15} /> {error}</p>}
    <p className="explanation-caption">Grad-CAM highlights image regions that contribute to the selected class score.</p>
    <p className="medical-caution">Grad-CAM represents model attention and does not provide exact disease boundaries or a medical diagnosis.</p>
    <Dialog open={expanded !== null} onOpenChange={(open) => { if (!open) setExpanded(null); }}>
      <DialogContent className="image-dialog"><DialogHeader><DialogTitle>{expanded === 'heatmap' ? `${disease} — Grad-CAM` : 'Original X-Ray'}</DialogTitle><DialogDescription>Model attention visualization. Not diagnostic evidence.</DialogDescription></DialogHeader>{expanded === 'heatmap' ? heatmapVisual : originalVisual}</DialogContent>
    </Dialog>
  </section>;
}
