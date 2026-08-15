"use client";

import type { ReactNode } from "react";
import {
  CartesianGrid,
  LabelList,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { TooltipContentProps } from "recharts";

import type { CohortLtvSeries } from "@/lib/analytics/types";
import {
  CHART_THEME_CSS,
  CHART_THEME_HREF,
  CHART_TOKENS,
  chartSeriesVar,
  formatCents,
  formatCohortMonth,
} from "@/lib/format";

/**
 * Cumulative revenue per acquired customer, one line per acquisition cohort.
 *
 * The chart exists to answer "are the customers we buy today worth more than
 * the ones we bought last year", so the two things it must never do are pad and
 * cycle.
 *
 * Padding: a cohort acquired three months ago has three points, and the fourth
 * month is unknown, not zero. Every point is therefore keyed by its own month
 * offset and absent rows stay absent, with `connectNulls` off so a line simply
 * stops at the edge of what has been observed. Filling the tail with zeros — or
 * worse, carrying the last value forward — draws a flat run that reads as
 * "these customers stopped buying".
 *
 * Cycling: a categorical palette runs out, and reusing a hue hands two cohorts
 * the same identity. Four is the cap here rather than the palette's five,
 * because slots four and five are the closest pair in the set under red-green
 * colour blindness and stopping at four keeps them off the same plot — which in
 * turn means colour alone is enough and no line needs a dash pattern to be told
 * apart. Twenty-four overlapping curves would be unreadable at any palette
 * size anyway. When more cohorts are supplied than can be coloured, the
 * component samples evenly across the range — keeping the oldest and newest,
 * which are the two the comparison is actually about — and says so in the
 * caption rather than dropping them silently.
 */

export type CohortLtvChartProps = {
  /** Oldest cohort first, as `getCohortLtvSeries()` returns them. */
  series: CohortLtvSeries[];
  /**
   * Plot height in px, axis band included. A number rather than "100%" so the
   * chart renders in an auto-height grid cell; the width still fills its
   * container.
   */
  height?: number;
  className?: string;
};

/** See the note above on why this is four and not the palette's five. */
const MAX_COHORT_LINES = 4;

/** Month offsets the collapsed table reports, when the data reaches them. */
const TABLE_MONTHS = [0, 3, 6, 12] as const;

/** A pivoted row: `{ month, "2025-01": 4210, "2025-02": null, ... }`. */
type CohortRow = Record<string, number | null>;

type TooltipRow = { key: string; value: number; color: string };

/**
 * Even sample across the supplied cohorts, first and last always kept.
 *
 * Taking the N most recent instead would return only cohorts a few months old,
 * every curve would stop before month six, and the chart would show nothing
 * about long-run value — the one thing it is for.
 */
function sampleCohorts(
  series: CohortLtvSeries[],
  limit: number,
): CohortLtvSeries[] {
  if (series.length <= limit) return series;
  const step = (series.length - 1) / (limit - 1);
  return Array.from(
    { length: limit },
    (_, i) => series[Math.round(i * step)],
  );
}

export function CohortLtvChart({
  series,
  height = 320,
  className,
}: CohortLtvChartProps) {
  const shown = sampleCohorts(series, MAX_COHORT_LINES);
  const truncated = shown.length < series.length;

  const maxMonth = shown.reduce((widest, cohort) => {
    const last = cohort.points[cohort.points.length - 1];
    return last ? Math.max(widest, last.monthsSinceAcquisition) : widest;
  }, 0);

  const hasData = shown.some((cohort) => cohort.points.length > 0);

  // One lookup per cohort so the pivot below stays linear rather than scanning
  // every cohort's points once per month.
  const byMonth = shown.map(
    (cohort) =>
      new Map(
        cohort.points.map((point) => [
          point.monthsSinceAcquisition,
          point.cumulativeRevenuePerCustomerCents,
        ]),
      ),
  );

  const rows: CohortRow[] = [];
  for (let month = 0; month <= maxMonth; month += 1) {
    const row: CohortRow = { month };
    shown.forEach((cohort, index) => {
      // `?? null` and not `?? 0`: an unobserved month has no value, and Recharts
      // breaks the line on null exactly the way the data means it to.
      row[cohort.cohortMonth] = byMonth[index].get(month) ?? null;
    });
    rows.push(row);
  }

  const lastObservedMonth = shown.map((cohort) => {
    const last = cohort.points[cohort.points.length - 1];
    return last ? last.monthsSinceAcquisition : -1;
  });

  const colorOf = new Map(
    shown.map((cohort, index) => [cohort.cohortMonth, chartSeriesVar(index)]),
  );

  const renderTooltip = (props: TooltipContentProps): ReactNode => {
    const { active, label, payload } = props;
    if (!active || !payload || payload.length === 0) return null;

    const entries = payload
      .map((item): TooltipRow | null => {
        const key = typeof item.dataKey === "string" ? item.dataKey : null;
        const value = typeof item.value === "number" ? item.value : null;
        if (key === null || value === null) return null;
        return {
          key,
          value,
          color: colorOf.get(key) ?? CHART_TOKENS.muted,
        };
      })
      .filter((entry): entry is TooltipRow => entry !== null)
      .sort((a, b) => b.value - a.value);

    if (entries.length === 0) return null;

    return (
      <div className="rounded-lg border border-black/[.08] bg-background px-3 py-2 text-xs shadow-sm dark:border-white/[.145]">
        <p className="mb-1.5 text-zinc-500 dark:text-zinc-400">
          Month {typeof label === "number" ? label : "—"} since acquisition
        </p>
        <ul className="flex flex-col gap-1">
          {entries.map((entry) => (
            <li key={entry.key} className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="h-0.5 w-3.5 shrink-0 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              {/* Value leads: the reader already knows the series, they came for the number. */}
              <span className="font-semibold tabular-nums text-foreground">
                {formatCents(entry.value)}
              </span>
              <span className="text-zinc-500 dark:text-zinc-400">
                {formatCohortMonth(entry.key)}
              </span>
            </li>
          ))}
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
          Cumulative LTV by cohort
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Net revenue per acquired customer. Lines end where a cohort&rsquo;s
          observed history ends.
        </p>
      </figcaption>

      {hasData ? (
        <>
          {/* Legend, not colour alone: every cohort is named here and again at
              the end of its own line. */}
          <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
            {shown.map((cohort, index) => (
              <li
                key={cohort.cohortMonth}
                className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400"
              >
                <span
                  aria-hidden="true"
                  className="h-0.5 w-4 rounded-full"
                  style={{ backgroundColor: chartSeriesVar(index) }}
                />
                <span>{formatCohortMonth(cohort.cohortMonth)}</span>
                <span className="text-zinc-400 dark:text-zinc-600">
                  n={cohort.cohortSize.toLocaleString("en-US")}
                </span>
              </li>
            ))}
          </ul>

          <ResponsiveContainer width="100%" height={height}>
            <LineChart
              data={rows}
              // Right margin holds the end labels; without it they clip.
              margin={{ top: 8, right: 64, bottom: 4, left: 0 }}
            >
              <CartesianGrid
                vertical={false}
                stroke={CHART_TOKENS.grid}
                strokeWidth={1}
              />
              <XAxis
                dataKey="month"
                type="number"
                // Never a zero-width domain: the newest cohort can be the only
                // one on the plot and it has a single month of history.
                domain={[0, Math.max(maxMonth, 1)]}
                allowDecimals={false}
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
                cursor={{ stroke: CHART_TOKENS.axis, strokeWidth: 1 }}
                wrapperStyle={{ outline: "none" }}
              />
              {shown.map((cohort, index) => (
                <Line
                  key={cohort.cohortMonth}
                  // Linear, not monotone: a spline invents curvature between two
                  // monthly totals that the ledger does not contain.
                  type="linear"
                  dataKey={cohort.cohortMonth}
                  name={formatCohortMonth(cohort.cohortMonth)}
                  stroke={chartSeriesVar(index)}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  connectNulls={false}
                  // A cohort acquired this month has exactly one observation,
                  // and a one-point polyline draws nothing at all. Give that
                  // case a marker so the newest cohort is visible instead of
                  // silently missing; longer curves keep their dots off.
                  dot={
                    cohort.points.length === 1
                      ? {
                          r: 4,
                          strokeWidth: 2,
                          stroke: CHART_TOKENS.surface,
                          fill: chartSeriesVar(index),
                        }
                      : false
                  }
                  activeDot={{
                    r: 4,
                    strokeWidth: 2,
                    stroke: CHART_TOKENS.surface,
                  }}
                  isAnimationActive={false}
                >
                  {/* Direct labels supplement the legend. Skipped for a
                      single-point cohort, whose "end" sits at month zero in the
                      crowd where every curve begins — a label there lands on
                      top of four other lines and reads as noise. */}
                  {cohort.points.length > 1 ? (
                    <LabelList
                      position="right"
                      offset={10}
                      fontSize={11}
                      fill={CHART_TOKENS.ink}
                      valueAccessor={(entry) => {
                        const row = entry.payload as CohortRow | undefined;
                        return row?.month === lastObservedMonth[index]
                          ? formatCohortMonth(cohort.cohortMonth)
                          : null;
                      }}
                    />
                  ) : null}
                </Line>
              ))}
            </LineChart>
          </ResponsiveContainer>

          <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
            Months since acquisition
          </p>

          {truncated ? (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Showing {shown.length} of {series.length} cohorts, sampled evenly
              from oldest to newest.
            </p>
          ) : null}

          {/* Table twin: every plotted value is readable without hovering, which
              is what keeps the tooltip an enhancement rather than a gate. */}
          <details className="text-xs">
            <summary className="cursor-pointer text-zinc-500 select-none dark:text-zinc-400">
              Data table
            </summary>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[28rem] border-collapse text-left tabular-nums">
                <thead>
                  <tr className="text-zinc-500 dark:text-zinc-400">
                    <th scope="col" className="py-1 pr-4 font-medium">
                      Cohort
                    </th>
                    <th scope="col" className="py-1 pr-4 font-medium">
                      Customers
                    </th>
                    {TABLE_MONTHS.filter((month) => month <= maxMonth).map(
                      (month) => (
                        <th
                          key={month}
                          scope="col"
                          className="py-1 pr-4 font-medium"
                        >
                          M{month}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((cohort, index) => (
                    <tr
                      key={cohort.cohortMonth}
                      className="border-t border-black/[.06] dark:border-white/[.08]"
                    >
                      <th
                        scope="row"
                        className="py-1 pr-4 font-normal text-foreground"
                      >
                        {formatCohortMonth(cohort.cohortMonth)}
                      </th>
                      <td className="py-1 pr-4 text-zinc-600 dark:text-zinc-400">
                        {cohort.cohortSize.toLocaleString("en-US")}
                      </td>
                      {TABLE_MONTHS.filter((month) => month <= maxMonth).map(
                        (month) => (
                          <td
                            key={month}
                            className="py-1 pr-4 text-zinc-600 dark:text-zinc-400"
                          >
                            {/* Unobserved months resolve to undefined here and
                                formatCents renders the em dash, never "$0". */}
                            {formatCents(byMonth[index].get(month) ?? null)}
                          </td>
                        ),
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </>
      ) : (
        <p className="py-12 text-center text-sm text-zinc-500 dark:text-zinc-400">
          No cohort history yet.
        </p>
      )}
    </figure>
  );
}

export default CohortLtvChart;
