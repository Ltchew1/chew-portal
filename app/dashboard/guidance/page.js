// app/dashboard/guidance/page.js
import PageHeader from '../../components/PageHeader';
import EmptyState from '../../components/EmptyState';
import { IconSparkles } from '../../components/icons';

export default function GuidancePage() {
  return (
    <>
      <PageHeader
        eyebrow="CHEW Guidance"
        title="Personalized AI-assisted guidance"
        description="A conversational guide that draws on your strategy to suggest next steps and answer questions."
      />

      <EmptyState
        icon={<IconSparkles />}
        title="CHEW Guidance is coming soon"
        description="This will provide personalized educational guidance based on your action plan — with clear disclaimers, since it never gives legal or financial guarantees."
      />
    </>
  );
}
