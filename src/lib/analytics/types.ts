/**
 * The contract between the query layer and the UI.
 *
 * Every analytics module returns one of these shapes and every chart consumes
 * one. Money stays in integer cents right up to the formatting layer; ratios
 * are plain numbers. Nullable fields mean "not computable from the data we
 * have" — an unpaid channel has no CAC, and a cohort too young to have reached
 * day 365 has no LTV at 365. Those must render as "—", never as zero, because
 * a zero here reads as "this channel is unprofitable" rather than "unknown".
 */

/** A single point on a cohort's cumulative LTV curve. */
export type CohortLtvPoint = {
  /** 0 = the acquisition month itself. */
  monthsSinceAcquisition: number;
  /** Cumulative net revenue per acquired customer, in cents. */
  cumulativeRevenuePerCustomerCents: number;
  /** Cumulative orders per acquired customer. */
  cumulativeOrdersPerCustomer: number;
};

/** One acquisition cohort and its curve. */
export type CohortLtvSeries = {
  /** Acquisition month as "YYYY-MM". */
  cohortMonth: string;
  /** Customers acquired in this month. The denominator for every point. */
  cohortSize: number;
  /**
   * How many months of observed history this cohort has. Points beyond this
   * are absent, not zero — a 2-month-old cohort has no month-12 datapoint and
   * must not be averaged as though it earned nothing.
   */
  observedMonths: number;
  points: CohortLtvPoint[];
};

/** Unit economics for one acquisition channel. */
export type ChannelEconomics = {
  channel: string;
  customers: number;
  orders: number;
  /** Total paid spend attributed to the channel. Zero for organic/email. */
  spendCents: number;
  /** Null when the channel has no spend — organic has no cost per acquisition. */
  cacCents: number | null;
  netRevenueCents: number;
  /**
   * Net revenue per acquired customer within N days of acquisition, restricted
   * to cohorts old enough to have been observed for the full window. Null when
   * no cohort is old enough.
   */
  ltv90Cents: number | null;
  ltv180Cents: number | null;
  ltv365Cents: number | null;
  /** ltv365 / CAC. Null when either side is null. */
  ltvToCacRatio: number | null;
  /** Months until cumulative revenue per customer covers CAC. Null if never. */
  paybackMonths: number | null;
};

/** Headline numbers across the whole account. */
export type PortfolioSummary = {
  customers: number;
  orders: number;
  netRevenueCents: number;
  paidSpendCents: number;
  /** Net revenue / paid spend. Null when there is no spend. */
  blendedRoas: number | null;
  averageOrderValueCents: number;
  /** Share of customers with more than one order, 0..1. */
  repeatPurchaseRate: number;
  /** Bounds of the underlying data, ISO dates, for "data through" labels. */
  firstOrderDate: string | null;
  lastOrderDate: string | null;
};

/** Windows offered by the channel table. Keep in sync with ChannelEconomics. */
export const LTV_WINDOWS_DAYS = [90, 180, 365] as const;
export type LtvWindowDays = (typeof LTV_WINDOWS_DAYS)[number];
