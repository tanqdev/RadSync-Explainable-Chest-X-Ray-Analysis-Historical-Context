import { createFileRoute } from '@tanstack/react-router';
import { Analyze } from '@/components/thorax/Analyze';
export const Route = createFileRoute('/analyze')({
  head: () => ({ meta: [{ title: 'Analyze X-Ray — RadSyn' }, { name: 'description', content: 'Upload a chest X-ray for a DenseNet121 multi-label classification and Grad-CAM and visual explanation.' }, { property: 'og:title', content: 'Analyze X-Ray — RadSyn' }, { property: 'og:description', content: 'Explore the mock chest X-ray analysis workflow.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] }),
  component: Analyze,
});
