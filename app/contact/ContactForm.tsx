'use client';

import { useFormState, useFormStatus } from 'react-dom';
import { submitContactForm, type ContactFormState } from './actions';

interface ContactFormProps {
  source?: string;
  plan?: string;
  page?: string;
  title?: string;
  subtitle?: string;
}

const INITIAL: ContactFormState = undefined;

export function ContactForm({
  source = 'contact',
  plan,
  page,
  title = 'Talk to us.',
  subtitle = 'Sales, support, partnership, press — whatever you need, we read every message.',
}: ContactFormProps) {
  const [state, action] = useFormState(submitContactForm, INITIAL);

  if (state?.ok) {
    return (
      <div className="bg-paper border-2 border-success p-6">
        <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-success font-bold mb-2">
          {'// Message received'}
        </div>
        <h2 className="text-2xl font-black mb-2">Got it.</h2>
        <p className="text-ink-70">{state.message}</p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5 bg-paper border-2 border-ink p-6 md:p-8">
      <div>
        <div className="text-[10px] font-mono uppercase tracking-[0.18em] text-orange-d font-bold mb-1">
          {`// ${title.toLowerCase()}`}
        </div>
        <h2 className="text-2xl md:text-3xl font-black mb-2">{title}</h2>
        <p className="text-[14px] text-ink-70">{subtitle}</p>
      </div>

      <input type="hidden" name="source" value={source} />
      {plan ? <input type="hidden" name="plan" value={plan} /> : null}
      {page ? <input type="hidden" name="page" value={page} /> : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field
          name="name"
          label="Your name"
          placeholder="Yasir Khan"
          error={state && !state.ok ? state.fieldErrors?.name : undefined}
        />
        <Field
          name="email"
          label="Email *"
          type="email"
          required
          placeholder="you@yourcompany.com"
          error={state && !state.ok ? state.fieldErrors?.email : undefined}
        />
        <Field
          name="company"
          label="Company"
          placeholder="UDGOK Construction"
          error={state && !state.ok ? state.fieldErrors?.company : undefined}
        />
        <Field
          name="phone"
          label="Phone"
          type="tel"
          placeholder="(optional)"
          error={state && !state.ok ? state.fieldErrors?.phone : undefined}
        />
      </div>

      <div>
        <label htmlFor="message" className="block text-[11px] font-extrabold uppercase tracking-[0.1em] text-ink-70 mb-1.5">
          How can we help? *
        </label>
        <textarea
          id="message"
          name="message"
          required
          minLength={10}
          maxLength={2000}
          rows={5}
          placeholder="Tell us a bit about your team, what you're using today, and what you're looking for."
          className={`w-full px-3 py-2.5 border-2 text-[14px] font-mono focus:outline-none focus:border-ink ${
            state && !state.ok && state.fieldErrors?.message
              ? 'border-error'
              : 'border-line'
          }`}
        />
        {state && !state.ok && state.fieldErrors?.message ? (
          <div className="text-[11px] text-error mt-1">{state.fieldErrors.message}</div>
        ) : null}
      </div>

      {state && !state.ok ? (
        <div className="text-[12px] text-error font-mono">
          ⚠ {state.error}
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <SubmitButton source={source} />
        <span className="text-[11px] text-ink-50 font-mono">
          We respond within 1 business day.
        </span>
      </div>

      <p className="text-[10px] text-ink-50 font-mono pt-2 border-t border-line-soft">
        By submitting you agree to our{' '}
        <a href="/privacy" className="underline hover:text-ink">Privacy Policy</a>.
        We never share your info with third parties.
      </p>
    </form>
  );
}

function Field({
  name,
  label,
  type = 'text',
  required = false,
  placeholder,
  error,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  error?: string;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-[11px] font-extrabold uppercase tracking-[0.1em] text-ink-70 mb-1.5">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        className={`w-full px-3 py-2.5 border-2 text-[14px] font-mono focus:outline-none focus:border-ink ${
          error ? 'border-error' : 'border-line'
        }`}
      />
      {error ? <div className="text-[11px] text-error mt-1">{error}</div> : null}
    </div>
  );
}

function SubmitButton({ source }: { source: string }) {
  const { pending } = useFormStatus();
  const label =
    source === 'enterprise'
      ? pending ? 'Sending…' : 'Request enterprise pricing →'
      : pending ? 'Sending…' : 'Send message →';
  return (
    <button
      type="submit"
      disabled={pending}
      className="px-5 py-3 bg-orange text-paper border-2 border-orange text-[12px] font-extrabold uppercase tracking-[0.15em] hover:bg-orange-d hover:border-orange-d disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {label}
    </button>
  );
}
