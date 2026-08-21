import Link from 'next/link';
import { SignUpClient } from './SignUpClient';

export const metadata = {
  title: 'Sign up — UDGOK CMS',
  description: 'Create your free UDGOK CMS account. No credit card required.',
};

export default function SignUpPage({
  searchParams,
}: {
  searchParams: { plan?: string };
}) {
  const plan = searchParams.plan;
  const isTrial = plan === 'pro' || plan === 'enterprise';
  return (
    <div className="min-h-screen bg-cream flex flex-col">
      <header className="bg-paper border-b-2 border-ink">
        <div className="max-w-7xl mx-auto px-5 md:px-8 py-4 flex items-center justify-between">
          <Link href="/" className="font-black text-xl md:text-2xl tracking-tight flex items-center gap-2">
            <span className="w-7 h-7 md:w-8 md:h-8 bg-ink text-cream flex items-center justify-center font-black text-sm">
              U
            </span>
            UDG<span className="text-orange">OK</span>
          </Link>
          <Link
            href="/sign-in"
            className="text-[12px] font-extrabold uppercase tracking-[0.12em] text-ink-50 hover:text-ink"
          >
            Already have an account? <span className="text-orange-d">Sign in →</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-orange-d mb-2 font-bold">
              {isTrial ? '// Start your 14-day Pro trial' : '// Start your first workspace'}
            </div>
            <h1 className="font-black text-3xl md:text-4xl tracking-[-0.02em]">
              {isTrial ? (
                <>
                  Start your <span className="font-serif italic text-orange-d">Pro trial.</span>
                </>
              ) : (
                <>
                  Get <span className="font-serif italic text-orange-d">started</span> in 2 minutes.
                </>
              )}
            </h1>
            <p className="text-[13px] text-ink-50 mt-2 font-mono uppercase tracking-[0.1em]">
              {isTrial
                ? '14 days Pro · no credit card · cancel anytime'
                : 'Free forever · No credit card'}
            </p>
          </div>
          <SignUpClient plan={plan} />
          <p className="text-[11px] text-ink-50 text-center mt-4 font-mono uppercase tracking-[0.05em]">
            By signing up you agree to our{' '}
            <Link href="/terms" className="text-ink-70 underline">Terms</Link> and{' '}
            <Link href="/privacy" className="text-ink-70 underline">Privacy Policy</Link>.
          </p>
        </div>
      </main>

      <footer className="border-t border-line bg-paper">
        <div className="max-w-7xl mx-auto px-5 md:px-8 py-4 flex flex-col md:flex-row items-center justify-between gap-2 text-[10px] font-mono uppercase tracking-[0.1em] text-ink-50">
          <span>© 2026 UDGOK Construction</span>
          <span className="flex gap-4">
            <Link href="/" className="hover:text-ink">Home</Link>
            <Link href="/pricing" className="hover:text-ink">Pricing</Link>
            <Link href="/features" className="hover:text-ink">Features</Link>
          </span>
        </div>
      </footer>
    </div>
  );
}
