import { createFileRoute } from '@tanstack/react-router';
import { Dashboard } from '@/components/thorax/Dashboard';
export const Route = createFileRoute('/')({
  head: () => ({ meta: [{ title: 'Dashboard — RadSyn' }, { name: 'description', content: 'RadSyn research workspace for explainable chest X-ray classification and historical context.' }, { property: 'og:title', content: 'Dashboard — RadSyn' }, { property: 'og:description', content: 'Explore the medical imaging research workspace with live model inference results.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] }),
  component: Dashboard,
});
