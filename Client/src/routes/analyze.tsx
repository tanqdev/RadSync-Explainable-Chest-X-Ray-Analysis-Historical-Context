import { createFileRoute } from '@tanstack/react-router';
import { Analyze } from '@/components/thorax/Analyze';
export const Route = createFileRoute('/analyze')({
  head: () => ({ meta: [{ title: 'Analyze X-Ray — RadSync' }, { name: 'description', content: 'Upload a chest X-ray for a DenseNet121 multi-label classification and Grad-CAM and visual explanation.' }, { property: 'og:title', content: 'Analyze X-Ray — RadSync' }, { property: 'og:description', content: 'Upload a chest X-ray for live DenseNet121 inference and explainable results.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] }),
  component: Analyze,
});
