import { createFileRoute } from '@tanstack/react-router';
import { Dashboard } from '@/components/thorax/Dashboard';
export const Route = createFileRoute('/')({
  head: () => ({ meta: [{ title: 'Dashboard — ThoraxAI' }, { name: 'description', content: 'ThoraxAI research workspace for explainable chest X-ray classification and historical context.' }, { property: 'og:title', content: 'Dashboard — ThoraxAI' }, { property: 'og:description', content: 'Explore the medical imaging research workspace with demonstration chest X-ray analyses.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] }),
  component: Dashboard,
});
