# LTV PowerPoint boilerplate

A 16-slide reusable deck template for The Lifetime Value Company (ltvco.com),
plus the generator that produces it.

| File | What it is |
|---|---|
| `LTV-Presentation-Boilerplate.pptx` | The deck. Open it, duplicate the layouts you need, delete the rest. |
| `build_deck.js` | Generator. Edit `THEME` / `CONTENT` and rebuild to re-brand the whole deck. |

## ⚠️ On the brand colours and fonts

**The palette and typefaces here are a designed proposal, not extracted from
ltvco.com.** The sandbox this was built in blocks outbound requests to
`ltvco.com` (and to Brandfetch, the Wayback Machine, and every other mirror
tried), so the live stylesheet could not be read.

What *is* taken from the real company: the tagline "Discover Everyday Public
Data", the mission statement, the founding year, the remote-first structure,
and the nine consumer brand names — all sourced from public pages.

Everything visual is a fresh interpretation aimed at a modern data/consumer-tech
look. If you have the real brand hexes and fonts, swapping them in is a
two-object edit — see below.

## Re-theming

Every colour and typeface is defined once, at the top of `build_deck.js`:

```js
const THEME = {
  font:  { head: "Arial", body: "Calibri" },
  color: { ink: "0A1628", blue: "1B5CFF", mint: "2BD9A4", ... },
};
```

Change those values, rebuild, and all 16 slides follow. No layout code needs to
be touched.

### Current palette

| Token | Hex | Role |
|---|---|---|
| `ink` | `#0A1628` | Dominant dark — cover, section dividers, quote, closing |
| `inkLift` | `#16294A` | Raised surface on dark slides |
| `blue` | `#1B5CFF` | Primary accent — kickers, numbers, chart series, active states |
| `mint` | `#2BD9A4` | Sharp accent — one moment per slide |
| `amber` | `#FFB020` | Tertiary, data only |
| `paper` | `#F5F8FC` | Light card fill |
| `line` | `#DCE4F0` | Hairline borders |
| `muted` | `#5F7086` | Secondary text |

### A note on fonts

Arial and Calibri are deliberate: both ship with every Office install and render
at true width in the LibreOffice-based preview used for QA, so the layout you
see is the layout recipients get. If you switch `THEME.font` to a brand
typeface, re-check for text overflow — a substituted font changes line widths.

## The 16 layouts

| # | Layout | Use for |
|---|---|---|
| 1 | Cover (dark) | Deck title |
| 2 | Agenda | Numbered contents, two columns |
| 3 | Section divider (dark) | Duplicate per section, bump the number |
| 4 | Text + stat cards | Narrative with supporting KPIs |
| 5 | Card grid (3×3) | Portfolio, features, options |
| 6 | Big stats (dark) | Three headline numbers |
| 7 | Chart + insight | Native PowerPoint chart with a takeaway |
| 8 | Half-bleed panel | Content beside an image or screenshot |
| 9 | Icon rows | Values, principles, requirements |
| 10 | Timeline | Four-step roadmap or process |
| 11 | Two-column comparison | Before/after, current/target |
| 12 | Team | Four people with initials or headshots |
| 13 | Quote (dark) | Mission, testimonial, key statement |
| 14 | Table | Detail with a source note |
| 15 | Brand system | Palette and type reference (delete before sending externally) |
| 16 | Closing (dark) | Thank you and contact |

Every slide carries speaker notes explaining how to adapt it.

## Rebuilding

```bash
npm install pptxgenjs sharp react react-dom react-icons
node build_deck.js
```

Icons are [Feather](https://feathericons.com/) via `react-icons`, rasterised at
build time and embedded — the `.pptx` has no external dependencies.

### QA

```bash
python3 <pptx-skill>/scripts/office/validate.py LTV-Presentation-Boilerplate.pptx
soffice --headless --convert-to pdf LTV-Presentation-Boilerplate.pptx
pdftoppm -jpeg -r 110 LTV-Presentation-Boilerplate.pdf slide
```

The current build passes validation and all 16 slides have been visually
inspected for overflow, overlap and margin violations.
