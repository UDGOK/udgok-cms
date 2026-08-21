/**
 * Regression: /contact exists, is public, and the Enterprise pricing
 * CTA no longer goes to mailto: (which was a black hole for leads).
 *
 * The /contact page and ContactForm component are server/client
 * components — we don't try to render them here. We just guard the
 * URL patterns to make sure the previous gaps stay closed.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const contactPage = join(process.cwd(), 'app/contact/page.tsx');
const contactForm = join(process.cwd(), 'app/contact/ContactForm.tsx');
const contactAction = join(process.cwd(), 'app/contact/actions.ts');
const pricingQueries = join(process.cwd(), 'lib/marketing/queries.ts');
const middleware = join(process.cwd(), 'middleware.ts');
const marketingNav = join(process.cwd(), 'components/marketing/MarketingNav.tsx');

describe('/contact — sales lead capture', () => {
  it('page exists', () => {
    expect(existsSync(contactPage)).toBe(true);
  });

  it('ContactForm component exists', () => {
    expect(existsSync(contactForm)).toBe(true);
  });

  it('server action exists', () => {
    expect(existsSync(contactAction)).toBe(true);
  });

  it('Enterprise pricing CTA is no longer a mailto:', () => {
    const src = readFileSync(pricingQueries, 'utf-8');
    // The Enterprise plan was the regression — it used to be
    // 'mailto:sales@udgok.com' which made leads disappear. Now
    // it should point at the /contact form.
    const enterpriseIdx = src.indexOf("name: 'Enterprise'");
    expect(enterpriseIdx).toBeGreaterThanOrEqual(0);
    const enterprise = src.slice(enterpriseIdx, enterpriseIdx + 1000);
    expect(enterprise).toMatch(/href:\s*['"]\/contact\?plan=enterprise/);
    expect(enterprise).not.toMatch(/mailto:/);
  });

  it('/contact is in the middleware public-route list', () => {
    const src = readFileSync(middleware, 'utf-8');
    expect(src).toMatch(/'\/contact'/);
  });

  it('MarketingNav has a Contact link', () => {
    const src = readFileSync(marketingNav, 'utf-8');
    expect(src).toMatch(/href=["']\/contact["']/);
  });

  it('contact action persists a MarketingLead row', () => {
    const src = readFileSync(contactAction, 'utf-8');
    expect(src).toContain('prisma.marketingLead.create');
  });

  it('contact action sends an owner alert', () => {
    const src = readFileSync(contactAction, 'utf-8');
    expect(src).toContain('sendNewLeadAlert');
  });
});
