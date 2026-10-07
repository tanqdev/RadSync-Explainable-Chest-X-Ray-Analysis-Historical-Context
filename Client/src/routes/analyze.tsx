import { createFileRoute } from '@tanstack/react-router';
import { Analyze } from '@/components/thorax/Analyze';
export const Route = createFileRoute('/analyze')({
  head: () => ({ meta: [{ title: 'Analyze X-Ray — ThoraxAI' }, { name: 'description', content: 'Upload a chest X-ray for a demonstration of AI-assisted classification and visual explanation.' }, { property: 'og:title', content: 'Analyze X-Ray — ThoraxAI' }, { property: 'og:description', content: 'Explore the mock chest X-ray analysis workflow.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] }),
  component: Analyze,
});
