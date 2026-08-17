import { EmailTestForm } from './EmailTestForm';

export const dynamic = 'force-dynamic';

export default function AdminEmailTestPage() {
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-black mb-1">Email test</h1>
      <p className="text-ink-70 text-sm mb-6">
        Send a test email from the production server using the configured Resend
        credentials. Use this to verify that email delivery is working end-to-end.
      </p>

      <div className="bg-paper border-2 border-line p-5 mb-6">
        <h2 className="text-[14px] font-extrabold uppercase tracking-[0.05em] mb-3">
          Send a test
        </h2>
        <EmailTestForm />
      </div>

      <div className="bg-cream-2 border-2 border-line p-5 text-[12px] text-ink-70 space-y-2">
        <h3 className="text-[12px] font-extrabold uppercase tracking-[0.05em] text-ink">
          Troubleshooting
        </h3>
        <ul className="space-y-1 list-disc pl-5">
          <li>
            If the form says <code className="px-1 bg-paper">RESEND_API_KEY is not set</code>:
            add it in Vercel → Project Settings → Environment Variables.
          </li>
          <li>
            If the form says <code className="px-1 bg-paper">Resend error: domain not verified</code>:
            verify your sending domain in the{' '}
            <a href="https://resend.com/domains" target="_blank" rel="noopener" className="text-orange-d underline">
              Resend dashboard
            </a>
            .
          </li>
          <li>
            If the form succeeds but you don&apos;t see the email: check the recipient&apos;s
            spam folder, and verify the <code className="px-1 bg-paper">From</code> address
            in the diagnostic dump below.
          </li>
        </ul>
      </div>
    </div>
  );
}
