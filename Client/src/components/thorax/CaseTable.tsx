import { Link } from '@tanstack/react-router';
import { ArrowUpRight, FileScan } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatDate, type AnalysisCase } from '@/lib/mockData';
import { EmptyState, StatusBadge } from './Common';
export function CaseTable({ cases }: { cases: AnalysisCase[] }) {
  if (!cases.length) return <EmptyState title="No analyses found" description="Try another search or start a new X-ray analysis." />;
  return <div className="table-scroll"><table className="case-table"><thead><tr><th>Case ID</th><th>Date & time</th><th>Main finding</th><th>Confidence</th><th>Status</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{cases.map((item) => <tr key={item.id}><td><span className="case-identity"><span className="case-icon"><FileScan size={17} /></span>{item.id}</span></td><td><span>{formatDate(item.date)}</span><small>{new Date(item.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</small></td><td>{item.finding}</td><td><span className="table-confidence">{item.confidence}%<progress value={item.confidence} max={100} aria-label={`${item.confidence}% confidence`} /></span></td><td><StatusBadge review={item.status === 'Review suggested'} /></td><td><Button asChild variant="ghost" size="sm"><Link to="/results/$caseId" params={{ caseId: item.id }}>View<ArrowUpRight size={14} /></Link></Button></td></tr>)}</tbody></table></div>;
}
