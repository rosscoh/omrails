import { sql } from "drizzle-orm";

import { query } from "@/db";
import { num, numOrNull, safeRatio } from "./coerce";
import type { ChannelEconomics } from "./types";

/**
 * Channel unit economics: what each acquisition source costs and what it pays
 * back.
 *
 * Two decisions drive everything here, and both exist to stop the table
 * flattering a channel that does not deserve it.
 *
 * First, every window is measured against the *observed* edge of the data
 * (the latest order we hold), not against wall-clock now, and a customer only
 * contributes to an N-day window once they have actually been observed for the
 * whole N days. A cohort acquired last month has had no chance to place its
 * day-200 order; averaging it into LTV180 drags the number toward the first
 * order value and makes long-retaining channels look like short ones.
 *
 * Second, "no spend" is not "free". Organic and email have no CAC at all, so
 * cacCents, the LTV:CAC ratio, and payback are null rather than zero — a zero
 * CAC divides into an infinite return and would push budget toward channels
 * that cannot absorb it.
 */

type ChannelRow = {
  channel: string;
  customers: unknown;
  order_count: unknown;
  net_revenue_cents: unknown;
  ltv_90_cents: unknown;
  ltv_180_cents: unknown;
  ltv_365_cents: unknown;
};

type SpendRow = {
  channel: string;
  spend_cents: unknown;
};

type PaybackRow = {
  channel: string;
  month_offset: unknown;
  observed_customers: unknown;
  cumulative_net_revenue_cents: unknown;
};

/**
 * Per-channel totals plus the three LTV windows.
 *
 * The windows are averaged with `AVG(CASE WHEN observed THEN ... END)`: SQL's
 * AVG skips nulls, so ineligible customers drop out of both the numerator and
 * the denominator, and a channel with nobody old enough yields null instead of
 * a fabricated number.
 */
const CHANNEL_TOTALS_SQL = sql`
  WITH bounds AS (
    SELECT MAX(ordered_at) AS as_of FROM orders
  ),
  per_customer AS (
    SELECT
      c.acquisition_channel AS channel,
      c.id,
      c.first_order_at,
      COUNT(o.id) AS order_count,
      COALESCE(SUM(o.gross_revenue_cents - o.discount_cents - o.refund_cents), 0)
        AS net_revenue_cents,
      COALESCE(SUM(o.gross_revenue_cents - o.discount_cents - o.refund_cents)
        FILTER (WHERE o.ordered_at <= c.first_order_at + INTERVAL '90 days'), 0)
        AS net_90_cents,
      COALESCE(SUM(o.gross_revenue_cents - o.discount_cents - o.refund_cents)
        FILTER (WHERE o.ordered_at <= c.first_order_at + INTERVAL '180 days'), 0)
        AS net_180_cents,
      COALESCE(SUM(o.gross_revenue_cents - o.discount_cents - o.refund_cents)
        FILTER (WHERE o.ordered_at <= c.first_order_at + INTERVAL '365 days'), 0)
        AS net_365_cents
    FROM customers c
    LEFT JOIN orders o ON o.customer_id = c.id
    WHERE c.acquisition_channel IS NOT NULL
    GROUP BY c.acquisition_channel, c.id, c.first_order_at
  )
  SELECT
    pc.channel,
    COUNT(*) AS customers,
    SUM(pc.order_count) AS order_count,
    SUM(pc.net_revenue_cents) AS net_revenue_cents,
    AVG(CASE WHEN pc.first_order_at + INTERVAL '90 days' <= b.as_of
             THEN pc.net_90_cents END) AS ltv_90_cents,
    AVG(CASE WHEN pc.first_order_at + INTERVAL '180 days' <= b.as_of
             THEN pc.net_180_cents END) AS ltv_180_cents,
    AVG(CASE WHEN pc.first_order_at + INTERVAL '365 days' <= b.as_of
             THEN pc.net_365_cents END) AS ltv_365_cents
  FROM per_customer pc
  CROSS JOIN bounds b
  GROUP BY pc.channel
`;

const CHANNEL_SPEND_SQL = sql`
  SELECT channel, SUM(spend_cents) AS spend_cents
  FROM marketing_spend
  GROUP BY channel
`;

/**
 * The cumulative revenue-per-customer curve, one row per (channel, month).
 *
 * Month offset 0 is the acquisition month itself, so it already contains the
 * first order — payback in month 0 means the first purchase covered CAC.
 * Eligibility is applied per offset: month m is only reported for customers who
 * have lived a full m + 1 months, and those same customers form the
 * denominator, so the curve never dips because young cohorts joined it.
 */
