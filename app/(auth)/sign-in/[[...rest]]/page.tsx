import { SignIn } from '@clerk/nextjs';
import Link from 'next/link';

export const metadata = {
  title: 'Sign in — UDGOK CMS',
  description: 'Sign in to your UDGOK CMS workspace.',
};

export default function SignInPage() {
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
            href="/sign-up"
            className="text-[12px] font-extrabold uppercase tracking-[0.12em] text-ink-50 hover:text-ink"
          >
            New here? <span className="text-orange-d">Sign up →</span>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 md:p-8">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-orange-d mb-2 font-bold">
              {'// Welcome back'}
            </div>
            <h1 className="font-black text-3xl md:text-4xl tracking-[-0.02em]">
              Sign in to <span className="font-serif italic text-orange-d">UDGOK.</span>
            </h1>
          </div>
          <SignIn
            appearance={{
              elements: {
                rootBox: 'mx-auto',
                card: 'shadow-none border-2 border-ink bg-paper',
                formButtonPrimary:
                  'bg-ink hover:bg-orange border-2 border-ink hover:border-orange text-[11px] font-extrabold uppercase tracking-[0.15em] py-3',
                headerTitle: 'hidden',
                headerSubtitle: 'hidden',
                socialButtonsBlockButton:
                  'border-2 border-line hover:border-ink hover:bg-cream-2 text-ink',
                socialButtonsBlockButtonText: 'font-extrabold text-[12px] uppercase tracking-[0.1em]',
                formFieldInput:
                  'border-2 border-line focus:border-ink focus:ring-0',
                formFieldLabel: 'text-[11px] font-extrabold uppercase tracking-[0.1em] text-ink-70',
                footerActionLink: 'text-orange-d hover:underline font-bold',
                dividerLine: 'bg-line',
                dividerText: 'text-[10px] font-mono uppercase tracking-[0.15em] text-ink-50',
                identityPreviewText: 'font-bold',
                formResendCodeLink: 'text-orange-d hover:underline',
              },
            }}
          />
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
