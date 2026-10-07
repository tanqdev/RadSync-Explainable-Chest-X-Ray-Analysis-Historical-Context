import { createFileRoute } from '@tanstack/react-router';
import { Results } from '@/components/thorax/Results';
export const Route = createFileRoute('/results/$caseId')({
  head: ({ params }) => ({ meta: [{ title: `${params.caseId} — ThoraxAI Results` }, { name: 'description', content: 'Demonstration disease probabilities, visual attention maps, and historical context. Not a medical diagnosis.' }, { property: 'og:title', content: `${params.caseId} — ThoraxAI Results` }, { property: 'og:description', content: 'Research-only chest X-ray results with illustrative explainability and reference cases.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] }),
  component: ResultsPage,
});
function ResultsPage() { const { caseId } = Route.useParams(); return <Results caseId={caseId} />; }
