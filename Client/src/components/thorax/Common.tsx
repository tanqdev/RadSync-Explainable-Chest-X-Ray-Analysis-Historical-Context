import { CircleCheck, FlaskConical, Info, ShieldCheck } from 'lucide-react';
import { disclaimer } from '@/lib/mockData';
export function DemoBadge() { return <span className="demo-badge"><FlaskConical size={12} /> Demonstration data</span>; }
export function StatusBadge({ review = false }: { review?: boolean }) { return <span className={`status-badge ${review ? 'review' : ''}`}><span className="status-dot" />{review ? 'Review suggested' : 'Completed'}</span>; }
export function Disclaimer({ compact = false }: { compact?: boolean }) { return <div className={`disclaimer ${compact ? 'compact' : ''}`}><ShieldCheck size={18} /><div><strong>For research. Not for diagnosis.</strong><p>{disclaimer}</p></div></div>; }
export function SectionHeading({ title, description, children }: { title: string; description?: string; children?: React.ReactNode }) { return <div className="section-heading"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{children}</div>; }
export function ReadyStatus() { return <span className="ready-status"><span className="status-dot" />System Ready</span>; }
export function EmptyState({ title, description }: { title: string; description: string }) { return <div className="empty-state"><Info size={25} /><h3>{title}</h3><p>{description}</p></div>; }
export function CompleteIcon() { return <CircleCheck size={18} className="text-primary" />; }
