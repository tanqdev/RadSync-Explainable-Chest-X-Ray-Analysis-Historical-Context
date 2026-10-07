import { createFileRoute } from '@tanstack/react-router';
import { History } from '@/components/thorax/History';
export const Route = createFileRoute('/history')({
  head: () => ({ meta: [{ title: 'Analysis History — ThoraxAI' }, { name: 'description', content: 'Search, filter, and revisit demonstration chest X-ray analyses in ThoraxAI.' }, { property: 'og:title', content: 'Analysis History — ThoraxAI' }, { property: 'og:description', content: 'Review historical demonstration analyses and model probabilities.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] }),
  component: History,
});
