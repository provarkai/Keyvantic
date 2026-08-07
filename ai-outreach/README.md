# AI Outreach

Enter a company name or website. The app researches the company, works out what it
does, surfaces its pain points and opportunities, identifies where AI or automation
would actually help — then writes a personalised cold outreach email you can edit
and copy.

Standalone Next.js app. All model calls go through [OpenRouter](https://openrouter.ai),
server-side only.

---

## Quickstart

```bash
cd ai-outreach
npm install
cp .env.example .env.local     # add your OPENROUTER_API_KEY
npm run dev                    # http://localhost:3000
```

Get a key at [openrouter.ai/keys](https://openrouter.ai/keys). Without one the app
loads and tells you what's missing rather than failing silently.

---

## How it works

```
company name / website
        │
        ▼
  POST /api/research ──► fetch the homepage (SSRF-guarded, size- and time-capped)
        │                       │
        │                       ▼
        │               OpenRouter chat completion, structured JSON output
        │                       │
        ▼                       ▼
   analysis panel      what they do · pain points · opportunities ·
                       AI opportunities · outreach angles · assumptions
        │
        ▼
  POST /api/email  ──► OpenRouter, seeded with the brief + your sender details
        │
        ▼
   editable email + follow-up sequence + copy buttons
```

The research step runs first and the email step is chained off it automatically, so
one click produces both. "Rewrite email" re-runs only the second step — useful for
trying a different tone or angle without paying for the research again.

### Grounding

When a website is supplied, the server fetches the homepage and passes the extracted
copy to the model as primary evidence. This is the single biggest quality lever: with
page copy the brief cites real product names and positioning, without it the model is
working from recall and the `confidence` field drops accordingly.

Every pain point carries an `evidence` field, and the model is instructed to write
"Inferred from industry pattern" rather than dress up a guess. Assumptions are listed
separately so you can see what the brief is standing on.

### Prompt-injection posture

Scraped page copy is untrusted third-party text. It is delimited in the prompt and
explicitly labelled as data to be analysed, not instructions to follow. The output is
constrained by a JSON Schema and validated with Zod before it reaches the UI, so a
page that tries to steer the model still can't change the response shape.

---

## Configuration

All settings are environment variables — see [`.env.example`](./.env.example).

| Variable | Default | Purpose |
|---|---|---|
| `OPENROUTER_API_KEY` | — | **Required.** Server-side only, never sent to the browser. |
| `OPENROUTER_MODEL` | `anthropic/claude-sonnet-5` | Model for both steps. |
| `OPENROUTER_EMAIL_MODEL` | falls back to `OPENROUTER_MODEL` | Lets the email step run on something cheaper. |
| `OPENROUTER_ALLOWED_MODELS` | curated list | Comma-separated allowlist offered in the UI picker. |
| `OPENROUTER_SITE_URL` / `OPENROUTER_APP_NAME` | localhost / `AI Outreach` | Attribution headers for openrouter.ai rankings. |
| `SCRAPE_COMPANY_SITE` | `true` | Fetch the company homepage as evidence. |
| `OPENROUTER_WEB_SEARCH` | `false` | Attach OpenRouter's web-search plugin to the research call. Costs more. |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` | `20` / `60000` | Per-IP request cap. |

The client can only request models on the allowlist — an arbitrary `model` in the
request body is ignored and the server default is used instead, so a caller can't
redirect your credits to an expensive model.

---

## API

| Route | Method | Body | Returns |
|---|---|---|---|
| `/api/config` | GET | — | Non-secret config: whether a key is set, selectable models |
| `/api/research` | POST | `{ companyName?, website?, model? }` | `{ research, sources, model, elapsedMs }` |
| `/api/email` | POST | `{ research, sender, model? }` | `{ email, model, elapsedMs }` |

At least one of `companyName` or `website` is required. Errors come back as
`{ error, detail? }` with a meaningful status: `400` invalid input, `429` rate limited,
`503` not configured, `502`/`504` upstream problems.

---

## Production notes

**Secrets.** The key is read only in `src/lib/env.ts`, which is marked `server-only`;
importing it from a client component is a build error. There is no `NEXT_PUBLIC_`
variable holding anything sensitive.

**Model output is never trusted.** Structured outputs are requested via strict
`json_schema`, with an automatic fallback to `json_object` for models that don't
support it, a tolerant JSON extractor for fenced/prefixed responses, and one
schema-aware repair round-trip before giving up.

**SSRF.** User-supplied URLs are resolved and checked against loopback, private,
link-local (including `169.254.169.254`), CGNAT and multicast ranges — on every
redirect hop, not just the first. Non-HTTP schemes are rejected, redirects are capped
at 3, the body at 512 KB and the request at 10s.

**Rate limiting** is in-memory and therefore per instance. That's a guardrail against
a stuck client, not a global quota — swap the store in `src/lib/rate-limit.ts` for
Redis if you run more than one instance and need a hard limit.

**Timeouts.** Model calls abort at 120s; routes declare `maxDuration = 120`. On
Vercel this needs a plan that allows a 120s function duration, or lower both.

### Deploying to Vercel

```bash
npx vercel --cwd ai-outreach
```

Set `OPENROUTER_API_KEY` (and optionally `OPENROUTER_MODEL`, `OPENROUTER_SITE_URL`)
in the project's environment variables. No other infrastructure is required — there is
no database and no session state.

---

## Development

```bash
npm run dev         # dev server
npm run build       # production build
npm run start       # serve the production build
npm run typecheck   # tsc --noEmit
npm run lint        # eslint, zero warnings tolerated
npm test            # vitest
```

### Layout

```
src/
  app/
    page.tsx                 orchestrates the two-step flow and owns all UI state
    api/research/route.ts    scrape + research completion
    api/email/route.ts       email completion
    api/config/route.ts      non-secret config for the browser
  components/
    research-form.tsx        company input, sender details, model picker
    analysis-panel.tsx       the research brief
    email-composer.tsx       editable email, subject alternatives, follow-ups
    copy-button.tsx          clipboard with an execCommand fallback
    ui.tsx, icons.tsx        shared primitives
  lib/
    env.ts                   server-only configuration
    openrouter.ts            completion client: retries, fallbacks, validation
    prompts.ts               system prompts and prompt builders
    schemas.ts               Zod contracts shared by the API and the UI
    json-schemas.ts          strict JSON Schemas for structured outputs
    json-repair.ts           tolerant JSON extraction
    site-fetch.ts            SSRF-guarded scraper and HTML-to-text
    rate-limit.ts            per-IP fixed window
    sender-store.ts          sender details persisted to localStorage
```

### Tuning output quality

Prompt changes belong in `src/lib/prompts.ts` — the email rules there (no "I hope this
finds you well", no invented metrics, no bracketed placeholders, one idea per email)
are what keep drafts sendable. If you change the shape of the output, update both
`schemas.ts` and `json-schemas.ts`; a test asserts the two stay in sync.

---

## What this app does not do

- No CRM, contact lookup or email sending — it drafts, you send.
- No persistence. Research and drafts live in the page; only your sender details are
  kept, in `localStorage`.
- No streaming. Responses arrive complete so they can be schema-validated before
  rendering.

Always read a draft before sending it. The model is told not to invent metrics or
customer names, but it is still a model — check names, claims and figures.
