import { createFileRoute } from '@tanstack/react-router';
import { Results } from '@/components/thorax/Results';
export const Route = createFileRoute('/results/$caseId')({
  head: ({ params }) => ({ meta: [{ title: `${params.caseId} — RadSyn Results` }, { name: 'description', content: 'DenseNet121 disease probabilities, visual attention maps, and historical context. Not a medical diagnosis.' }, { property: 'og:title', content: `${params.caseId} — RadSyn Results` }, { property: 'og:description', content: 'Research-only chest X-ray results with computed Grad-CAM visualizations and historical context.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] }),
  component: ResultsPage,
});
function ResultsPage() { const { caseId } = Route.useParams(); return <Results caseId={caseId} />; }
