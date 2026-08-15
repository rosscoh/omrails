import type { ChannelEconomics } from "@/lib/analytics/types";
import {
  formatCents,
  formatChannel,
  formatMonths,
  formatRatio,
} from "@/lib/format";

/**
 * Every figure `getChannelEconomics()` returns, unsummarised.
 *
 * The bar chart above this table answers one question — cost against value — by
 * dropping seven of the nine columns. This is where the rest live, because the
 * decision the dashboard exists to support ("move budget from here to there") is
 * made on the numbers, not on bar lengths a reader has to measure against an
 * axis.
 *
 * Two things the table has to say out loud, both handled in the note underneath:
 *
 * The em dashes are not gaps in the render. Organic and email have no paid
 * spend, so CAC, LTV:CAC and payback are unmeasured rather than zero, and a
 * reader who reads "—" as a bug will either distrust the whole table or, worse,
 * mentally substitute the zero it isn't.
 *
 * The three LTV columns do not share a denominator. Each window averages only
 * the customers observed for its full length, so 365d rests on an older and
 * smaller base than 90d. That makes a row where 365d sits *below* 180d entirely
 * correct — tiktok is the live example — and it is the first thing anyone reads
 * as an error.
 */

export type ChannelTableProps = {
  /** As `getChannelEconomics()` returns them: ordered by customers acquired. */
  channels: ChannelEconomics[];
};

/**
 * Shared by every numeric cell. Right-aligned so the digits stack on their
 * places, and `tabular-nums` so they actually line up — this is the one place
 * equal-width figures are wanted, unlike the headline tiles.
 */
const NUMERIC_CELL = "px-3 py-2.5 text-right tabular-nums";
const NUMERIC_HEAD = "px-3 py-2 text-right font-medium";

/** Measured values take reading weight; an unmeasured dash recedes. */
const MEASURED = "text-foreground";
const UNMEASURED = "text-zinc-400 dark:text-zinc-600";

export function ChannelTable({ channels }: ChannelTableProps) {
  if (channels.length === 0) {
    return (
      <div className="rounded-xl border border-black/[.08] bg-background p-5 dark:border-white/[.145]">
        <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
          No channel data yet.
        </p>
      </div>
    );
  }

  const unpaid = channels.filter((channel) => channel.cacCents === null);

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-black/[.08] bg-background p-5 dark:border-white/[.145]">
      {/*
        The scroll lives here, around the table only. A `min-w` on the table
        itself would widen the page and take every other section with it; nine
        columns of figures cannot be squeezed into a phone without either
        wrapping the headers into unreadable stacks or shrinking the type.
      */}
      <div className="-mx-1 overflow-x-auto px-1">
        <table className="w-full min-w-[54rem] border-collapse text-sm">
          <caption className="sr-only">
            Unit economics by acquisition channel: customers, paid spend, cost
            per acquisition, lifetime value at 90, 180 and 365 days, LTV to CAC
            ratio, and months to payback.
          </caption>

          <thead>
            <tr className="border-b border-black/[.08] text-xs text-zinc-500 dark:border-white/[.145] dark:text-zinc-400">
              <th scope="col" className="px-3 py-2 text-left font-medium">
                Channel
              </th>
              <th scope="col" className={NUMERIC_HEAD}>
                Customers
              </th>
              <th scope="col" className={NUMERIC_HEAD}>
                Spend
              </th>
              <th scope="col" className={NUMERIC_HEAD}>
                CAC
              </th>
              <th scope="col" className={NUMERIC_HEAD}>
                LTV 90d
              </th>
              <th scope="col" className={NUMERIC_HEAD}>
                LTV 180d
              </th>
              <th scope="col" className={NUMERIC_HEAD}>
                LTV 365d
              </th>
              <th scope="col" className={NUMERIC_HEAD}>
                LTV:CAC
              </th>
              <th scope="col" className={NUMERIC_HEAD}>
                Payback
              </th>
            </tr>
          </thead>

          <tbody>
            {channels.map((channel) => (
              <tr
                key={channel.channel}
                className="border-b border-black/[.06] last:border-b-0 dark:border-white/[.08]"
              >
                <th
                  scope="row"
                  className="px-3 py-2.5 text-left font-medium whitespace-nowrap text-foreground"
                >
                  {formatChannel(channel.channel)}
                </th>

                <td className={`${NUMERIC_CELL} ${MEASURED}`}>
                  {channel.customers.toLocaleString("en-US")}
                </td>

                {/*
                  Spend is a real measured zero for the unpaid channels — we know
                  it is nothing — so it prints "$0" while the CAC derived from it
                  prints a dash. That contrast is the whole point: the money is
                  known, the cost per customer is not.
                */}
                <td className={`${NUMERIC_CELL} ${MEASURED}`}>
                  {formatCents(channel.spendCents)}
                </td>

                <td
                  className={`${NUMERIC_CELL} ${
                    channel.cacCents === null ? UNMEASURED : MEASURED
                  }`}
                >
                  {formatCents(channel.cacCents)}
                </td>

                <td
                  className={`${NUMERIC_CELL} ${
                    channel.ltv90Cents === null ? UNMEASURED : MEASURED
                  }`}
                >
                  {formatCents(channel.ltv90Cents)}
                </td>

                <td
                  className={`${NUMERIC_CELL} ${
                    channel.ltv180Cents === null ? UNMEASURED : MEASURED
                  }`}
                >
                  {formatCents(channel.ltv180Cents)}
                </td>

                <td
                  className={`${NUMERIC_CELL} ${
                    channel.ltv365Cents === null ? UNMEASURED : MEASURED
                  }`}
                >
                  {formatCents(channel.ltv365Cents)}
                </td>

                <td
                  className={`${NUMERIC_CELL} ${
                    channel.ltvToCacRatio === null ? UNMEASURED : MEASURED
                  }`}
                >
                  {formatRatio(channel.ltvToCacRatio)}
                </td>

                {/*
                  `formatMonths(0)` is "0 mo", and it has to stay that way: every
                  paid channel here recovers its CAC inside the acquisition month
                  itself. A falsy check would blank the best result in the table.
                */}
                <td
                  className={`${NUMERIC_CELL} ${
                    channel.paybackMonths === null ? UNMEASURED : MEASURED
                  }`}
                >
                  {formatMonths(channel.paybackMonths)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
        {unpaid.length > 0 ? (
          <p>
            <span aria-hidden="true">— </span>
            means not measured, never zero.{" "}
            {unpaid.map((channel) => formatChannel(channel.channel)).join(" and ")}{" "}
            {unpaid.length === 1 ? "is an unpaid channel" : "are unpaid channels"}{" "}
            with no acquisition spend, so there is no cost per customer to divide
            by and no payback to reach.
          </p>
        ) : (
          <p>
            <span aria-hidden="true">— </span>
            means not measured, never zero.
          </p>
        )}

        <p>
          Each LTV column averages only the customers observed for that whole
          window, so the three rest on progressively older and smaller bases. A
          365-day figure below the 180-day one is a difference of population, not
          a decline in value.
        </p>
      </div>
    </div>
  );
}

export default ChannelTable;
