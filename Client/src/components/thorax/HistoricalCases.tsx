import { useEffect, useState } from 'react';
import { LoaderCircle } from 'lucide-react';
import { type HistoricalCase } from '@/lib/mockData';
import { mockAnalysisService } from '@/lib/services/mockAnalysis';
import { EmptyState, SectionHeading } from './Common';

export function HistoricalCases() {
  const [cases, setCases] = useState<HistoricalCase[] | null>(null);
  useEffect(() => {
    let active = true;
    mockAnalysisService.retrieveCases().then((items) => { if (active) setCases(items); });
    return () => { active = false; };
  }, []);

  return <section>
    <SectionHeading title="Similar Historical Cases" description="MIMIC-CXR retrieval will appear here once the dataset index is configured." />
    {cases === null
      ? <div className="historical-loading" role="status"><LoaderCircle className="animate-spin" />Checking historical case index…</div>
      : cases.length === 0
        ? <EmptyState title="Historical retrieval not configured" description="No historical cases are being shown. Connect an authorized MIMIC-CXR dataset and build its retrieval index to enable this section." />
        : <EmptyState title="Historical results unavailable" description="The case index returned an unsupported response." />}
  </section>;
}
