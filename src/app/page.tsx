import ChannelEconomicsChart from "@/components/charts/ChannelEconomicsChart";
import CohortLtvChart from "@/components/charts/CohortLtvChart";
import ChannelTable from "@/components/dashboard/ChannelTable";
import StatTile from "@/components/ui/StatTile";
import { getChannelEconomics } from "@/lib/analytics/channels";
import { getCohortLtvSeries } from "@/lib/analytics/cohorts";
import { getPortfolioSummary } from "@/lib/analytics/summary";
import {
  formatCents,
  formatCohortMonth,
  formatPercent,
  formatRatio,
} from "@/lib/format";

/**
 * The dashboard.
 *
 * Rendered per request rather than at build time: the three queries read a
 * database that the seed script rewrites, and a prerendered page would pin the
 * numbers to whatever the tree looked like when it was compiled. This is a
 * reporting surface — a stale figure presented as current is worse than a slow
 * one.
 */
export const dynamic = "force-dynamic";

export default async function Home() {
  // Concurrent, not sequential: the three modules touch different tables and
  // share nothing, so awaiting them in turn would stack three independent round
  // trips into one serial wait for no reason.
  const [summary, cohorts, channels] = await Promise.all([
    getPortfolioSummary(),
    getCohortLtvSeries(),
    getChannelEconomics(),
  ]);

  const isEmpty = summary.customers === 0;

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 font-sans dark:bg-black">
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-10 px-5 py-10 sm:px-8 lg:py-14">
        <header className="flex flex-col gap-3 border-b border-black/[.08] pb-6 dark:border-white/[.145] sm:flex-row sm:items-end sm:justify-between sm:gap-6">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              LTV Marketing Engine
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Cohort lifetime value and paid-acquisition payback, by channel.
            </p>
          </div>

          {/*
            The label is the data's edge, not today's date. Every window in every
            module below is measured against the newest order in the table, so
            saying "today" would claim currency the figures do not have on a
            database that has not been written to in a week.
          */}
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            {summary.lastOrderDate ? (
              <>
                Data through{" "}
                <time
                  dateTime={summary.lastOrderDate}
                  className="font-medium text-foreground"
                >
                  {formatIsoDate(summary.lastOrderDate)}
                </time>
              </>
            ) : (
              "No orders recorded"
            )}
          </p>
        </header>

        {isEmpty ? (
          <EmptyState />
        ) : (
          <>
            <section className="flex flex-col gap-4">
              <h2 className="sr-only">Portfolio summary</h2>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <StatTile
                  label="Customers acquired"
                  value={summary.customers.toLocaleString("en-US")}
                  sublabel={`${summary.orders.toLocaleString("en-US")} orders placed`}
                />
                <StatTile
                  label="Net revenue"
                  value={formatCents(summary.netRevenueCents)}
                  sublabel="Gross, less discounts and refunds"
                />
                <StatTile
                  label="Paid spend"
                  value={formatCents(summary.paidSpendCents)}
                  sublabel="Excludes organic and email"
                />
                <StatTile
                  label="Blended ROAS"
                  value={formatRatio(summary.blendedRoas)}
                  sublabel="Net revenue per $1 of paid spend, all channels"
                />
                <StatTile
                  label="Average order value"
                  value={formatCents(summary.averageOrderValueCents)}
                  sublabel="Net, across every order"
                />
                <StatTile
                  label="Repeat purchase rate"
                  value={formatPercent(summary.repeatPurchaseRate)}
                  sublabel="Customers with two or more orders"
                />
              </div>
            </section>

            <section className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <h2 className="text-lg font-semibold tracking-tight text-foreground">
                  Cohort value and channel economics
                </h2>
                {/*
                  Each sentence names its chart rather than pointing at it: the
                  pair sits side by side on a wide screen and stacked on a narrow
                  one, so "left" and "right" would be wrong half the time.
                */}
                <p className="max-w-3xl text-sm text-zinc-600 dark:text-zinc-400">
                  The cohort curve is cumulative net revenue per acquired
                  customer, by acquisition month — one line per intake, followed
                  forward as it keeps buying, ending where that cohort&rsquo;s
                  observed history ends. The channel chart sets what a customer
                  costs to acquire against what one is worth after 365 days.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <CohortLtvChart series={cohorts} height={340} />
                <ChannelEconomicsChart channels={channels} height={340} />
              </div>
            </section>

            <section className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <h2 className="text-lg font-semibold tracking-tight text-foreground">
                  Channel detail
                </h2>
                <p className="max-w-3xl text-sm text-zinc-600 dark:text-zinc-400">
                  Every channel and every window as figures, ordered by customers
                  acquired.
                </p>
              </div>

              <ChannelTable channels={channels} />
            </section>
          </>
        )}

        <footer className="mt-auto border-t border-black/[.08] pt-6 text-xs text-zinc-500 dark:border-white/[.145] dark:text-zinc-400">
          <p className="max-w-3xl">
            Generated demo data. The customers, orders and marketing spend behind
            every figure on this page are synthesised by{" "}
            <code className="rounded bg-black/[.06] px-1 py-0.5 font-mono dark:bg-white/[.08]">
              scripts/seed.ts
            </code>
            . Nothing here describes a real business.
          </p>
        </footer>
      </main>
    </div>
  );
}

/** Shown when the database is reachable but has nothing in it yet. */
function EmptyState() {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-black/[.08] bg-background p-6 dark:border-white/[.145]">
      <h2 className="text-base font-semibold tracking-tight text-foreground">
        No data yet
      </h2>
      <p className="max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
        The database has no customers, so there is nothing to cohort and no
        channel to cost. Create the tables and generate the demo dataset:
      </p>
      <code className="rounded-lg bg-black/[.06] px-3 py-2 font-mono text-sm text-foreground dark:bg-white/[.08]">
        npm run db:migrate &amp;&amp; npm run db:seed
      </code>
    </div>
  );
}

/**
 * `"2026-08-14"` -> `"Aug 14, 2026"`.
 *
 * Split by hand and passed through `formatCohortMonth` for the month name,
 * rather than through `new Date(iso)`, which parses a bare ISO date as UTC
 * midnight and renders the previous day for every reader west of Greenwich. A
 * "data through" label that disagrees with itself depending on who opens the
 * page is the kind of thing that costs an afternoon to chase.
 */
function formatIsoDate(iso: string): string {
  const match = /^(\d{4}-\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;

  const monthAndYear = formatCohortMonth(match[1]);
  // An unparseable month falls through unchanged; do not staple a day onto it.
  if (monthAndYear === match[1]) return iso;

  const [month, year] = monthAndYear.split(" ");
  return `${month} ${Number(match[2])}, ${year}`;
}
