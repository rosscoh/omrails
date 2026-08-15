import type { ReactNode } from "react";

/**
 * A single headline number.
 *
 * Deliberately dumb: it takes an already-formatted string rather than cents or
 * a ratio. One tile shows money, the next a multiple, the next a percentage,
 * and baking that choice in here would mean a `kind` prop and a switch that has
 * to be kept in step with `@/lib/format`. The caller already knows which
 * formatter applies — including that `formatCents(null)` renders an em dash —
 * so the tile just prints what it is given.
 */

export type StatTileTrend = {
  /** Which way the number moved. Also picks the glyph. */
  direction: "up" | "down" | "flat";
  /** What moved and against what, e.g. "vs. prior 30 days". */
  label: string;
  /**
   * Whether the movement is welcome. Up is not automatically good — a rising
   * CAC is bad news — so direction and sentiment are separate inputs.
   * Defaults to neutral, which colours the hint like ordinary secondary text.
   */
  sentiment?: "good" | "bad" | "neutral";
};

export type StatTileProps = {
  /** Sentence case, no trailing colon. */
  label: string;
  /** Pre-formatted. Pass the em dash straight through when unknown. */
  value: string;
  /** Optional qualifier under the value: a denominator, window, or caveat. */
  sublabel?: ReactNode;
  trend?: StatTileTrend;
  className?: string;
};

const TREND_GLYPH: Record<StatTileTrend["direction"], string> = {
  up: "↑",
  down: "↓",
  flat: "→",
};

/**
 * Colour never carries the direction on its own — the glyph and the label do.
 * These only reinforce it, which is why "neutral" is a legitimate answer.
 */
const TREND_TONE: Record<
  NonNullable<StatTileTrend["sentiment"]>,
  string
> = {
  good: "text-emerald-700 dark:text-emerald-400",
  bad: "text-red-700 dark:text-red-400",
  neutral: "text-zinc-500 dark:text-zinc-400",
};

export function StatTile({
  label,
  value,
  sublabel,
  trend,
  className,
}: StatTileProps) {
  return (
    <div
      className={[
        "flex flex-col gap-1 rounded-xl border border-black/[.08] bg-background p-5",
        "dark:border-white/[.145]",
        className ?? "",
      ]
        .join(" ")
        .trim()}
    >
      <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
        {label}
      </p>

      {/*
        Proportional figures, not tabular: at this size equal-width digits make
        a value like "121" read as though it has been letter-spaced.
      */}
      <p className="text-3xl font-semibold tracking-tight text-foreground">
        {value}
      </p>

      {sublabel ? (
        <p className="text-xs text-zinc-500 dark:text-zinc-500">{sublabel}</p>
      ) : null}

      {trend ? (
        <p
          className={`mt-1 flex items-baseline gap-1.5 text-xs font-medium ${
            TREND_TONE[trend.sentiment ?? "neutral"]
          }`}
        >
          <span aria-hidden="true">{TREND_GLYPH[trend.direction]}</span>
          <span>{trend.label}</span>
        </p>
      ) : null}
    </div>
  );
}

export default StatTile;