const PAYBACK_CURVE_SQL = sql`
  WITH bounds AS (
    SELECT MAX(ordered_at) AS as_of FROM orders
  ),
  cohort AS (
    SELECT
      c.id,
      c.acquisition_channel AS channel,
      c.first_order_at,
      (EXTRACT(YEAR FROM AGE(b.as_of, c.first_order_at)) * 12
        + EXTRACT(MONTH FROM AGE(b.as_of, c.first_order_at)))::int AS observed_months
    FROM customers c
    CROSS JOIN bounds b
    WHERE c.acquisition_channel IS NOT NULL
      AND c.first_order_at IS NOT NULL
  ),
  offsets AS (
    SELECT generate_series(0, (SELECT COALESCE(MAX(observed_months), 0) FROM cohort)) AS m
  ),
  -- AGE() truncates to whole months, which is exactly the month index we want:
  -- an order 40 days after acquisition lands in month 1, not month 1.3.
  customer_month AS (
    SELECT
      ch.channel,
      ch.observed_months,
      (EXTRACT(YEAR FROM AGE(o.ordered_at, ch.first_order_at)) * 12
        + EXTRACT(MONTH FROM AGE(o.ordered_at, ch.first_order_at)))::int AS month_index,
      SUM(o.gross_revenue_cents - o.discount_cents - o.refund_cents) AS net_revenue_cents
    FROM cohort ch
    JOIN orders o ON o.customer_id = ch.id
    GROUP BY ch.channel, ch.observed_months, 3
  ),
  denominator AS (
    SELECT ch.channel, o.m, COUNT(*) AS observed_customers
    FROM cohort ch
    JOIN offsets o ON ch.observed_months >= o.m + 1
    GROUP BY ch.channel, o.m
  ),
  numerator AS (
    SELECT cm.channel, o.m, SUM(cm.net_revenue_cents) AS cumulative_net_revenue_cents
    FROM customer_month cm
    JOIN offsets o ON cm.month_index <= o.m AND cm.observed_months >= o.m + 1
    GROUP BY cm.channel, o.m
  )
  SELECT
    d.channel,
    d.m AS month_offset,
    d.observed_customers,
    COALESCE(n.cumulative_net_revenue_cents, 0) AS cumulative_net_revenue_cents
  FROM denominator d
  LEFT JOIN numerator n ON n.channel = d.channel AND n.m = d.m
  ORDER BY d.channel, d.m
`;

/**
 * First month offset whose cumulative revenue per observed customer covers CAC.
 *
 * Returns null when the curve never reaches CAC inside the history we hold —
 * "not yet paid back" and "paid back in month 30" are different answers, and
 * only one of them is safe to act on.
 */
function findPaybackMonth(
  curve: { monthOffset: number; revenuePerCustomer: number }[],
  cacCents: number,
): number | null {
  for (const point of curve) {
    if (point.revenuePerCustomer >= cacCents) return point.monthOffset;
  }
  return null;
}

/**
 * Unit economics for every acquisition channel, busiest first.
 */
export async function getChannelEconomics(): Promise<ChannelEconomics[]> {
  const [totals, spend, payback] = await Promise.all([
    query<ChannelRow>(CHANNEL_TOTALS_SQL),
    query<SpendRow>(CHANNEL_SPEND_SQL),
    query<PaybackRow>(PAYBACK_CURVE_SQL),
  ]);

  const spendByChannel = new Map<string, number>();
  for (const row of spend) {
    spendByChannel.set(row.channel, num(row.spend_cents));
  }

  const curveByChannel = new Map<
    string,
    { monthOffset: number; revenuePerCustomer: number }[]
  >();
  for (const row of payback) {
    const observedCustomers = num(row.observed_customers);
    const perCustomer = safeRatio(
      num(row.cumulative_net_revenue_cents),
      observedCustomers,
    );
    if (perCustomer === null) continue;
    const points = curveByChannel.get(row.channel) ?? [];
    points.push({
      monthOffset: num(row.month_offset),
      revenuePerCustomer: perCustomer,
    });
    curveByChannel.set(row.channel, points);
  }

  const rows = totals.map((row): ChannelEconomics => {
    const customers = num(row.customers);
    const spendCents = spendByChannel.get(row.channel) ?? 0;

    // Spend of zero is an unpaid channel, not a free one: leave CAC unknown so
    // downstream ratios stay unknown too.
    const cacCents =
      spendCents > 0 ? roundOrNull(safeRatio(spendCents, customers)) : null;

    const ltv365Cents = roundOrNull(numOrNull(row.ltv_365_cents));

    return {
      channel: row.channel,
      customers,
      orders: num(row.order_count),
      spendCents,
      cacCents,
      netRevenueCents: num(row.net_revenue_cents),
      ltv90Cents: roundOrNull(numOrNull(row.ltv_90_cents)),
      ltv180Cents: roundOrNull(numOrNull(row.ltv_180_cents)),
      ltv365Cents,
      ltvToCacRatio: safeRatio(ltv365Cents, cacCents),
      paybackMonths:
        cacCents === null
          ? null
          : findPaybackMonth(curveByChannel.get(row.channel) ?? [], cacCents),
    };
  });

  return rows.sort((a, b) => b.customers - a.customers);
}

/** Averages come back as fractional cents; the contract is integer cents. */
function roundOrNull(value: number | null): number | null {
  return value === null ? null : Math.round(value);
}
