CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text NOT NULL,
	"source" text NOT NULL,
	"email" text,
	"country" text,
	"acquisition_channel" text,
	"acquisition_campaign" text,
	"first_order_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketing_spend" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"spend_date" date NOT NULL,
	"channel" text NOT NULL,
	"campaign" text,
	"spend_cents" integer NOT NULL,
	"impressions" integer,
	"clicks" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"external_id" text NOT NULL,
	"source" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"ordered_at" timestamp with time zone NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"gross_revenue_cents" integer NOT NULL,
	"discount_cents" integer DEFAULT 0 NOT NULL,
	"refund_cents" integer DEFAULT 0 NOT NULL,
	"cogs_cents" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "customers_source_external_id_idx" ON "customers" USING btree ("source","external_id");--> statement-breakpoint
CREATE INDEX "customers_first_order_at_idx" ON "customers" USING btree ("first_order_at");--> statement-breakpoint
CREATE INDEX "customers_acquisition_channel_idx" ON "customers" USING btree ("acquisition_channel");--> statement-breakpoint
CREATE UNIQUE INDEX "marketing_spend_day_channel_campaign_idx" ON "marketing_spend" USING btree ("spend_date","channel","campaign");--> statement-breakpoint
CREATE INDEX "marketing_spend_date_idx" ON "marketing_spend" USING btree ("spend_date");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_source_external_id_idx" ON "orders" USING btree ("source","external_id");--> statement-breakpoint
CREATE INDEX "orders_customer_id_idx" ON "orders" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "orders_ordered_at_idx" ON "orders" USING btree ("ordered_at");