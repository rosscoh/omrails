import { sql } from "drizzle-orm";

import { query } from "@/db";
import { num } from "./coerce";
import type { CohortLtvPoint, CohortLtvSeries } from "./types";

/**
 * Cumulative LTV curves by acquisition cohort.
 *
 * The one rule that matters here: a cohort only gets datapoints for months it
 * has actually lived through. Padding a young cohort out to month 23 with flat
 * or zero values is the classic cohort-reporting bug — the zeros are read as
 * "these customers stopped spending" rather than "we have not watched them
 * long enough yet", and averaging across cohorts then shows an LTV cliff that
 * does not exist. `observedMonths` is the contract for that: it equals
 * `points.length`, and callers must not extrapolate past it.
 */

/**
 * Longest curve we emit, in month offsets (0..23 = two years of points).
 * Cohort charts are read as a 24-month grid; beyond that the oldest cohorts
 * would each have a different width and the table stops being comparable.
 * Revenue from orders past the window is therefore outside the curve.
 */
const MAX_MONTH_OFFSET = 23;

/** Default number of cohorts returned, matching the 24 months the seed spans. */
const DEFAULT_MAX_COHORTS = 24;

type CohortRow = {
  cohort_month: string;
  cohort_size: unknown;
  observed_months: unknown;
  month_offset: unknown;
  cumulative_net_revenue_cents: unknown;
  cumulative_orders: unknown;
};

export type CohortLtvOptions = {
  /** Restrict to customers acquired through one channel, e.g. "meta". */
  channel?: string;
  /** Keep only the N most recent cohorts. Defaults to 24. */
  maxCohorts?: number;
};

/**
 * Cohort LTV curves, oldest cohort first and newest last so a chart can map
 * the array straight onto its x-axis.
 *
 * Aggregation happens in SQL rather than in JS on purpose: the naive version
 * pulls every order row into the process to bucket it, which is fine on the
 * demo dataset and falls over on a real account with millions of orders.
 */
export async function getCohortLtvSeries(
  options: CohortLtvOptions = {},
): Promise<CohortLtvSeries[]> {
  const channel = options.channel ?? null;
  // Clamped rather than trusted: this value reaches SQL's LIMIT, and a NaN or
  // negative from a query string would otherwise blow up the whole query.
  const maxCohorts = Math.max(
    1,
    Math.floor(options.maxCohorts ?? DEFAULT_MAX_COHORTS),
  );

  const rows = await query<CohortRow>(sql`
    WITH bounds AS (
      -- How far the data has been observed. Deliberately the newest order in
      -- the account rather than today's clock: months we hold no data for are
      -- unobserved, and emitting them as zeros is the bug this guards against.
      -- Not channel-filtered — observability is a property of the dataset.
      SELECT date_trunc('month', max(ordered_at AT TIME ZONE 'UTC')) AS latest_month
      FROM orders
    ),
    cohort_customers AS (
      SELECT
        c.id,
        date_trunc('month', c.first_order_at AT TIME ZONE 'UTC') AS cohort_month
      FROM customers c
      WHERE c.first_order_at IS NOT NULL
        AND (${channel}::text IS NULL OR c.acquisition_channel = ${channel}::text)
    ),
    cohorts AS (
      SELECT
        cc.cohort_month,
        count(*)::int AS cohort_size,
        LEAST(
          GREATEST(
            (
              (EXTRACT(YEAR FROM b.latest_month) - EXTRACT(YEAR FROM cc.cohort_month)) * 12
              + (EXTRACT(MONTH FROM b.latest_month) - EXTRACT(MONTH FROM cc.cohort_month))
            )::int,
            0
          ),
          ${MAX_MONTH_OFFSET}::int
        ) AS max_offset
      FROM cohort_customers cc
      CROSS JOIN bounds b
      GROUP BY cc.cohort_month, b.latest_month
      ORDER BY cc.cohort_month DESC
      LIMIT ${maxCohorts}
    ),
    monthly AS (
      -- Net revenue banked by each cohort in each month of its life. GREATEST
      -- keeps an order dated before the denormalised first_order_at in the
      -- acquisition month instead of dropping its revenue on the floor.
      SELECT
        cc.cohort_month,
        GREATEST(
          (
            (EXTRACT(YEAR FROM o.ordered_at AT TIME ZONE 'UTC') - EXTRACT(YEAR FROM cc.cohort_month)) * 12
            + (EXTRACT(MONTH FROM o.ordered_at AT TIME ZONE 'UTC') - EXTRACT(MONTH FROM cc.cohort_month))
          )::int,
          0
        ) AS month_offset,
        sum(o.gross_revenue_cents - o.discount_cents - o.refund_cents) AS net_revenue_cents,
        count(*) AS order_count
      FROM cohort_customers cc
      JOIN orders o ON o.customer_id = cc.id
      GROUP BY 1, 2
    ),
    -- One row per (cohort, month it has lived through). generate_series stops
    -- at each cohort's own max_offset, so young cohorts are short by
    -- construction and there is no zero-padded tail to strip later.
    observed AS (
      SELECT ch.cohort_month, ch.cohort_size, ch.max_offset, gs.month_offset
      FROM cohorts ch
      CROSS JOIN LATERAL generate_series(0, ch.max_offset) AS gs(month_offset)
    )
    SELECT
      to_char(o.cohort_month, 'YYYY-MM') AS cohort_month,
      o.cohort_size,
      (o.max_offset + 1) AS observed_months,
      o.month_offset,
      sum(COALESCE(m.net_revenue_cents, 0)) OVER (
        PARTITION BY o.cohort_month ORDER BY o.month_offset
        ROWS UNBOUNDED PRECEDING
      ) AS cumulative_net_revenue_cents,
      sum(COALESCE(m.order_count, 0)) OVER (
        PARTITION BY o.cohort_month ORDER BY o.month_offset
        ROWS UNBOUNDED PRECEDING
      ) AS cumulative_orders
    FROM observed o
    LEFT JOIN monthly m
      ON m.cohort_month = o.cohort_month
     AND m.month_offset = o.month_offset
    ORDER BY o.cohort_month ASC, o.month_offset ASC
  `);

  const byCohort = new Map<string, CohortLtvSeries>();

  for (const row of rows) {
    const cohortMonth = row.cohort_month;
    let series = byCohort.get(cohortMonth);
    if (!series) {
      series = {
        cohortMonth,
        cohortSize: num(row.cohort_size),
        observedMonths: num(row.observed_months),
        points: [],
      };
      byCohort.set(cohortMonth, series);
    }

    // cohortSize is the denominator for the entire curve, not just the month —
    // dividing by "customers active in month N" would turn churn into growth.
    const cohortSize = series.cohortSize;
    const point: CohortLtvPoint = {
      monthsSinceAcquisition: num(row.month_offset),
      // safeRatio() is not used here: cohortSize is a count(*) over the rows
      // that produced this group, so it cannot be zero, and the contract
      // demands a number rather than null on every emitted point.
      cumulativeRevenuePerCustomerCents: Math.round(
        num(row.cumulative_net_revenue_cents) / cohortSize,
      ),
      cumulativeOrdersPerCustomer: num(row.cumulative_orders) / cohortSize,
    };
    series.points.push(point);
  }

  // Insertion order follows the SQL ORDER BY, so this is already oldest-first.
  return [...byCohort.values()];
}
