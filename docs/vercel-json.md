# vercel.json — strict schema, no extra properties

Vercel's `vercel.json` schema is **strict**. The validator rejects the
build if any property is present that isn't in the official schema.
This bites especially hard because JSON has no native comment syntax —
you can't add a `// explanation` field the way you can in a JS file.

**What broke (Aug 2026):** I added an explanation as a `// note` property
to vercel.json, like so:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "// note": "We do prisma db push BEFORE generate so schema changes
            actually reach the production DB. Without this...",
  "buildCommand": "...",
  "installCommand": "..."
}
```

Vercel rejected the whole file with:

> vercel.json schema validation should NOT have additional property
> '// note'. The build output contains 0 events, consistent with
> configuration validation stopping the build early.

The site went down even though `pnpm build` succeeded locally —
Vercel never even started the build, it bailed at config validation.

**The fix:** drop the `// note` property. Keep the rationale in a
markdown doc (this file) or in the commit message that introduced
the buildCommand. The Vercel schema only knows these top-level
properties: `buildCommand`, `installCommand`, `devCommand`,
`framework`, `outputDirectory`, `builds`, `routes`, `cleanUrls`,
`trailingSlash`, `redirects`, `rewrites`, `headers`, `crons`,
`functions`, `regions`, `trailingSlash`, `github`, `gitlab`,
`bitbucket`, `env`, `build`, `public`, `alias`.

**Where to put explanations instead:**
- Markdown docs (this file)
- Commit message body
- An adjacent README
- A code comment in a TS/JS file that does the same thing

Never in vercel.json itself.
