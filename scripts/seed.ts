/**
 * Generates a demo dataset with the shape real ecommerce data has: cohorts
 * that differ in quality by channel, repeat purchases that decay over time,
 * and paid spend that mostly-but-not-exactly tracks acquisition volume.
 *
 * The generator is seeded, so every run produces an identical database. That
 * matters — the numbers on the dashboard are assertions in the tests, and a
 * dataset that drifts between runs makes those tests meaningless.
 *
 *   npm run db:seed
 */

import { getDb } from "../src/db";
import { customers, marketingSpend, orders } from "../src/db/schema";
import type { NewCustomer, NewMarketingSpend, NewOrder } from "../src/db/schema";

const RANDOM_SEED = 20260815;
const MONTHS_OF_HISTORY = 24;
/** Everything is generated relative to this instant so the data is stable. */
const NOW = new Date("2026-08-15T00:00:00Z");

/** mulberry32 — small, fast, and good enough for fixture data. */
function createRandom(seed: number) {
  let state = seed >>> 0;
  return function random(): number {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = createRandom(RANDOM_SEED);

function randomBetween(min: number, max: number): number {
  return min + random() * (max - min);
}

function randomInt(min: number, max: number): number {
  return Math.floor(randomBetween(min, max + 1));
}

/** Draw from a lognormal-ish distribution to give order values a long tail. */
function randomOrderValueCents(medianCents: number, spread: number): number {
  const u = Math.max(random(), 1e-9);
  const v = Math.max(random(), 1e-9);
  const normal = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return Math.max(500, Math.round(medianCents * Math.exp(normal * spread)));
}

type ChannelConfig = {
  name: string;
  campaigns: string[];
  /** Relative share of new customers. */
  weight: number;
  /** Whether the channel costs money — organic and email do not. */
  paid: boolean;
  /** Target blended cost to acquire one customer, in cents. */
  targetCacCents: number;
  medianFirstOrderCents: number;
  /** Probability a customer places another order, per order placed. */
  repeatRate: number;
  /** Typical days between orders. */
  meanDaysBetweenOrders: number;
};

/**
 * Deliberately built so the channels rank differently on CAC than on LTV —
 * that inversion is the entire point of the dashboard. TikTok buys cheap
 * customers who rarely come back; email is nearly free and retains best.
 */
const CHANNELS: ChannelConfig[] = [
  {
    name: "meta",
    campaigns: ["prospecting-broad", "retargeting-dpa", "lookalike-1pct"],
    weight: 0.3,
    paid: true,
    targetCacCents: 4200,
    medianFirstOrderCents: 6800,
    repeatRate: 0.42,
    meanDaysBetweenOrders: 55,
  },
  {
    name: "google_search",
    campaigns: ["brand", "non-brand-generic", "competitor"],
    weight: 0.22,
    paid: true,
    targetCacCents: 3600,
    medianFirstOrderCents: 8200,
    repeatRate: 0.48,
    meanDaysBetweenOrders: 62,
  },
  {
    name: "google_pmax",
    campaigns: ["pmax-all-products", "pmax-new-customers"],
    weight: 0.12,
    paid: true,
    targetCacCents: 5100,
    medianFirstOrderCents: 7100,
    repeatRate: 0.35,
    meanDaysBetweenOrders: 70,
  },
  {
    name: "tiktok",
    campaigns: ["spark-ads", "creator-ugc"],
    weight: 0.11,
    paid: true,
    targetCacCents: 2900,
    medianFirstOrderCents: 4900,
    repeatRate: 0.24,
    meanDaysBetweenOrders: 84,
  },
  {
    name: "organic",
    campaigns: ["seo", "direct"],
    weight: 0.17,
    paid: false,
    targetCacCents: 0,
    medianFirstOrderCents: 7400,
    repeatRate: 0.5,
    meanDaysBetweenOrders: 58,
  },
  {
    name: "email",
    campaigns: ["welcome-flow", "newsletter"],
    weight: 0.08,
    paid: false,
    targetCacCents: 0,
    medianFirstOrderCents: 6600,
    repeatRate: 0.56,
    meanDaysBetweenOrders: 46,
  },
];

const COUNTRIES = ["US", "US", "US", "GB", "CA", "AU", "DE"];

function pickChannel(): ChannelConfig {
  const total = CHANNELS.reduce((sum, c) => sum + c.weight, 0);
  let roll = random() * total;
  for (const channel of CHANNELS) {
    roll -= channel.weight;
    if (roll <= 0) return channel;
  }
  return CHANNELS[CHANNELS.length - 1];
}

function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}

function toDateString(value: Date): string {
  return value.toISOString().slice(0, 10);
}

/** First day of the month, `monthsAgo` months before NOW. */
function cohortStart(monthsAgo: number): Date {
  return new Date(
    Date.UTC(NOW.getUTCFullYear(), NOW.getUTCMonth() - monthsAgo, 1),
  );
}

/**
 * New customers acquired in a given month: a growth trend with a Q4 bump and
 * some noise, so cohort sizes are uneven the way real ones are.
 */
function cohortSize(monthsAgo: number): number {
  const monthIndex = MONTHS_OF_HISTORY - monthsAgo;
  const growth = 55 * Math.pow(1.035, monthIndex);
  const month = cohortStart(monthsAgo).getUTCMonth();
  const seasonality = month === 10 || month === 11 ? 1.45 : 1;
  return Math.max(20, Math.round(growth * seasonality * randomBetween(0.85, 1.15)));
}

async function insertInChunks<T>(
  rows: T[],
  size: number,
  insert: (chunk: T[]) => Promise<unknown>,
): Promise<void> {
  for (let i = 0; i < rows.length; i += size) {
    await insert(rows.slice(i, i + size));
  }
}

async function main() {
  const db = await getDb();

  console.log("Clearing existing data...");
  // Orders first: they hold the FK to customers.
  await db.delete(orders);
  await db.delete(customers);
  await db.delete(marketingSpend);

  const customerRows: NewCustomer[] = [];
  const orderRows: NewOrder[] = [];
  /** channel -> "YYYY-MM" -> customers acquired, used to derive spend. */
  const acquisitionsByChannelMonth = new Map<string, Map<string, number>>();

  let customerCounter = 0;
  let orderCounter = 0;

  for (let monthsAgo = MONTHS_OF_HISTORY - 1; monthsAgo >= 0; monthsAgo--) {
    const monthStart = cohortStart(monthsAgo);
    const size = cohortSize(monthsAgo);

    for (let i = 0; i < size; i++) {
      const channel = pickChannel();
      const campaign =
        channel.campaigns[randomInt(0, channel.campaigns.length - 1)];

      const firstOrderAt = addDays(monthStart, randomBetween(0, 27));
      if (firstOrderAt > NOW) continue;

      customerCounter += 1;
      const customerId = crypto.randomUUID();
      const externalId = `cus_${String(customerCounter).padStart(6, "0")}`;

      customerRows.push({
        id: customerId,
        externalId,
        source: "demo",
        email: `${externalId}@example.com`,
        country: COUNTRIES[randomInt(0, COUNTRIES.length - 1)],
        acquisitionChannel: channel.name,
        acquisitionCampaign: campaign,
        firstOrderAt,
      });

      const monthKey = toDateString(monthStart).slice(0, 7);
      const byMonth =
        acquisitionsByChannelMonth.get(channel.name) ??
        new Map<string, number>();
      byMonth.set(monthKey, (byMonth.get(monthKey) ?? 0) + 1);
      acquisitionsByChannelMonth.set(channel.name, byMonth);

      // Every customer has a first order by definition of firstOrderAt.
      let orderedAt = firstOrderAt;
      let orderIndex = 0;

      while (true) {
        orderCounter += 1;
        const isFirst = orderIndex === 0;
        // Repeat orders trend slightly larger — returning customers buy more.
        const median = channel.medianFirstOrderCents * (isFirst ? 1 : 1.12);
        const gross = randomOrderValueCents(median, 0.45);
        const discount = random() < 0.35 ? Math.round(gross * randomBetween(0.05, 0.25)) : 0;
        // A small share of orders get refunded, mostly in full.
        const refund = random() < 0.04 ? (random() < 0.7 ? gross - discount : Math.round((gross - discount) * 0.5)) : 0;

        orderRows.push({
          id: crypto.randomUUID(),
          externalId: `ord_${String(orderCounter).padStart(7, "0")}`,
          source: "demo",
          customerId,
          orderedAt,
          currency: "USD",
          grossRevenueCents: gross,
          discountCents: discount,
          refundCents: refund,
          cogsCents: Math.round(gross * randomBetween(0.3, 0.45)),
        });

        orderIndex += 1;

        // Retention decays: each successive repeat is harder to win than the last.
        const repeatProbability = channel.repeatRate * Math.pow(0.82, orderIndex - 1);
        if (random() > repeatProbability) break;

        const gapDays = channel.meanDaysBetweenOrders * randomBetween(0.4, 1.9);
        orderedAt = addDays(orderedAt, gapDays);
        if (orderedAt > NOW) break;
      }
    }
  }

  console.log(`Inserting ${customerRows.length} customers...`);
  await insertInChunks(customerRows, 500, (chunk) =>
    db.insert(customers).values(chunk),
  );

  console.log(`Inserting ${orderRows.length} orders...`);
  await insertInChunks(orderRows, 500, (chunk) =>
    db.insert(orders).values(chunk),
  );

  // Spend is derived from acquisitions so CAC lands near each channel's
  // target, then spread across the days of the month with noise.
  const spendRows: NewMarketingSpend[] = [];
  for (const channel of CHANNELS) {
    if (!channel.paid) continue;
    const byMonth = acquisitionsByChannelMonth.get(channel.name);
    if (!byMonth) continue;

    for (const [monthKey, acquired] of byMonth) {
      const [year, month] = monthKey.split("-").map(Number);
      const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
      // Efficiency drifts month to month; that drift is what CAC trends show.
      const monthlySpend = acquired * channel.targetCacCents * randomBetween(0.82, 1.24);

      let allocated = 0;
      for (let day = 1; day <= daysInMonth; day++) {
        const spendDate = new Date(Date.UTC(year, month - 1, day));
        if (spendDate > NOW) break;

        const share = randomBetween(0.7, 1.3) / daysInMonth;
        const daySpend = Math.round(monthlySpend * share);
        allocated += daySpend;
        const campaign = channel.campaigns[randomInt(0, channel.campaigns.length - 1)];

        spendRows.push({
          spendDate: toDateString(spendDate),
          channel: channel.name,
          campaign,
          spendCents: daySpend,
          impressions: Math.round(daySpend * randomBetween(8, 22)),
          clicks: Math.round(daySpend * randomBetween(0.02, 0.08)),
        });
      }
      void allocated;
    }
  }

  // Two campaigns can land on the same day/channel; the table has a unique
  // index on (day, channel, campaign), so merge before inserting.
  const mergedSpend = new Map<string, NewMarketingSpend>();
  for (const row of spendRows) {
    const key = `${row.spendDate}|${row.channel}|${row.campaign}`;
    const existing = mergedSpend.get(key);
    if (existing) {
      existing.spendCents += row.spendCents;
      existing.impressions = (existing.impressions ?? 0) + (row.impressions ?? 0);
      existing.clicks = (existing.clicks ?? 0) + (row.clicks ?? 0);
    } else {
      mergedSpend.set(key, { ...row });
    }
  }

  const spendToInsert = [...mergedSpend.values()];
  console.log(`Inserting ${spendToInsert.length} marketing spend rows...`);
  await insertInChunks(spendToInsert, 500, (chunk) =>
    db.insert(marketingSpend).values(chunk),
  );

  const totalSpend = spendToInsert.reduce((sum, r) => sum + r.spendCents, 0);
  const totalRevenue = orderRows.reduce(
    (sum, r) => sum + r.grossRevenueCents - (r.discountCents ?? 0) - (r.refundCents ?? 0),
    0,
  );

  console.log("\nSeed complete.");
  console.log(`  Customers:     ${customerRows.length.toLocaleString()}`);
  console.log(`  Orders:        ${orderRows.length.toLocaleString()}`);
  console.log(`  Net revenue:   $${(totalRevenue / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
  console.log(`  Paid spend:    $${(totalSpend / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
  console.log(`  Blended ROAS:  ${(totalRevenue / totalSpend).toFixed(2)}x`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
