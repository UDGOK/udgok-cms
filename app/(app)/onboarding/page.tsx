import { OnboardingForm } from './OnboardingForm';
import { TrialWelcome } from './TrialWelcome';

export default function OnboardingPage() {
  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-8">
      <div className="max-w-xl w-full">
        <div className="label-eyebrow mb-4">{'// New workspace'}</div>
        <h1 className="text-display-lg mb-4">
          Let&apos;s <span className="font-serif italic text-orange-d">set up</span> your workspace.
        </h1>
        <p className="text-base text-ink-70 mb-8">
          A workspace is where all your clients, projects, and pay apps live. Most contractors
          have one per company, but you can create as many as you need.
        </p>
        <TrialWelcome />
        <OnboardingForm />
      </div>
    </div>
  );
}
