# LTV Marketing Engine

Cohort lifetime value and paid-acquisition payback reporting.

It answers the question paid marketing actually turns on: *not* which channel is
cheapest to buy from, but which one is worth buying from once you follow the
customers forward. Those are usually different channels, and a dashboard that
only reports CAC will point you at the wrong one.

## Quick start

```bash
npm install
npm run db:migrate   # create the schema
npm run db:seed      # generate the demo dataset
npm run dev          # http://localhost:3000
```

No database to install. With `DATABASE_URL` unset the app runs on
[PGlite](https://pglite.dev) — real Postgres compiled to WASM, persisting to a
git-ignored `./.pglite` directory. Point `DATABASE_URL` at a real Postgres and
the same migrations and the same SQL run against it unchanged.

```bash
DATABASE_URL=postgres://user:pass@host/db npm run db:migrate
```

## What it reports

**Cohort LTV curves.** Cumulative net revenue per acquired customer, grouped by
acquisition month and followed forward. Each cohort's curve ends where its
observed history ends — a cohort acquired two months ago has exactly three
points, not a flat tail of zeros out to month 23. That padding is the most
common bug in cohort reporting: it drags every average down and makes lifetime
value look like it is collapsing when nothing has changed.

**Channel economics.** CAC, LTV at 90/180/365 days, LTV:CAC, and payback period
per acquisition channel. Each LTV window averages only over customers old enough
to have been observed for that whole window, so a customer acquired last week
cannot drag down a 365-day figure.

**Portfolio summary.** Customers, orders, net revenue, paid spend, blended ROAS,
average order value, repeat purchase rate.

Throughout, **null means "not measurable", never zero**, and renders as an em
dash. Organic and email have no acquisition cost, so they have no CAC — showing
`$0` there would make them look infinitely efficient and would eventually cause
someone to move budget on the strength of a rendering artifact.

## Architecture

```
src/
  db/
    schema.ts      customers, orders, marketing_spend
    index.ts       getDb() + query<T>() — normalises the two drivers
  lib/
    analytics/
      types.ts     the contract between queries and UI
      coerce.ts    num() / numOrNull() / safeRatio() / toIsoDate()
      cohorts.ts   getCohortLtvSeries()
      channels.ts  getChannelEconomics()
      summary.ts   getPortfolioSummary()
    format.ts      cents/ratio/percent formatters — null always renders "—"
  components/
    charts/        Recharts client components
    dashboard/     ChannelTable
    ui/            StatTile
  app/page.tsx     server component, fetches all three concurrently
```

Aggregation happens in SQL, not JavaScript. The queries are written to run over
a table of orders far larger than fits in a request's memory.

### Two things worth knowing before you edit

**Money is integer cents everywhere**, right up to the formatting layer. Floats
accumulate error across millions of order rows.

**Every aggregate read from raw SQL goes through `num()`.** Postgres returns
`count()` and `sum()` as bigint and numeric; PGlite hands those back as JS
numbers while postgres.js hands back strings, because a bigint does not always
fit in a double. Unwrapped, `spend + revenue` is arithmetic in development and
string concatenation in production.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run db:generate` | Generate migrations from `schema.ts` |
| `npm run db:migrate` | Apply migrations |
| `npm run db:seed` | Regenerate the demo dataset |
| `npm run db:reset` | Drop `.pglite`, migrate, reseed |

## The demo data is not real

`scripts/seed.ts` synthesises 24 monthly cohorts — about 2,200 customers and
3,400 orders — from a seeded PRNG, so every run produces an identical database
and the numbers on the dashboard are stable enough to assert against in tests.

The channels are deliberately built so that **the cheapest to acquire from is
the worst to own**: TikTok buys customers at the lowest CAC and retains them
worst, while email costs nothing and retains best. That inversion is what the
reporting exists to surface, so the demo data has to contain it.

Nothing in the seed describes a real business.

## Status

Reporting over a generic ecommerce shape (customers, orders, spend). Ingestion
from real sources — Shopify, Stripe, a warehouse, ad platform APIs — is not
built yet; `source` and `external_id` columns are on every table ready for it.

Predictive LTV (BG/NBD, Gamma-Gamma) is deliberately absent. Historical cohort
LTV computed in SQL answers most real questions at a fraction of the complexity.
When the predictive layer is worth adding, it belongs in a scheduled Python job
writing into a predictions table that this app reads like any other — not as a
synchronous dependency of the web tier.
