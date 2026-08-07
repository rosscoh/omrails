/**
 * LTV — The Lifetime Value Company
 * PowerPoint boilerplate generator.
 *
 * Everything brand-specific lives in THEME and CONTENT below. Change those two
 * objects and every slide re-themes itself; no layout code needs to be touched.
 *
 *   npm install pptxgenjs sharp react react-dom react-icons
 *   node build_deck.js
 */

const path = require("path");
const pptxgen = require("pptxgenjs");
const sharp = require("sharp");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const Fi = require("react-icons/fi");

/* ------------------------------------------------------------------ THEME */

const THEME = {
  font: {
    head: "Arial", // headlines, numbers, labels
    body: "Calibri", // paragraphs, captions, table cells
  },
  color: {
    ink: "0A1628", // dominant dark — title/section/closing backgrounds
    inkLift: "16294A", // raised surface on dark slides
    blue: "1B5CFF", // primary brand accent
    blueSoft: "E8EEFF",
    mint: "2BD9A4", // sharp accent — one per slide, no more
    mintSoft: "E2FAF2",
    amber: "FFB020", // tertiary, data only
    amberSoft: "FFF4DE",
    white: "FFFFFF",
    paper: "F5F8FC", // light surface / card fill
    line: "DCE4F0", // hairline borders
    text: "0A1628",
    muted: "5F7086",
    onDark: "FFFFFF",
    onDarkMuted: "9DB0C7",
  },
  size: {
    title: 40,
    hero: 50,
    section: 46,
    header: 20,
    body: 14,
    caption: 11,
    kicker: 11,
  },
};

const C = THEME.color;
const F = THEME.font;
const S = THEME.size;

/* ---------------------------------------------------------------- CONTENT */

const CONTENT = {
  company: "The Lifetime Value Company",
  short: "LTV",
  site: "ltvco.com",
  tagline: { lead: "Discover Everyday ", accent: "Public Data" },
  mission:
    "To develop a diverse portfolio of technologies, products, and services that gives all people equal access to unbiased data and information.",
  brands: [
    ["BeenVerified", "People search", "FiUser"],
    ["Bumper", "Vehicle history", "FiTruck"],
    ["Ownerly", "Home value", "FiHome"],
    ["NeighborWho", "Property records", "FiMapPin"],
    ["PeopleLooker", "Background reports", "FiSearch"],
    ["NumberGuru", "Phone lookup", "FiPhone"],
    ["PeopleSmart", "Contact discovery", "FiUsers"],
    ["ReversePhone", "Caller ID", "FiPhoneIncoming"],
    ["MoneyBot5000", "Personal finance", "FiDollarSign"],
  ],
};

/* -------------------------------------------------------------- GEOMETRY  */

const W = 13.333;
const H = 7.5;
const M = 0.75; // page margin
const CW = W - M * 2; // content width

/* --------------------------------------------------------------- HELPERS  */

// pptxgenjs mutates option objects in place, so every shadow must be a fresh object.
const shadow = (opacity = 0.1, blur = 14, offset = 5) => ({
  type: "outer",
  angle: 90,
  blur,
  offset,
  color: "0A1628",
  opacity,
});

async function iconPng(name, color, size = 256) {
  const Comp = Fi[name];
  if (!Comp) throw new Error(`unknown icon: ${name}`);
  const svg = renderToStaticMarkup(
    React.createElement(Comp, { color: `#${color}`, size, strokeWidth: 2 })
  );
  const buf = await sharp(Buffer.from(svg), { density: 384 })
    .resize(size, size)
    .png()
    .toBuffer();
  return "image/png;base64," + buf.toString("base64");
}

async function dotGridPng(color, cols, rows, step = 18, r = 2.4, opacity = 1) {
  let circles = "";
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      circles += `<circle cx="${i * step + step / 2}" cy="${
        j * step + step / 2
      }" r="${r}" fill="#${color}" fill-opacity="${opacity}"/>`;
    }
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cols * step}" height="${
    rows * step
  }">${circles}</svg>`;
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}

/* ------------------------------------------------------------------ BUILD */

