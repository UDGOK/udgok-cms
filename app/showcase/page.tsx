import { Button, Card, CardHeader, CardTitle, CardBody, Input, Field, Badge, SectionNumber, StatusBadge } from '@/components/ui';

/**
 * Dev-only design system showcase. Renders every primitive so you can verify
 * the UDGOK Bold theme is wired correctly.
 *
 * Access at /showcase in dev. Will be removed before production (or guarded
 * behind NODE_ENV !== 'production' in a later task).
 */
export default function ShowcasePage() {
  return (
    <div className="max-w-5xl mx-auto px-8 py-16 space-y-16">
      <header>
        <div className="label-eyebrow mb-4">UDGOK Bold · Design System</div>
        <h1 className="text-display-lg">
          Every component, <span className="font-serif italic text-orange-d">in one place.</span>
        </h1>
        <p className="text-base text-ink-70 mt-4 max-w-2xl">
          Cream paper. Deep navy ink. UDGOK orange accent. Inter Black for impact, Inter 500 for body,
          JetBrains Mono for labels. If something looks off, fix it in tailwind.config.ts and styles/globals.css.
        </p>
      </header>

      <section>
        <SectionNumber num={1}>Buttons</SectionNumber>
        <Card className="mt-6">
          <CardBody>
            <div className="flex flex-wrap gap-3">
              <Button variant="primary">Primary action</Button>
              <Button variant="copper">Copper</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Danger</Button>
              <Button variant="primary" size="sm">Small</Button>
              <Button variant="primary" size="lg">Large</Button>
            </div>
          </CardBody>
        </Card>
      </section>

      <section>
        <SectionNumber num={2}>Badges</SectionNumber>
        <Card className="mt-6">
          <CardBody>
            <div className="flex flex-wrap gap-2">
              <Badge>Default</Badge>
              <Badge variant="navy">Navy</Badge>
              <Badge variant="copper">Copper</Badge>
              <Badge variant="success">Success</Badge>
              <Badge variant="warn">Warning</Badge>
              <Badge variant="error">Error</Badge>
              <Badge variant="neutral">Neutral</Badge>
            </div>
          </CardBody>
        </Card>
      </section>

      <section>
        <SectionNumber num={3}>Status Badges</SectionNumber>
        <Card className="mt-6">
          <CardBody>
            <div className="flex flex-wrap gap-2">
              <StatusBadge status="active" prefix="●" />
              <StatusBadge status="draft" />
              <StatusBadge status="sent" prefix="●" />
              <StatusBadge status="viewed" prefix="●" />
              <StatusBadge status="paid" prefix="●" />
              <StatusBadge status="won" prefix="●" />
              <StatusBadge status="lost" />
              <StatusBadge status="overdue" />
              <StatusBadge status="blocked" />
            </div>
          </CardBody>
        </Card>
      </section>

      <section>
        <SectionNumber num={4}>Cards</SectionNumber>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Default card</CardTitle>
              <span className="label-mono">{"// 01"}</span>
            </CardHeader>
            <CardBody>
              <p className="text-sm text-ink-70">
                White paper, hairline border. Use for most containers.
              </p>
            </CardBody>
          </Card>
          <Card interactive>
            <CardBody>
              <p className="font-extrabold text-sm uppercase tracking-tight">Interactive card</p>
              <p className="text-sm text-ink-70 mt-2">Hover me — I lift with a navy border.</p>
            </CardBody>
          </Card>
        </div>
      </section>

      <section>
        <SectionNumber num={5}>Form fields</SectionNumber>
        <Card className="mt-6">
          <CardBody>
            <div className="max-w-md space-y-0">
              <Field label="Project name" htmlFor="demo-name">
                <Input id="demo-name" defaultValue="1247 Oak St · Kitchen" />
              </Field>
              <Field label="Description" htmlFor="demo-desc" hint="optional">
                <Input id="demo-desc" placeholder="What is this project?" />
              </Field>
              <Field label="Notes" htmlFor="demo-notes" error="Notes are required.">
                <Input id="demo-notes" placeholder="Add notes…" />
              </Field>
            </div>
          </CardBody>
        </Card>
      </section>

      <section>
        <SectionNumber num={6}>Type scale</SectionNumber>
        <Card className="mt-6">
          <CardBody className="space-y-6">
            <h1 className="text-display-xl">Display XL</h1>
            <h2 className="text-display-lg">Display LG</h2>
            <h3 className="text-display-md">Display MD</h3>
            <p className="text-base text-ink-70">
              Body text — Inter 500, 16px. <span className="font-extrabold text-ink">Bold runs</span> for emphasis,
              <span className="font-serif italic text-orange-d"> italic serif</span> for the UDGOK signature accent.
            </p>
            <p className="label-mono">{"// LABEL · MONO · 10PX · 0.15em tracking"}</p>
            <p className="label-eyebrow">{"// LABEL · EYEBROW · 12PX · 0.2em tracking"}</p>
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
