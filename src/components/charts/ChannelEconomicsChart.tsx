"use client";

import type { ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipContentProps } from "recharts";

import type { ChannelEconomics } from "@/lib/analytics/types";
import {
  CHART_THEME_CSS,
  CHART_THEME_HREF,
  CHART_TOKENS,
  chartSeriesVar,
  formatCents,
  formatChannel,
  formatMonths,
  formatRatio,
} from "@/lib/format";

/**
 * What a customer costs against what a customer is worth, per channel.
 *
 * Both bars are cents on one shared axis, which is the only honest way to draw
 * this: putting CAC and LTV on two y-scales would let the pair be aligned to
 * whatever ratio flattered the media buy.
 *
 * The load-bearing detail is the missing bar. Organic and email have no paid
 * spend, so `cacCents` is null — not zero. A zero-height bar sitting on the
 * baseline reads as "we measured this channel and it costs nothing", which
 * makes an unattributed channel look infinitely profitable and is exactly the
 * conclusion that moves budget the wrong way. Those channels therefore render
 * their LTV bar with no CAC bar beside it at all, and the caption names them so
 * the gap reads as "not measured" rather than as a rendering fault.
 */

export type ChannelEconomicsChartProps = {
  channels: ChannelEconomics[];
  /** Plot height in px, axis band included. Width fills the container. */
  height?: number;
  className?: string;
};

type ChannelRow = {
  channel: string;
  label: string;
  cacCents: number | null;
  ltv365Cents: number | null;
  ltvToCacRatio: number | null;
  paybackMonths: number | null;
};

const CAC_COLOR = chartSeriesVar(0);
const LTV_COLOR = chartSeriesVar(1);

/** Slot 0 is CAC and slot 1 is LTV in every render, so a filtered-out channel
 *  never repaints the ones that remain. */
const SERIES = [
  { key: "cacCents", label: "Cost to acquire", color: CAC_COLOR },
  { key: "ltv365Cents", label: "LTV, 365 days", color: LTV_COLOR },
] as const;

