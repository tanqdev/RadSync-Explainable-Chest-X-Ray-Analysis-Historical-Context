import { createFileRoute } from '@tanstack/react-router';
import { About } from '@/components/thorax/About';
export const Route = createFileRoute('/about')({
  head: () => ({ meta: [{ title: 'About the Research — RadSync' }, { name: 'description', content: 'Learn about the RadSync chest X-ray classification, localization, and explainable AI research project.' }, { property: 'og:title', content: 'About the Research — RadSync' }, { property: 'og:description', content: 'The RadSync workflow, from DenseNet121 to historical contextual summaries.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] }),
  component: About,
});
