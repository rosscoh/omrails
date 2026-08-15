import {
  date,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * Money is stored as integer cents. Never use floating point for currency —
 * 0.1 + 0.2 !== 0.3, and those errors compound across millions of order rows.
 */

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Stable id from the source system (Shopify, Stripe, internal DB). */
    externalId: text("external_id").notNull(),
    source: text("source").notNull(),
    email: text("email"),
    country: text("country"),
    /**
     * Acquisition attributes are denormalised onto the customer on purpose.
     * A customer belongs to exactly one acquisition cohort forever, and every
     * LTV query groups by these columns, so keeping them here avoids a join
     * on the hottest path in the app.
     */
    acquisitionChannel: text("acquisition_channel"),
    acquisitionCampaign: text("acquisition_campaign"),
    /** Timestamp of the first order. Defines the customer's cohort. */
    firstOrderAt: timestamp("first_order_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("customers_source_external_id_idx").on(
      table.source,
      table.externalId,
    ),
    index("customers_first_order_at_idx").on(table.firstOrderAt),
    index("customers_acquisition_channel_idx").on(table.acquisitionChannel),
  ],
);

export const orders = pgTable(
  "orders",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    externalId: text("external_id").notNull(),
    source: text("source").notNull(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    orderedAt: timestamp("ordered_at", { withTimezone: true }).notNull(),
    currency: text("currency").notNull().default("USD"),
    /** What the customer was billed, before discounts and refunds. */
    grossRevenueCents: integer("gross_revenue_cents").notNull(),
    discountCents: integer("discount_cents").notNull().default(0),
    refundCents: integer("refund_cents").notNull().default(0),
    /**
     * Cost of goods. Nullable because most source systems do not expose it;
     * margin-based LTV falls back to a configured blended margin when null.
     */
    cogsCents: integer("cogs_cents"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("orders_source_external_id_idx").on(
      table.source,
      table.externalId,
    ),
    index("orders_customer_id_idx").on(table.customerId),
    index("orders_ordered_at_idx").on(table.orderedAt),
  ],
);

export const marketingSpend = pgTable(
  "marketing_spend",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** Spend is reported per day, so a date column rather than a timestamp. */
    spendDate: date("spend_date").notNull(),
    channel: text("channel").notNull(),
    campaign: text("campaign"),
    spendCents: integer("spend_cents").notNull(),
    impressions: integer("impressions"),
    clicks: integer("clicks"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("marketing_spend_day_channel_campaign_idx").on(
      table.spendDate,
      table.channel,
      table.campaign,
    ),
    index("marketing_spend_date_idx").on(table.spendDate),
  ],
);

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;
export type Order = typeof orders.$inferSelect;
export type NewOrder = typeof orders.$inferInsert;
export type MarketingSpend = typeof marketingSpend.$inferSelect;
export type NewMarketingSpend = typeof marketingSpend.$inferInsert;
