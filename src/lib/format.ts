/**
 * The presentation layer's half of the analytics contract.
 *
 * Every nullable field in `@/lib/analytics/types` means "not computable from
 * the data we hold" — an organic channel has no CAC, a three-month-old cohort
 * has no LTV at 365 days. The formatters below render every one of those as an
 * em dash. That is the whole point of the file: `formatCents(null)` returning
 * "$0" would put an unmeasured channel next to a measured one and let a reader
 * conclude it earns nothing, which is a different and much worse claim than
 * "we don't know yet". Non-finite numbers get the same treatment for the same
 * reason — a NaN that slipped past `safeRatio()` must not print as "NaNx".
 *
 * Money arrives here as integer cents and is only ever divided by 100 at the
 * last moment, inside these functions. Nothing upstream should be doing that.
 */

/** The one string that means "unknown". Never "0", never blank. */
const EM_DASH = "—";

/** True only for a real, finite number — nulls and NaN both fail. */
function isMeasured(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Whole dollars from integer cents, e.g. `123456` -> `"$1,235"`.
 *
 * Cents are dropped rather than shown: these are averages over cohorts, so the
 * cents are noise, and a column of "$1,234.56" values is harder to scan than a
 * column of "$1,235" ones. Use `compact` for axis ticks, where the label has to
 * fit in a tick's width.
 */
export function formatCents(
  cents: number | null,
  opts?: { compact?: boolean },
): string {
  if (!isMeasured(cents)) return EM_DASH;

  const dollars = cents / 100;
  const sign = dollars < 0 ? "-" : "";
  const magnitude = Math.abs(dollars);

  if (!opts?.compact) {
    return `${sign}$${Math.round(magnitude).toLocaleString("en-US")}`;
  }

  for (const [threshold, suffix] of COMPACT_STEPS) {
    if (magnitude >= threshold) {
      const scaled = magnitude / threshold;
      // One decimal only below 10, so "$1.2k" stays precise while "$12k"
      // does not carry a digit nobody reads.
      const digits = scaled < 10 ? 1 : 0;
      return `${sign}$${trimTrailingZero(scaled.toFixed(digits))}${suffix}`;
    }
  }

  return `${sign}$${Math.round(magnitude).toLocaleString("en-US")}`;
}

/** Ordered largest-first so the first match wins. */
const COMPACT_STEPS: readonly (readonly [number, string])[] = [
  [1_000_000_000, "B"],
  [1_000_000, "M"],
  [1_000, "k"],
];

/** "1.0" -> "1"; leaves "1.2" alone. */
function trimTrailingZero(text: string): string {
  return text.endsWith(".0") ? text.slice(0, -2) : text;
}

/**
 * A multiple, e.g. `3.7642` -> `"3.76x"`.
 *
 * Two decimals because LTV:CAC decisions are made on the second one — 2.9x and
 * 3.1x sit on opposite sides of most payback thresholds.
 */
export function formatRatio(
  value: number | null,
  opts?: { suffix?: string },
): string {
  if (!isMeasured(value)) return EM_DASH;
  return `${value.toFixed(2)}${opts?.suffix ?? "x"}`;
}

/** A 0..1 share as a percentage, e.g. `0.4213` -> `"42.1%"`. */
export function formatPercent(value: number | null): string {
  if (!isMeasured(value)) return EM_DASH;
  return `${(value * 100).toFixed(1)}%`;
}

/**
 * A month count, e.g. `4.2` -> `"4.2 mo"`.
 *
 * Payback lands on whole month offsets, and "4.0 mo" claims a precision the
 * underlying monthly buckets do not have, so an exact integer drops the
 * decimal.
 */
export function formatMonths(value: number | null): string {
  if (!isMeasured(value)) return EM_DASH;
  const rendered = Number.isInteger(value) ? `${value}` : value.toFixed(1);
  return `${rendered} mo`;
}

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/**
 * `"2026-08"` -> `"Aug 2026"`.
 *
 * Parsed by hand rather than through `new Date("2026-08")`, which is treated as
 * UTC midnight and renders as the *previous* month for any viewer west of
 * Greenwich. Cohort labels shifting by a month depending on who opens the
 * dashboard is exactly the kind of bug nobody reports and everybody distrusts.
 * Anything unparseable is passed through untouched, so a bad key is visible
 * rather than silently relabelled.
 */
export function formatCohortMonth(month: string): string {
  const match = /^(\d{4})-(\d{2})/.exec(month);
  if (!match) return month;

  const monthIndex = Number(match[2]) - 1;
  const name = MONTH_NAMES[monthIndex];
  return name ? `${name} ${match[1]}` : month;
}

/** Names the database stores lowercased that readers expect cased. */
const CHANNEL_WORDS: Record<string, string> = {
  tiktok: "TikTok",
  pmax: "PMax",
  seo: "SEO",
  sms: "SMS",
  ppc: "PPC",
};

/** `"google_search"` -> `"Google Search"`, for axis ticks and table rows. */
export function formatChannel(channel: string): string {
  return channel
    .split(/[_\-\s]+/)
    .filter(Boolean)
    .map(
      (word) =>
        CHANNEL_WORDS[word.toLowerCase()] ??
        word.charAt(0).toUpperCase() + word.slice(1).toLowerCase(),
    )
    .join(" ");
}

/* -------------------------------------------------------------------------- */
/* Chart theme                                                                */
/* -------------------------------------------------------------------------- */

/**
 * One palette, shared by every chart, expressed as CSS custom properties.
 *
 * It lives in this module rather than in a chart file because it must be
 * importable from both sides of the client boundary: the charts are `"use
 * client"`, but a server-rendered legend or table swatch needs the same values,
 * and constants re-exported through a client entry point come back as client
 * references rather than strings.
 *
 * Why custom properties and not hex literals passed to Recharts: the values
 * have to change with `prefers-color-scheme`, and an SVG `stroke` attribute
 * baked at render time cannot. `var(--chart-series-1)` in a presentation
 * attribute re-resolves when the media query flips, so one render serves both
 * themes.
 *
 * The five categorical slots are assigned in fixed order and never cycled: a
 * sixth generated hue is indistinguishable from an earlier slot under red-green
 * colour blindness, so charts cap their series count instead of inventing one.
 * The order was validated against both surfaces (#ffffff and #0a0a0a) for
 * lightness band, chroma, adjacent-pair CVD separation and contrast. Slots 1-4
 * clear every threshold outright. Slots 4 and 5 (green and red) are the closest
 * pair in the set under simulated protanopia and land in the band that only
 * passes alongside a second, non-colour channel, so a chart that puts all five
 * on screen owes its reader direct labels or a dash pattern — which is why the
 * cohort chart stops at four rather than spending the fifth slot.
 */
export const CHART_THEME_CSS = `
:root {
  --chart-surface: #ffffff;
  --chart-grid: #ececea;
  --chart-axis: #d6d6d2;
  --chart-ink: #171717;
  --chart-muted: #6f6f6b;
  --chart-hover: rgba(23, 23, 23, 0.05);
  --chart-series-1: #2a78d6;
  --chart-series-2: #eb6834;
  --chart-series-3: #4a3aa7;
  --chart-series-4: #008300;
  --chart-series-5: #e34948;
}
@media (prefers-color-scheme: dark) {
  :root {
    --chart-surface: #0a0a0a;
    --chart-grid: #232323;
    --chart-axis: #333330;
    --chart-ink: #ededed;
    --chart-muted: #8f8f8b;
    --chart-hover: rgba(237, 237, 237, 0.07);
    --chart-series-1: #3987e5;
    --chart-series-2: #d95926;
    --chart-series-3: #9085e9;
    --chart-series-4: #008300;
    --chart-series-5: #e66767;
  }
}
`;

/**
 * Stable identity for the stylesheet above. React 19 hoists a `<style>` that
 * carries `href` + `precedence` into the head and drops the duplicate, so both
 * charts can render it and the rules land exactly once.
 */
export const CHART_THEME_HREF = "ltv-chart-theme";

/** Non-series colour roles, as `var()` references. */
export const CHART_TOKENS = {
  surface: "var(--chart-surface)",
  grid: "var(--chart-grid)",
  axis: "var(--chart-axis)",
  ink: "var(--chart-ink)",
  muted: "var(--chart-muted)",
  hover: "var(--chart-hover)",
} as const;

/** How many series a single chart may colour before it has to fold or facet. */
export const CHART_SERIES_SLOTS = 5;

/**
 * Colour for the nth series, by position. Clamped rather than wrapped, because
 * a wrapped palette hands two different series the same hue and is worse than
 * two series sharing the last one — callers are expected to cap first.
 */
export function chartSeriesVar(index: number): string {
  const slot = Math.min(Math.max(Math.trunc(index), 0), CHART_SERIES_SLOTS - 1);
  return `var(--chart-series-${slot + 1})`;
}
