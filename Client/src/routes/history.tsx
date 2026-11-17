import { createFileRoute } from '@tanstack/react-router';
import { History } from '@/components/thorax/History';
export const Route = createFileRoute('/history')({
  head: () => ({ meta: [{ title: 'Analysis History — RadSync' }, { name: 'description', content: 'Search, filter, and revisit model inference analyses in RadSync.' }, { property: 'og:title', content: 'Analysis History — RadSync' }, { property: 'og:description', content: 'Review historical demonstration analyses and model probabilities.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] }),
  component: History,
});
