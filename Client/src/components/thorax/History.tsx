import { useMemo, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { Plus, Search, SlidersHorizontal, ArrowDownUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAnalyses } from './AnalysisContext';
import { CaseTable } from './CaseTable';
import { DemoBadge, Disclaimer, SectionHeading } from './Common';
export function History() {
  const { cases } = useAnalyses();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('newest');
  const filtered = useMemo(() => cases.filter((item) => `${item.id} ${item.finding}`.toLowerCase().includes(search.toLowerCase()) && (filter === 'all' || filter === 'review' && item.status === 'Review suggested' || filter === 'high' && item.confidence >= 80)).sort((a, b) => sort === 'confidence' ? b.confidence - a.confidence : sort === 'oldest' ? new Date(a.date).getTime() - new Date(b.date).getTime() : new Date(b.date).getTime() - new Date(a.date).getTime()), [cases, search, filter, sort]);
  return <><div className="page-heading"><div><div className="eyebrow">ANALYSIS ARCHIVE</div><h1>History</h1><p>Revisit your chest imaging explorations.</p></div><Button asChild><Link to="/analyze"><Plus />New Analysis</Link></Button></div><SectionHeading title="Previous Analyses" description={`${cases.length} cases in your demonstration workspace`}><DemoBadge /></SectionHeading><div className="history-controls"><label className="search-field"><Search size={18} /><input placeholder="Search by case ID or finding…" aria-label="Search analyses" value={search} onChange={(event) => setSearch(event.target.value)} /></label><label className="filter-select"><SlidersHorizontal size={16} /><select aria-label="Filter analyses" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All analyses</option><option value="high">High confidence</option><option value="review">Review suggested</option></select></label><label className="filter-select"><ArrowDownUp size={16} /><select aria-label="Sort analyses" value={sort} onChange={(event) => setSort(event.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="confidence">Highest confidence</option></select></label></div><div className="table-frame"><CaseTable cases={filtered} /><div className="table-footer"><span>{filtered.length} of {cases.length} analyses</span><span>Demonstration data · Session only</span></div></div><div className="mt-8"><Disclaimer compact /></div></>;
}
