import { sql } from "drizzle-orm";

import { query } from "@/db";
import { num, safeRatio, toIsoDate } from "./coerce";
import type { PortfolioSummary } from "./types";

/**
 * The headline row above the dashboard: totals, blended efficiency, and the
 * date range the rest of the page is describing.
 *
 * Everything here comes back in a single round trip. The six figures are
 * independent aggregates over three tables, so the obvious implementation is
 * six queries — but this runs on every dashboard page load, ahead of the
 * charts, and six sequential round trips to a serverless Postgres is the
 * difference between a page that feels instant and one that does not. Each
 * aggregate is its own CTE and the final SELECT cross-joins the three
 * single-row results together.
 */

type SummaryRow = {
  customer_count: unknown;
  repeat_customer_count: unknown;
  order_count: unknown;
  net_revenue_cents: unknown;
  paid_spend_cents: unknown;
  first_order_at: unknown;
  last_order_at: unknown;
};

/**
 * Repeat rate is counted per customer rather than derived from
 * `orders - customers`, because those only agree when every customer has at
 * least one order. A customer row with no orders would otherwise inflate the
 * rate; the LEFT JOIN keeps them in the denominator and out of the numerator,
 * which is what "share of customers who came back" means.
 *
 * The three CTEs each collapse to exactly one row, so the cross join is a
 * 1x1x1 product, not a fan-out.
 */
const PORTFOLIO_SUMMARY_SQL = sql`
  WITH order_totals AS (
    SELECT
      COUNT(*) AS order_count,
      COALESCE(SUM(gross_revenue_cents - discount_cents - refund_cents), 0)
        AS net_revenue_cents,
      MIN(ordered_at) AS first_order_at,
      MAX(ordered_at) AS last_order_at
    FROM orders
  ),
  per_customer AS (
    SELECT c.id, COUNT(o.id) AS order_count
    FROM customers c
    LEFT JOIN orders o ON o.customer_id = c.id
    GROUP BY c.id
  ),
  customer_totals AS (
    SELECT
      COUNT(*) AS customer_count,
      COUNT(*) FILTER (WHERE order_count >= 2) AS repeat_customer_count
    FROM per_customer
  ),
  spend_totals AS (
    SELECT COALESCE(SUM(spend_cents), 0) AS paid_spend_cents
    FROM marketing_spend
  )
  SELECT
    ct.customer_count,
    ct.repeat_customer_count,
    ot.order_count,
    ot.net_revenue_cents,
    st.paid_spend_cents,
    ot.first_order_at,
    ot.last_order_at
  FROM order_totals ot
  CROSS JOIN customer_totals ct
  CROSS JOIN spend_totals st
`;

/** Portfolio-wide headline figures for the dashboard summary strip. */
export async function getPortfolioSummary(): Promise<PortfolioSummary> {
  const [row] = await query<SummaryRow>(PORTFOLIO_SUMMARY_SQL);

  // An empty database still has to render. Zeroed counts are honest here —
  // they are observed totals, not unknowns — while the ratios stay null.
  if (!row) {
    return {
      customers: 0,
      orders: 0,
      netRevenueCents: 0,
      paidSpendCents: 0,
      blendedRoas: null,
      averageOrderValueCents: 0,
      repeatPurchaseRate: 0,
      firstOrderDate: null,
      lastOrderDate: null,
    };
  }

  const customers = num(row.customer_count);
  const orders = num(row.order_count);
  const netRevenueCents = num(row.net_revenue_cents);
  const paidSpendCents = num(row.paid_spend_cents);

  return {
    customers,
    orders,
    netRevenueCents,
    paidSpendCents,
    // Null, not Infinity: an account that has spent nothing has no ROAS.
    blendedRoas: safeRatio(netRevenueCents, paidSpendCents),
    averageOrderValueCents: Math.round(
      safeRatio(netRevenueCents, orders) ?? 0,
    ),
    repeatPurchaseRate:
      safeRatio(num(row.repeat_customer_count), customers) ?? 0,
    firstOrderDate: toIsoDate(row.first_order_at),
    lastOrderDate: toIsoDate(row.last_order_at),
  };
}