export function ChannelEconomicsChart({
  channels,
  height = 320,
  className,
}: ChannelEconomicsChartProps) {
  const rows: ChannelRow[] = channels.map((channel) => ({
    channel: channel.channel,
    label: formatChannel(channel.channel),
    cacCents: channel.cacCents,
    ltv365Cents: channel.ltv365Cents,
    ltvToCacRatio: channel.ltvToCacRatio,
    paybackMonths: channel.paybackMonths,
  }));

  const unpaid = rows.filter((row) => row.cacCents === null);
  const hasData = rows.length > 0;

  const renderTooltip = (props: TooltipContentProps): ReactNode => {
    const { active, payload } = props;
    if (!active || !payload || payload.length === 0) return null;

    // Read the source row rather than the payload entries: a null value is
    // dropped or blanked on its way through Recharts, and the tooltip has to
    // say "not measured" out loud instead of just omitting the line.
    const row = payload[0]?.payload as ChannelRow | undefined;
    if (!row) return null;

    return (
      <div className="rounded-lg border border-black/[.08] bg-background px-3 py-2 text-xs shadow-sm dark:border-white/[.145]">
        <p className="mb-1.5 font-medium text-foreground">{row.label}</p>
        <ul className="flex flex-col gap-1">
          <li className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-2 w-2 shrink-0 rounded-sm"
              style={{ backgroundColor: CAC_COLOR }}
            />
            <span className="font-semibold tabular-nums text-foreground">
              {formatCents(row.cacCents)}
            </span>
            <span className="text-zinc-500 dark:text-zinc-400">
              {row.cacCents === null ? "CAC — no paid spend" : "cost to acquire"}
            </span>
          </li>
          <li className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-2 w-2 shrink-0 rounded-sm"
              style={{ backgroundColor: LTV_COLOR }}
            />
            <span className="font-semibold tabular-nums text-foreground">
              {formatCents(row.ltv365Cents)}
            </span>
            <span className="text-zinc-500 dark:text-zinc-400">
              {row.ltv365Cents === null
                ? "LTV — no cohort observed 365 days"
                : "LTV, 365 days"}
            </span>
          </li>
          <li className="flex items-center gap-2 pt-0.5 text-zinc-500 dark:text-zinc-400">
            <span className="tabular-nums">
              {formatRatio(row.ltvToCacRatio)}
            </span>
            <span>LTV:CAC</span>
            <span className="tabular-nums">
              {formatMonths(row.paybackMonths)}
            </span>
            <span>payback</span>
          </li>
        </ul>
      </div>
    );
  };

  return (
    <figure
      className={[
        "flex w-full flex-col gap-3 rounded-xl border border-black/[.08] bg-background p-5",
        "dark:border-white/[.145]",
        className ?? "",
      ]
        .join(" ")
        .trim()}
    >
      <style href={CHART_THEME_HREF} precedence="default">
        {CHART_THEME_CSS}
      </style>

      <figcaption className="flex flex-col gap-0.5">
        <h3 className="text-sm font-semibold tracking-tight text-foreground">
          Acquisition cost against 365-day value
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Per acquired customer. Both series share one scale.
        </p>
      </figcaption>

      {hasData ? (
        <>
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
            {SERIES.map((series) => (
              <li
                key={series.key}
                className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400"
              >
                <span
                  aria-hidden="true"
                  className="h-2.5 w-2.5 rounded-sm"
                  style={{ backgroundColor: series.color }}
                />
                <span>{series.label}</span>
              </li>
            ))}
          </ul>

          <ResponsiveContainer width="100%" height={height}>
            <BarChart
              data={rows}
              margin={{ top: 8, right: 8, bottom: 4, left: 0 }}
              // 2px of surface between the paired bars — the gap does the
              // separating, so neither bar needs a stroke around it.
              barGap={2}
              barCategoryGap="32%"
            >
              <CartesianGrid
                vertical={false}
                stroke={CHART_TOKENS.grid}
                strokeWidth={1}
              />
              <XAxis
                dataKey="label"
                interval={0}
                tickLine={false}
                tickMargin={8}
                axisLine={{ stroke: CHART_TOKENS.axis }}
                tick={{ fill: CHART_TOKENS.muted, fontSize: 11 }}
              />
              <YAxis
                width={60}
                tickLine={false}
                axisLine={false}
                tickMargin={4}
                tick={{ fill: CHART_TOKENS.muted, fontSize: 11 }}
                tickFormatter={(value: number) =>
                  formatCents(value, { compact: true })
                }
              />
              <Tooltip
                content={renderTooltip}
                // Keep null-valued entries in the payload so the tooltip can
                // still find its source row for a channel with no CAC.
                filterNull={false}
                cursor={{ fill: CHART_TOKENS.hover }}
                wrapperStyle={{ outline: "none" }}
              />

              <Bar
                dataKey="cacCents"
                maxBarSize={24}
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              >
                {rows.map((row) => (
                  <Cell
                    key={row.channel}
                    // An unmeasured CAC paints nothing. Recharts would otherwise
                    // scale null to the baseline and leave a hairline sitting on
                    // the axis that reads as a measured zero.
                    fill={row.cacCents === null ? "none" : CAC_COLOR}
                  />
                ))}
              </Bar>

              <Bar
                dataKey="ltv365Cents"
                maxBarSize={24}
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              >
                {rows.map((row) => (
                  <Cell
                    key={row.channel}
                    fill={row.ltv365Cents === null ? "none" : LTV_COLOR}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {unpaid.length > 0 ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              No cost bar for{" "}
              {unpaid.map((row) => row.label).join(", ")} — {
                unpaid.length === 1 ? "it carries" : "they carry"
              }{" "}
              no paid spend, so acquisition cost is unmeasured rather than zero.
            </p>
          ) : null}

          <details className="text-xs">
            <summary className="cursor-pointer text-zinc-500 select-none dark:text-zinc-400">
              Data table
            </summary>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[28rem] border-collapse text-left tabular-nums">
                <thead>
                  <tr className="text-zinc-500 dark:text-zinc-400">
                    <th scope="col" className="py-1 pr-4 font-medium">
                      Channel
                    </th>
                    <th scope="col" className="py-1 pr-4 font-medium">
                      CAC
                    </th>
                    <th scope="col" className="py-1 pr-4 font-medium">
                      LTV 365d
                    </th>
                    <th scope="col" className="py-1 pr-4 font-medium">
                      LTV:CAC
                    </th>
                    <th scope="col" className="py-1 pr-4 font-medium">
                      Payback
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.channel}
                      className="border-t border-black/[.06] dark:border-white/[.08]"
                    >
                      <th
                        scope="row"
                        className="py-1 pr-4 font-normal text-foreground"
                      >
                        {row.label}
                      </th>
                      <td className="py-1 pr-4 text-zinc-600 dark:text-zinc-400">
                        {formatCents(row.cacCents)}
                      </td>
                      <td className="py-1 pr-4 text-zinc-600 dark:text-zinc-400">
                        {formatCents(row.ltv365Cents)}
                      </td>
                      <td className="py-1 pr-4 text-zinc-600 dark:text-zinc-400">
                        {formatRatio(row.ltvToCacRatio)}
                      </td>
                      <td className="py-1 pr-4 text-zinc-600 dark:text-zinc-400">
                        {formatMonths(row.paybackMonths)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      ) : (
        <p className="py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
          No channel data yet.
        </p>
      )}
    </figure>
  );
}

export default ChannelEconomicsChart;
