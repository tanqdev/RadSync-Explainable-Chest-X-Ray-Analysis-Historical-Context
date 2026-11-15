import { useEffect, useState } from 'react';
import { CircleCheck, FlaskConical, Info, ShieldCheck } from 'lucide-react';
import { disclaimer } from '@/lib/mockData';
export function DemoBadge() { return <span className="demo-badge"><FlaskConical size={12} /> Demonstration data</span>; }
export function StatusBadge({ review = false }: { review?: boolean }) { return <span className={`status-badge ${review ? 'review' : ''}`}><span className="status-dot" />{review ? 'Review suggested' : 'Completed'}</span>; }
export function Disclaimer({ compact = false }: { compact?: boolean }) { return <div className={`disclaimer ${compact ? 'compact' : ''}`}><ShieldCheck size={18} /><div><strong>For research. Not for diagnosis.</strong><p>{disclaimer}</p></div></div>; }
export function SectionHeading({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) { return <div className="section-heading"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{children}</div>; }
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');
export function ReadyStatus() {
  const [status, setStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  useEffect(() => {
    let active = true;
    fetch(`${API_BASE_URL}/health`)
      .then((response) => { if (!response.ok) throw new Error('API unavailable'); return response.json(); })
      .then((payload: { status?: string; model?: string }) => { if (active) setStatus(payload.status === 'ok' && payload.model === 'DenseNet121' ? 'online' : 'offline'); })
      .catch(() => { if (active) setStatus('offline'); });
    return () => { active = false; };
  }, []);
  const label = status === 'online' ? 'API Online' : status === 'offline' ? 'API Offline' : 'Checking API';
  return <span className={`ready-status ${status}`} role="status"><span className="status-dot" />{label}</span>;
}
export function EmptyState({ title, description }: { title: string; description: string }) { return <div className="empty-state"><Info size={25} /><h3>{title}</h3><p>{description}</p></div>; }
export function CompleteIcon() { return <CircleCheck size={18} className="text-primary" />; }