async function build() {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE"; // must be set before any slide is added
  pres.author = CONTENT.company;
  pres.company = CONTENT.company;
  pres.title = `${CONTENT.short} — Presentation Boilerplate`;

  // Pre-render every raster asset once.
  const ICONS = {};
  const wanted = [
    ["shieldDark", "FiShield", C.blue],
    ["zapDark", "FiZap", C.blue],
    ["compass", "FiCompass", C.blue],
    ["message", "FiMessageCircle", C.blue],
    ["trend", "FiTrendingUp", C.blue],
    ["target", "FiTarget", C.mint],
    ["layers", "FiLayers", C.white],
    ["check", "FiCheck", C.mint],
    ["x", "FiX", C.muted],
    ["quote", "FiMessageSquare", C.mint],
    ["mail", "FiMail", C.mint],
    ["globe", "FiGlobe", C.mint],
  ];
  for (const [key, comp, col] of wanted) ICONS[key] = await iconPng(comp, col);
  for (const [, , iconName] of CONTENT.brands) {
    if (!ICONS[iconName]) ICONS[iconName] = await iconPng(iconName, C.blue);
  }

  const DOTS_DARK = await dotGridPng(C.white, 16, 16, 18, 2.4, 0.16);
  const DOTS_LIGHT = await dotGridPng(C.blue, 14, 10, 18, 2.4, 0.18);

  /* ---------- shared slide furniture ---------- */

  const darkSlide = () => {
    const s = pres.addSlide();
    s.background = { color: C.ink };
    return s;
  };
  const lightSlide = () => {
    const s = pres.addSlide();
    s.background = { color: C.white };
    return s;
  };

  // Kicker + title used on every light content slide.
  function heading(slide, kicker, title, opts = {}) {
    const w = opts.w || CW;
    slide.addText(kicker.toUpperCase(), {
      x: M,
      y: 0.72,
      w,
      h: 0.26,
      fontFace: F.head,
      fontSize: S.kicker,
      bold: true,
      charSpacing: 2.4,
      color: opts.kickerColor || C.blue,
      margin: 0,
    });
    slide.addText(title, {
      x: M,
      y: 1.05,
      w,
      h: 0.72,
      fontFace: F.head,
      fontSize: opts.titleSize || S.title,
      bold: true,
      color: opts.titleColor || C.text,
      charSpacing: -0.5,
      margin: 0,
      valign: "top",
    });
  }

  function footer(slide, onDark = false) {
    slide.addText(`${CONTENT.short}  ·  ${CONTENT.site}`, {
      x: M,
      y: H - 0.62,
      w: 4,
      h: 0.28,
      fontFace: F.body,
      fontSize: 9,
      color: onDark ? C.onDarkMuted : C.muted,
      margin: 0,
      valign: "middle",
    });
  }

  // Circular icon chip — the repeated motif across the deck.
  function chip(slide, x, y, d, img, fill) {
    slide.addShape(pres.ShapeType.ellipse, {
      x,
      y,
      w: d,
      h: d,
      fill: { color: fill },
      line: { type: "none" },
    });
    const pad = d * 0.28;
    slide.addImage({ data: img, x: x + pad, y: y + pad, w: d - pad * 2, h: d - pad * 2 });
  }

  function card(slide, x, y, w, h, opts = {}) {
    slide.addShape(pres.ShapeType.roundRect, {
      x,
      y,
      w,
      h,
      rectRadius: 0.12,
      fill: { color: opts.fill || C.white },
      line: opts.line === "none" ? { type: "none" } : { color: opts.line || C.line, width: 1 },
      shadow: opts.shadow === false ? undefined : shadow(0.07, 12, 4),
    });
  }

  /* =================================================== 1 — TITLE (dark) */
  {
    const s = darkSlide();
    s.addImage({ data: DOTS_DARK, x: 9.55, y: 3.55, w: 4.0, h: 4.0 });

    s.addText(CONTENT.short, {
      x: M,
      y: 0.62,
      w: 1.2,
      h: 0.55,
      fontFace: F.head,
      fontSize: 30,
      bold: true,
      color: C.white,
      charSpacing: -0.5,
      margin: 0,
      valign: "middle",
    });
    s.addShape(pres.ShapeType.ellipse, {
      x: 1.52,
      y: 0.82,
      w: 0.15,
      h: 0.15,
      fill: { color: C.mint },
      line: { type: "none" },
    });
    s.addText(CONTENT.company.toUpperCase(), {
      x: 1.82,
      y: 0.62,
      w: 4.5,
      h: 0.55,
      fontFace: F.head,
      fontSize: 10,
      bold: true,
      charSpacing: 2.6,
      color: C.onDarkMuted,
      margin: 0,
      valign: "middle",
    });

    s.addText(
      [
        { text: CONTENT.tagline.lead, options: { color: C.white } },
        { text: CONTENT.tagline.accent, options: { color: C.mint } },
      ],
      {
        x: M,
        y: 2.45,
        w: 7.6, // narrow enough to force the break before the mint accent
        h: 2.0,
        fontFace: F.head,
        fontSize: S.hero,
        bold: true,
        charSpacing: -1.2,
        lineSpacing: 56,
        margin: 0,
        valign: "top",
      }
    );

    s.addText(
      "A ready-to-use presentation system: cover, section, content, data and closing layouts built on the LTV palette and type scale.",
      {
        x: M,
        y: 4.72,
        w: 7.1,
        h: 0.9,
        fontFace: F.body,
        fontSize: 15,
        color: C.onDarkMuted,
        lineSpacing: 22,
        margin: 0,
      }
    );

    s.addText("Presentation title  ·  Month Year", {
      x: M,
      y: H - 1.0,
      w: 6,
      h: 0.3,
      fontFace: F.body,
      fontSize: 11,
      color: C.onDarkMuted,
      margin: 0,
    });
    s.addNotes(
      "Cover slide. Replace the headline with your deck title and update the date line. The mint half of the headline is the accent — keep it to two or three words."
    );
  }

  /* ================================================== 2 — AGENDA (light) */
  {
    const s = lightSlide();
    heading(s, "Agenda", "What we'll cover");

    const items = [
      ["Who we are", "Company, mission and how we're structured"],
      ["Our brands", "The consumer portfolio and what each one does"],
      ["The opportunity", "Market context and where we're heading"],
      ["Performance", "Metrics, trends and what they tell us"],
      ["How we work", "Values, process and operating principles"],
      ["Next steps", "Decisions needed and owners"],
    ];

    const colX = [M, 7.0];
    const rowY = [2.35, 3.72, 5.09];
    items.forEach(([label, desc], i) => {
      const x = colX[i % 2];
      const y = rowY[Math.floor(i / 2)];
      const num = String(i + 1).padStart(2, "0");

      s.addShape(pres.ShapeType.ellipse, {
        x,
        y,
        w: 0.58,
        h: 0.58,
        fill: { color: C.blueSoft },
        line: { type: "none" },
      });
      s.addText(num, {
        x,
        y,
        w: 0.58,
        h: 0.58,
        fontFace: F.head,
        fontSize: 13,
        bold: true,
        color: C.blue,
        align: "center",
        valign: "middle",
        margin: 0,
      });
      s.addText(label, {
        x: x + 0.82,
        y: y - 0.02,
        w: 4.7,
        h: 0.32,
        fontFace: F.head,
        fontSize: 16,
        bold: true,
        color: C.text,
        margin: 0,
        valign: "middle",
      });
      s.addText(desc, {
        x: x + 0.82,
        y: y + 0.3,
        w: 4.9,
        h: 0.5,
        fontFace: F.body,
        fontSize: 12,
        color: C.muted,
        lineSpacing: 16,
        margin: 0,
      });
    });
    footer(s);
    s.addNotes("Agenda layout. Six numbered items in two columns — drop rows you don't need and the grid still reads.");
  }

  /* ========================================= 3 — SECTION DIVIDER (dark) */
  {
    const s = darkSlide();
    s.addImage({ data: DOTS_DARK, x: 10.2, y: 4.3, w: 3.6, h: 3.6 });

    s.addText("SECTION 01", {
      x: M,
      y: 2.55,
      w: 6,
      h: 0.3,
      fontFace: F.head,
      fontSize: 12,
      bold: true,
      charSpacing: 2.8,
      color: C.mint,
      margin: 0,
    });
    s.addText("Who we are", {
      x: M,
      y: 2.98,
      w: 8.6,
      h: 1.0,
      fontFace: F.head,
      fontSize: S.section,
      bold: true,
      color: C.white,
      charSpacing: -1,
      margin: 0,
      valign: "top",
    });
    s.addText(
      "A technology company built around one idea — public data should be easy for anyone to find, understand and act on.",
      {
        x: M,
        y: 4.15,
        w: 7.4,
        h: 0.8,
        fontFace: F.body,
        fontSize: 15,
        color: C.onDarkMuted,
        lineSpacing: 22,
        margin: 0,
      }
    );
    footer(s, true);
    s.addNotes("Section divider. Duplicate this slide for each new section and bump the section number.");
  }

  /* ================================================ 4 — WHO WE ARE (light) */
  {
    const s = lightSlide();
    // Title wraps to two lines here, so body copy starts lower than on
    // single-line-title slides.
    heading(s, "Who we are", "Public data, made usable", { w: 5.8, titleSize: 36 });

    s.addText(
      "We build web and app products that put public data into people's hands — information about people, homes, vehicles and businesses that was always public, but never practical to use.",
      {
        x: M,
        y: 2.5,
        w: 5.5,
        h: 1.3,
        fontFace: F.body,
        fontSize: S.body,
        color: C.muted,
        lineSpacing: 21,
        margin: 0,
      }
    );
    s.addText(
      "Founded in 2007 and remote-first, we operate a portfolio of consumer brands used by millions of people to get answers about the world around them.",
      {
        x: M,
        y: 3.9,
        w: 5.5,
        h: 1.1,
        fontFace: F.body,
        fontSize: S.body,
        color: C.muted,
        lineSpacing: 21,
        margin: 0,
      }
    );

    chip(s, M, 5.15, 0.62, ICONS.target, C.mintSoft);
    s.addText("Our mission", {
      x: M + 0.85,
      y: 5.12,
      w: 4.6,
      h: 0.28,
      fontFace: F.head,
      fontSize: 13,
      bold: true,
      color: C.text,
      margin: 0,
      valign: "middle",
    });
    s.addText(CONTENT.mission, {
      x: M + 0.85,
      y: 5.42,
      w: 4.65,
      h: 0.9,
      fontFace: F.body,
      fontSize: 12,
      color: C.muted,
      lineSpacing: 16,
      margin: 0,
    });

    const stats = [
      ["2007", "Founded", C.blue],
      ["9", "Consumer brands", C.mint],
      ["100%", "Remote-first", C.blue],
      ["Millions", "People served", C.amber],
    ];
    const sx = [6.85, 10.15];
    const sy = [1.95, 4.05];
    stats.forEach(([big, label, col], i) => {
      const x = sx[i % 2];
      const y = sy[Math.floor(i / 2)];
      card(s, x, y, 2.98, 1.85, { fill: C.paper, line: "none" });
      s.addText(big, {
        x: x + 0.28,
        y: y + 0.38,
        w: 2.42,
        h: 0.75,
        fontFace: F.head,
        fontSize: 34,
        bold: true,
        color: col,
        charSpacing: -1,
        margin: 0,
        valign: "middle",
      });
      s.addText(label.toUpperCase(), {
        x: x + 0.28,
        y: y + 1.16,
        w: 2.42,
        h: 0.3,
        fontFace: F.head,
        fontSize: 10,
        bold: true,
        charSpacing: 1.6,
        color: C.muted,
        margin: 0,
      });
    });
    footer(s);
    s.addNotes("Text-plus-stats layout. The four stat cards work equally well as a standalone KPI slide.");
  }

  /* ================================================== 5 — BRANDS (light) */
  {
    const s = lightSlide();
    heading(s, "Our brands", "One portfolio, nine front doors");

    const cols = 3;
    const gap = 0.3;
    const cw = (CW - gap * (cols - 1)) / cols;
    const ch = 1.25;
    const rgap = 0.2;
    CONTENT.brands.forEach(([name, cat, iconName], i) => {
      const x = M + (i % cols) * (cw + gap);
      const y = 2.35 + Math.floor(i / cols) * (ch + rgap);
      card(s, x, y, cw, ch);
      chip(s, x + 0.3, y + 0.37, 0.5, ICONS[iconName], C.blueSoft);
      s.addText(name, {
        x: x + 0.95,
        y: y + 0.34,
        w: cw - 1.2,
        h: 0.3,
        fontFace: F.head,
        fontSize: 14,
        bold: true,
        color: C.text,
        margin: 0,
        valign: "middle",
      });
      s.addText(cat, {
        x: x + 0.95,
        y: y + 0.63,
        w: cw - 1.2,
        h: 0.26,
        fontFace: F.body,
        fontSize: 11,
        color: C.muted,
        margin: 0,
        valign: "middle",
      });
    });
    footer(s);
    s.addNotes("Card grid. Swap in logos by replacing the icon chip with an image at the same coordinates.");
  }

  /* ================================================ 6 — BIG STATS (dark) */
  {
    const s = darkSlide();
    s.addImage({ data: DOTS_DARK, x: 11.3, y: 5.75, w: 2.6, h: 2.6 });
    heading(s, "By the numbers", "The metrics we run on", {
      kickerColor: C.mint,
      titleColor: C.white,
    });

    const stats = [
      ["9", "Consumer brands", "Search, vehicle, property and phone products under one roof.", C.mint],
      ["2007", "Year founded", "Nearly two decades building in the public-data category.", C.white],
      ["100%", "Remote-first", "A distributed team across the US and Costa Rica.", C.amber],
    ];
    const gap = 0.4;
    const cw = (CW - gap * 2) / 3;
    stats.forEach(([big, label, desc, col], i) => {
      const x = M + i * (cw + gap);
      s.addShape(pres.ShapeType.roundRect, {
        x,
        y: 2.6,
        w: cw,
        h: 2.85,
        rectRadius: 0.12,
        fill: { color: C.inkLift },
        line: { type: "none" },
      });
      s.addText(big, {
        x: x + 0.4,
        y: 2.85,
        w: cw - 0.8,
        h: 1.15,
        fontFace: F.head,
        fontSize: 60,
        bold: true,
        color: col,
        charSpacing: -2,
        margin: 0,
        valign: "middle",
      });
      s.addText(label.toUpperCase(), {
        x: x + 0.4,
        y: 4.02,
        w: cw - 0.8,
        h: 0.3,
        fontFace: F.head,
        fontSize: 10,
        bold: true,
        charSpacing: 1.8,
        color: C.onDarkMuted,
        margin: 0,
      });
      s.addText(desc, {
        x: x + 0.4,
        y: 4.38,
        w: cw - 0.8,
        h: 0.85,
        fontFace: F.body,
        fontSize: 12,
        color: C.onDarkMuted,
        lineSpacing: 17,
        margin: 0,
      });
    });
    footer(s, true);
    s.addNotes("Dark KPI slide. Three is the sweet spot — four fits, five gets cramped.");
  }

  /* =================================================== 7 — CHART (light) */
  {
    const s = lightSlide();
    heading(s, "Performance", "Growth across the portfolio");

    s.addChart(
      pres.ChartType.bar,
      [
        {
          name: "Monthly active users (M)",
          labels: ["Q1", "Q2", "Q3", "Q4", "Q1", "Q2"],
          values: [3.1, 3.6, 4.2, 4.5, 5.3, 6.1],
        },
      ],
      {
        x: M,
        y: 2.2,
        w: 7.7,
        h: 4.35,
        barDir: "col",
        barGapWidthPct: 55,
        chartColors: [C.blue],
        showTitle: false,
        showLegend: false,
        showValue: true,
        dataLabelPosition: "outEnd",
        dataLabelFormatCode: "0.0", // otherwise the decimals round away
        dataLabelColor: C.muted,
        dataLabelFontFace: F.body,
        dataLabelFontSize: 11,
        catAxisLabelColor: C.muted,
        catAxisLabelFontFace: F.body,
        catAxisLabelFontSize: 11,
        catAxisLineShow: false,
        catGridLine: { style: "none" },
        valAxisLabelColor: C.muted,
        valAxisLabelFontFace: F.body,
        valAxisLabelFontSize: 11,
        valAxisLineShow: false,
        valGridLine: { color: C.line, size: 1 },
        valAxisMaxVal: 7,
      }
    );

    card(s, 8.85, 2.2, 3.73, 4.35, { fill: C.paper, line: "none" });
    chip(s, 9.2, 2.55, 0.62, ICONS.trend, C.mintSoft);
    s.addText("What this shows", {
      x: 9.2,
      y: 3.35,
      w: 3.05,
      h: 0.32,
      fontFace: F.head,
      fontSize: 15,
      bold: true,
      color: C.text,
      margin: 0,
      valign: "middle",
    });
    s.addText(
      "Six straight quarters of growth, with the steepest lift in the most recent two as the property and vehicle products compounded.",
      {
        x: 9.2,
        y: 3.72,
        w: 3.05,
        h: 1.3,
        fontFace: F.body,
        fontSize: 12,
        color: C.muted,
        lineSpacing: 17,
        margin: 0,
      }
    );
    s.addText("+97%", {
      x: 9.2,
      y: 5.1,
      w: 3.05,
      h: 0.7,
      fontFace: F.head,
      fontSize: 34,
      bold: true,
      color: C.mint,
      charSpacing: -1,
      margin: 0,
      valign: "middle",
    });
    s.addText("SIX-QUARTER GROWTH", {
      x: 9.2,
      y: 5.78,
      w: 3.05,
      h: 0.3,
      fontFace: F.head,
      fontSize: 9.5,
      bold: true,
      charSpacing: 1.6,
      color: C.muted,
      margin: 0,
    });
    footer(s);
    s.addNotes("Native PowerPoint chart — click it to edit the data directly. Always pair a chart with the one sentence it proves.");
  }

  /* ============================================= 8 — SPLIT PANEL (light) */
  {
    const s = lightSlide();
    s.addShape(pres.ShapeType.rect, {
      x: 7.6,
      y: 0,
      w: W - 7.6,
      h: H,
      fill: { color: C.ink },
      line: { type: "none" },
    });
    s.addImage({ data: DOTS_DARK, x: 11.2, y: 5.95, w: 2.8, h: 2.8 });

    // Two-line title, so body copy starts lower.
    heading(s, "The opportunity", "Data people can actually use", {
      w: 6.1,
      titleSize: 36,
    });
    s.addText(
      "Public records are scattered across thousands of sources, in formats nobody outside the industry can read. The value isn't in holding the data — it's in the moment someone gets a clear answer.",
      {
        x: M,
        y: 2.55,
        w: 6.1,
        h: 1.4,
        fontFace: F.body,
        fontSize: S.body,
        color: C.muted,
        lineSpacing: 21,
        margin: 0,
      }
    );

    const points = [
      ["Aggregate", "Thousands of public sources, continuously refreshed."],
      ["Resolve", "Matched and de-duplicated into a single record."],
      ["Deliver", "Presented so a non-expert understands it in seconds."],
    ];
    points.forEach(([t, d], i) => {
      const y = 4.2 + i * 0.9;
      chip(s, M, y, 0.5, ICONS.check, C.mintSoft);
      s.addText(t, {
        x: M + 0.72,
        y: y - 0.02,
        w: 5.4,
        h: 0.28,
        fontFace: F.head,
        fontSize: 14,
        bold: true,
        color: C.text,
        margin: 0,
        valign: "middle",
      });
      s.addText(d, {
        x: M + 0.72,
        y: y + 0.26,
        w: 5.4,
        h: 0.38,
        fontFace: F.body,
        fontSize: 11.5,
        color: C.muted,
        margin: 0,
      });
    });

    chip(s, 8.35, 2.5, 0.9, ICONS.layers, C.inkLift);
    s.addText("Image or product\nshot goes here", {
      x: 8.35,
      y: 3.65,
      w: 4.2,
      h: 1.0,
      fontFace: F.head,
      fontSize: 22,
      bold: true,
      color: C.white,
      lineSpacing: 28,
      margin: 0,
      valign: "top",
    });
    s.addText(
      "Replace this panel with a full-bleed screenshot or photo. Keep the text overlay inside the left 3.5 inches of the panel.",
      {
        x: 8.35,
        y: 4.75,
        w: 4.2,
        h: 1.0,
        fontFace: F.body,
        fontSize: 12,
        color: C.onDarkMuted,
        lineSpacing: 17,
        margin: 0,
      }
    );
    footer(s);
    s.addNotes("Half-bleed panel layout. Drop an image over the dark rectangle at x=7.6, y=0, w=5.73, h=7.5 for a full-bleed treatment.");
  }

  /* ================================================== 9 — VALUES (light) */
  {
    const s = lightSlide();
    heading(s, "How we work", "The principles behind the work");

    const values = [
      ["Try, fail, learn, repeat", "We ship, measure and iterate rather than wait for certainty.", "zapDark"],
      ["Question everything, respectfully", "Ideas get challenged on merit; people get treated well.", "message"],
      ["Everyone has a voice", "Diverse experience is how we catch what one perspective misses.", "compass"],
      ["Protect the customer", "Accuracy and privacy come before short-term conversion.", "shieldDark"],
      ["Grow the people", "Personalised development plans and internal leadership paths.", "trend"],
    ];
    values.forEach(([t, d, ic], i) => {
      const y = 2.2 + i * 0.88;
      card(s, M, y, CW, 0.76, { fill: C.paper, line: "none", shadow: false });
      chip(s, M + 0.24, y + 0.13, 0.5, ICONS[ic], C.white);
      s.addText(t, {
        x: M + 0.95,
        y: y + 0.1,
        w: 3.7,
        h: 0.3,
        fontFace: F.head,
        fontSize: 14.5,
        bold: true,
        color: C.text,
        margin: 0,
        valign: "middle",
      });
      s.addText(d, {
        x: M + 4.75,
        y: y + 0.1,
        w: CW - 5.0,
        h: 0.56,
        fontFace: F.body,
        fontSize: 12,
        color: C.muted,
        margin: 0,
        valign: "middle",
      });
    });
    footer(s);
    s.addNotes("Icon-row list. Works for values, principles, feature lists or requirements — up to five rows.");
  }

  /* ================================================ 10 — TIMELINE (light) */
  {
    const s = lightSlide();
    heading(s, "Roadmap", "How the work sequences");

    const steps = [
      ["Discover", "Q1", "Audit sources, size the opportunity, agree success metrics."],
      ["Build", "Q2", "Ship the first working version to a limited audience."],
      ["Scale", "Q3", "Expand coverage and harden the ingestion pipeline."],
      ["Optimise", "Q4", "Tune conversion, cost per record and retention."],
    ];
    const gap = 0.35;
    const cw = (CW - gap * 3) / 4;
    const lineY = 3.05;

    // Connector behind the step markers.
    s.addShape(pres.ShapeType.rect, {
      x: M + cw / 2,
      y: lineY - 0.01,
      w: CW - cw,
      h: 0.02,
      fill: { color: C.line },
      line: { type: "none" },
    });

    steps.forEach(([t, when, d], i) => {
      const x = M + i * (cw + gap);
      const cx = x + cw / 2 - 0.28;
      const active = i < 2;
      s.addShape(pres.ShapeType.ellipse, {
        x: cx,
        y: lineY - 0.28,
        w: 0.56,
        h: 0.56,
        fill: { color: active ? C.blue : C.white },
        line: { color: active ? C.blue : C.line, width: 2 },
      });
      s.addText(String(i + 1), {
        x: cx,
        y: lineY - 0.28,
        w: 0.56,
        h: 0.56,
        fontFace: F.head,
        fontSize: 13,
        bold: true,
        color: active ? C.white : C.muted,
        align: "center",
        valign: "middle",
        margin: 0,
      });
      s.addText(when.toUpperCase(), {
        x,
        y: 3.9,
        w: cw,
        h: 0.28,
        fontFace: F.head,
        fontSize: 10,
        bold: true,
        charSpacing: 1.0,
        color: active ? C.blue : C.muted,
        align: "center",
        margin: 0,
      });
      s.addText(t, {
        x,
        y: 4.2,
        w: cw,
        h: 0.36,
        fontFace: F.head,
        fontSize: 17,
        bold: true,
        color: C.text,
        align: "center",
        margin: 0,
      });
      s.addText(d, {
        x: x + 0.12,
        y: 4.66,
        w: cw - 0.24,
        h: 1.0,
        fontFace: F.body,
        fontSize: 12,
        color: C.muted,
        align: "center",
        lineSpacing: 17,
        margin: 0,
      });
    });
    footer(s);
    s.addNotes("Timeline layout. Filled markers are complete or in-flight; outlined markers are upcoming.");
  }

  /* ============================================== 11 — COMPARISON (light) */
  {
    const s = lightSlide();
    heading(s, "Comparison", "Where we are vs. where we're going");

    const cols = [
      {
        label: "TODAY",
        title: "Fragmented",
        fill: C.paper,
        border: "none",
        accent: C.muted,
        icon: "x",
        items: [
          "Each brand maintains its own data pipeline",
          "Duplicated ingestion cost across products",
          "Inconsistent record quality between brands",
          "Slow to launch anything new",
        ],
      },
      {
        label: "TARGET",
        title: "Consolidated",
        fill: C.mintSoft,
        border: C.mint,
        accent: C.text,
        icon: "check",
        items: [
          "One shared ingestion and resolution layer",
          "Marginal cost per new brand approaches zero",
          "A single quality bar every product inherits",
          "New products launch in weeks, not quarters",
        ],
      },
    ];

    cols.forEach((col, i) => {
      const x = M + i * (CW / 2 + 0.15);
      const w = CW / 2 - 0.15;
      card(s, x, 2.2, w, 4.3, {
        fill: col.fill,
        line: col.border === "none" ? "none" : col.border,
        shadow: false,
      });
      s.addText(col.label, {
        x: x + 0.4,
        y: 2.5,
        w: w - 0.8,
        h: 0.28,
        fontFace: F.head,
        fontSize: 10,
        bold: true,
        charSpacing: 1.8,
        color: i === 1 ? C.mint : C.muted,
        margin: 0,
      });
      s.addText(col.title, {
        x: x + 0.4,
        y: 2.82,
        w: w - 0.8,
        h: 0.5,
        fontFace: F.head,
        fontSize: 26,
        bold: true,
        color: col.accent,
        charSpacing: -0.6,
        margin: 0,
        valign: "middle",
      });
      col.items.forEach((it, j) => {
        const y = 3.55 + j * 0.68;
        // Icon centred against the text box so the mark sits on the text line.
        s.addImage({ data: ICONS[col.icon], x: x + 0.42, y: y + 0.175, w: 0.2, h: 0.2 });
        s.addText(it, {
          x: x + 0.75,
          y,
          w: w - 1.15,
          h: 0.55,
          fontFace: F.body,
          fontSize: 12.5,
          color: i === 1 ? C.text : C.muted,
          lineSpacing: 17,
          margin: 0,
          valign: "middle",
        });
      });
    });
    footer(s);
    s.addNotes("Two-column comparison. The tinted card is the recommendation — only ever tint one side.");
  }

  /* ==================================================== 12 — TEAM (light) */
  {
    const s = lightSlide();
    heading(s, "Team", "Who's driving this");

    const team = [
      ["AB", "First Last", "Chief Executive Officer", C.blue],
      ["CD", "First Last", "Chief Technology Officer", C.mint],
      ["EF", "First Last", "VP, Product", C.amber],
      ["GH", "First Last", "VP, Data Engineering", C.blue],
    ];
    const gap = 0.4;
    const cw = (CW - gap * 3) / 4;
    team.forEach(([initials, name, role, col], i) => {
      const x = M + i * (cw + gap);
      card(s, x, 2.25, cw, 4.05, { fill: C.paper, line: "none", shadow: false });
      const d = 1.7;
      const cx = x + (cw - d) / 2;
      s.addShape(pres.ShapeType.ellipse, {
        x: cx,
        y: 2.75,
        w: d,
        h: d,
        fill: { color: C.white },
        line: { color: col, width: 2 },
      });
      s.addText(initials, {
        x: cx,
        y: 2.75,
        w: d,
        h: d,
        fontFace: F.head,
        fontSize: 32,
        bold: true,
        color: col,
        align: "center",
        valign: "middle",
        margin: 0,
      });
      s.addText(name, {
        x: x + 0.15,
        y: 4.75,
        w: cw - 0.3,
        h: 0.34,
        fontFace: F.head,
        fontSize: 16,
        bold: true,
        color: C.text,
        align: "center",
        margin: 0,
      });
      s.addText(role, {
        x: x + 0.15,
        y: 5.12,
        w: cw - 0.3,
        h: 0.6,
        fontFace: F.body,
        fontSize: 12,
        color: C.muted,
        align: "center",
        lineSpacing: 16,
        margin: 0,
      });
    });
    footer(s);
    s.addNotes("Team layout. Replace the initial circles with cropped headshots at the same 1.5 inch diameter.");
  }

  /* =================================================== 13 — QUOTE (dark) */
  {
    const s = darkSlide();
    s.addImage({ data: DOTS_DARK, x: 10.6, y: 4.8, w: 3.2, h: 3.2 });
    chip(s, M, 1.65, 0.8, ICONS.quote, C.inkLift);

    s.addText(CONTENT.mission, {
      x: M,
      y: 2.85,
      w: 10.2,
      h: 2.4,
      fontFace: F.head,
      fontSize: 30,
      bold: true,
      color: C.white,
      charSpacing: -0.6,
      lineSpacing: 42,
      margin: 0,
      valign: "top",
    });
    s.addText(CONTENT.company, {
      x: M,
      y: 5.5,
      w: 8,
      h: 0.3,
      fontFace: F.head,
      fontSize: 13,
      bold: true,
      color: C.mint,
      margin: 0,
    });
    s.addText("Mission statement", {
      x: M,
      y: 5.82,
      w: 8,
      h: 0.3,
      fontFace: F.body,
      fontSize: 12,
      color: C.onDarkMuted,
      margin: 0,
    });
    footer(s, true);
    s.addNotes("Quote / statement slide. Keep it under 30 words so the type can stay large.");
  }

  /* =================================================== 14 — TABLE (light) */
  {
    const s = lightSlide();
    heading(s, "Detail", "Portfolio at a glance");

    const head = ["Brand", "Category", "Audience", "Status", "Owner"];
    const body = [
      ["BeenVerified", "People search", "Consumer", "Scaling", "First Last"],
      ["Bumper", "Vehicle history", "Consumer", "Growth", "First Last"],
      ["Ownerly", "Home value", "Homeowner", "Growth", "First Last"],
      ["NeighborWho", "Property records", "Consumer", "Steady", "First Last"],
      ["MoneyBot5000", "Personal finance", "Consumer", "Early", "First Last"],
    ];

    const rows = [
      head.map((h) => ({
        text: h.toUpperCase(),
        options: {
          bold: true,
          color: C.white,
          fontSize: 10.5,
          fontFace: F.head,
          charSpacing: 1.2,
          fill: { color: C.ink },
          valign: "middle",
        },
      })),
      ...body.map((r, i) =>
        r.map((cell, j) => ({
          text: cell,
          options: {
            color: j === 0 ? C.text : C.muted,
            bold: j === 0,
            fontSize: 12,
            fontFace: j === 0 ? F.head : F.body,
            fill: { color: i % 2 ? C.paper : C.white },
            valign: "middle",
          },
        }))
      ),
    ];

    s.addTable(rows, {
      x: M,
      y: 2.25,
      w: CW,
      colW: [3.0, 2.6, 2.1, 1.9, 2.233],
      rowH: 0.52,
      border: { type: "solid", color: C.line, pt: 1 },
      margin: [0.06, 0.14, 0.06, 0.14],
    });
    s.addText(
      "Source: internal reporting. Replace with your own figures and cite the system of record.",
      {
        x: M,
        y: 5.6,
        w: CW,
        h: 0.3,
        fontFace: F.body,
        fontSize: 10,
        italic: true,
        color: C.muted,
        margin: 0,
      }
    );
    footer(s);
    s.addNotes("Native table. Header row uses the ink fill; body rows alternate white and paper.");
  }

  /* ============================================== 15 — STYLE GUIDE (light) */
  {
    const s = lightSlide();
    heading(s, "Brand system", "Palette and type scale");

    const swatches = [
      ["Ink", C.ink, C.white],
      ["Blue", C.blue, C.white],
      ["Mint", C.mint, C.ink],
      ["Amber", C.amber, C.ink],
      ["Paper", C.paper, C.ink],
      ["Line", C.line, C.ink],
    ];
    const gap = 0.22;
    const cw = (CW - gap * 5) / 6;
    swatches.forEach(([name, hex, fg], i) => {
      const x = M + i * (cw + gap);
      s.addShape(pres.ShapeType.roundRect, {
        x,
        y: 2.2,
        w: cw,
        h: 1.5,
        rectRadius: 0.1,
        fill: { color: hex },
        line: hex === C.paper || hex === C.line ? { color: C.line, width: 1 } : { type: "none" },
      });
      s.addText(name, {
        x: x + 0.16,
        y: 3.02,
        w: cw - 0.32,
        h: 0.26,
        fontFace: F.head,
        fontSize: 12,
        bold: true,
        color: fg,
        margin: 0,
      });
      s.addText(`#${hex}`, {
        x: x + 0.16,
        y: 3.28,
        w: cw - 0.32,
        h: 0.26,
        fontFace: F.body,
        fontSize: 10,
        color: fg,
        margin: 0,
      });
    });

    const scale = [
      [`Headline — ${F.head} Bold ${S.hero}pt`, S.hero > 24 ? 24 : S.hero, true, C.text],
      [`Slide title — ${F.head} Bold ${S.title}pt`, 20, true, C.text],
      [`Section header — ${F.head} Bold ${S.header}pt`, 15, true, C.text],
      [`Body copy — ${F.body} Regular ${S.body}pt`, 13, false, C.muted],
      [`Caption — ${F.body} Regular ${S.caption}pt`, 11, false, C.muted],
    ];
    s.addText("TYPE SCALE", {
      x: M,
      y: 3.95,
      w: 5.6,
      h: 0.28,
      fontFace: F.head,
      fontSize: 10,
      bold: true,
      charSpacing: 1.8,
      color: C.blue,
      margin: 0,
    });
    scale.forEach(([label, size, bold, col], i) => {
      s.addText(label, {
        x: M,
        y: 4.35 + i * 0.44,
        w: 6.4,
        h: 0.4,
        fontFace: bold ? F.head : F.body,
        fontSize: size,
        bold,
        color: col,
        margin: 0,
        valign: "middle",
      });
    });

    card(s, 7.6, 3.9, CW - 6.85, 2.65, { fill: C.paper, line: "none", shadow: false });
    s.addText("USAGE", {
      x: 7.95,
      y: 4.12,
      w: 4.3,
      h: 0.28,
      fontFace: F.head,
      fontSize: 10,
      bold: true,
      charSpacing: 1.8,
      color: C.blue,
      margin: 0,
    });
    s.addText(
      [
        { text: "Ink carries the dark slides: cover, section, quote, closing.", options: { bullet: true, breakLine: true } },
        { text: "Blue is the working accent for kickers, numbers and charts.", options: { bullet: true, breakLine: true } },
        { text: "Mint is the sharp accent — one moment per slide.", options: { bullet: true, breakLine: true } },
        { text: "Amber is for data only, never body text.", options: { bullet: true, breakLine: true } },
        { text: "Keep 0.75in margins and 0.3in between blocks.", options: { bullet: true } },
      ],
      {
        x: 7.95,
        y: 4.45,
        w: 4.4,
        h: 1.95,
        fontFace: F.body,
        fontSize: 10.5,
        color: C.muted,
        lineSpacing: 14,
        paraSpaceAfter: 5,
        margin: 0,
        valign: "top", // otherwise the block centres and rides over the label
      }
    );
    footer(s);
    s.addNotes("Reference slide. Delete it before sending a deck externally, or keep it as the last page of an internal template.");
  }

  /* ================================================= 16 — CLOSING (dark) */
  {
    const s = darkSlide();
    s.addImage({ data: DOTS_DARK, x: 9.9, y: 4.0, w: 3.8, h: 3.8 });

    s.addText(
      [
        { text: "Thank ", options: { color: C.white } },
        { text: "you", options: { color: C.mint } },
      ],
      {
        x: M,
        y: 2.35,
        w: 8,
        h: 1.2,
        fontFace: F.head,
        fontSize: S.hero,
        bold: true,
        charSpacing: -1.2,
        margin: 0,
        valign: "middle",
      }
    );
    s.addText("Questions, or want the underlying data? Get in touch.", {
      x: M,
      y: 3.62,
      w: 7.2,
      h: 0.5,
      fontFace: F.body,
      fontSize: 15,
      color: C.onDarkMuted,
      margin: 0,
    });

    const contacts = [
      ["globe", CONTENT.site],
      ["mail", "hello@ltvco.com"],
    ];
    contacts.forEach(([ic, label], i) => {
      const y = 4.5 + i * 0.78;
      chip(s, M, y, 0.54, ICONS[ic], C.inkLift);
      s.addText(label, {
        x: M + 0.78,
        y,
        w: 5,
        h: 0.54,
        fontFace: F.body,
        fontSize: 14,
        color: C.white,
        margin: 0,
        valign: "middle",
      });
    });

    s.addText(CONTENT.company.toUpperCase(), {
      x: M,
      y: H - 0.7,
      w: 6,
      h: 0.3,
      fontFace: F.head,
      fontSize: 9.5,
      bold: true,
      charSpacing: 2.4,
      color: C.onDarkMuted,
      margin: 0,
    });
    s.addNotes("Closing slide. Update the contact lines; the dark treatment bookends the cover.");
  }

  const out = path.join(__dirname, "LTV-Presentation-Boilerplate.pptx");
  await pres.writeFile({ fileName: out });
  console.log("wrote", out);
}

build().catch((e) => {
  console.error(e);
  process.exit(1);
});
