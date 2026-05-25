import { jsPDF } from "jspdf";
import defaultLogo from "../../assets/images/LOGO.png";

// ─────────────────────────────────────────────────────────────
// UNIT SYSTEM
// All layout values are in mm (jsPDF coordinate space).
// Font sizes are in pt  (jsPDF setFontSize uses pt).
// Conversion: px × 0.2646 = mm   |   px × 0.75 = pt
//
// Key reference (from HTML preview):
//   A4 794px wide  = 210mm
//   margin 68px    = 18mm
//   28px title     = 21pt
//   15px section   = 11.25pt → 11pt
//   13px body      = 9.75pt  → 10pt
//   11px small     = 8.25pt  → 8pt
//   10px tiny      = 7.5pt
//   8px label      = 6pt
//   gap 8px        = 2.1mm
//   gold stripe 12px+4px = 3.2mm + 1.1mm
//   KPI card 100px = 26.5mm
//   accent bar 3px = 0.8mm
//   conf bar 9px   = 2.4mm
//   table row 30px = 7.9mm
//   bullet dot 6px = 1.6mm diameter → r=0.8mm
//   section bar 3×18px = 0.8mm × 4.8mm
// ─────────────────────────────────────────────────────────────

const C = {
  GOLD:          [212, 175,  55],
  GOLD_DARK:     [184, 134,  11],
  BLUE_BG:       [230, 241, 251],
  BLUE_TEXT:     [ 24,  95, 165],
  GREEN_BG:      [234, 243, 222],
  GREEN_TEXT:    [ 59, 109,  17],
  GREEN_FILL:    [ 29, 158, 117],
  AMBER_BG:      [250, 238, 218],
  AMBER_TEXT:    [133,  79,  11],
  AMBER_FILL:    [186, 117,  23],
  RED_BG:        [252, 235, 235],
  RED_TEXT:      [163,  45,  45],
  RED_FILL:      [226,  75,  74],
  BG_SECONDARY:  [245, 244, 240],
  BG_TERTIARY:   [241, 239, 232],
  TEXT_PRIMARY:  [ 33,  33,  33],
  TEXT_SECONDARY:[117, 117, 117],
  TEXT_TERTIARY: [160, 158, 150],
  BORDER:        [220, 218, 210],
  WHITE:         [255, 255, 255],
};

// pt font sizes (px × 0.75)
const F = {
  TITLE:   21,    // 28px
  SECTION: 11,    // 15px
  BODY:    10,    // 13px
  SMALL:   8,     // 11px  ← bullets, table cells, sub-labels
  LABEL:   6,     // 8px   ← box headers, table col headers
  TINY:    7.5,   // 10px  ← footer
};

// line-height in mm  (px * lh_ratio * 0.2646)
// body 13px * 1.7 = 22.1px * 0.2646 = 5.85mm → use 5.5
// small 11px * 1.5 = 16.5px * 0.2646 = 4.37mm → use 4.5
// bullet uses slightly larger leading to avoid overlap with separators
const LH = { BODY: 5.5, SMALL: 4.5, BULLET: 5.4 };

// spacing in mm (px × 0.2646)
const S = {
  GAP:   2.1,   //  8px gap between cards/cols
  XS:    1.1,   //  4px
  SM:    1.6,   //  6px
  MD:    2.6,   // 10px
  LG:    3.2,   // 12px
  XL:    4.2,   // 16px
  XXL:   6.3,   // 24px
};


const formatValue = (v) => {
  if (v == null) return "—";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(1);
  return String(v);
};

export async function exportReportPdf({
  // Accept a caller-provided image (dataURL/URL). Default to project's LOGO.svg asset.
  logo       = defaultLogo,
  title      = "Occupancy Report",
  subtitle   = "",
  filename   = "report.pdf",
  period     = "",
  reportType = "Occupancy",
  kpis       = [],
  aiInsight  = null,
  sections   = [],
} = {}) {

  const doc = new jsPDF("p", "mm", "a4");
  const W   = doc.internal.pageSize.getWidth();   // 210mm
  const H   = doc.internal.pageSize.getHeight();  // 297mm
  const M   = 18;       // 68px → 18mm
  const CW  = W - M * 2; // 174mm
  let y = M;

  // ── Primitives ─────────────────────────────────────────────

  const setFont = (size, weight = "normal", color = C.TEXT_PRIMARY) => {
    doc.setFont("helvetica", weight);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };

  const txt = (str, x, yPos, opts = {}) => {
    const {
      size   = F.BODY,
      weight = "normal",
      color  = C.TEXT_PRIMARY,
      align  = "left",
      lh     = LH.BODY,
    } = opts;
    setFont(size, weight, color);
    const lines = Array.isArray(str)
      ? str
      : doc.splitTextToSize(String(str), opts.maxW || 9999);
    lines.forEach((l, i) => doc.text(l, x, yPos + i * lh, { align }));
  };

  const rect = (x, yPos, w, h, fill, r = 0) => {
    doc.setFillColor(...fill);
    if (r > 0) doc.roundedRect(x, yPos, w, h, r, r, "F");
    else        doc.rect(x, yPos, w, h, "F");
  };

  const hline = (x1, yPos, x2, color = C.BORDER, lw = 0.2) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(lw);
    doc.line(x1, yPos, x2, yPos);
  };

  const wrap = (str, maxW) => doc.splitTextToSize(String(str), maxW);

  const fitTextSize = (text, maxW, maxSize, minSize = 7, weight = "normal") => {
    const value = String(text);
    let size = maxSize;
    while (size > minSize) {
      setFont(size, weight, C.TEXT_PRIMARY);
      if (doc.getTextWidth(value) <= maxW) break;
      size -= 0.5;
    }
    return size;
  };

  const ensureSpace = (needed) => {
    if (y + needed > H - 22) {
      doc.addPage();
      drawPageStripe();
      y = M + S.LG;
    }
  };

  // ── Page chrome ────────────────────────────────────────────

  // gold 12px=3.2mm + dark 4px=1.1mm
  const drawPageStripe = () => {
    rect(0, 0, W, 3.2, C.GOLD);
    rect(0, 3.2, W, 1.1, C.GOLD_DARK);
  };

  const drawFooter = (pageNum, total) => {
    hline(M, H - 14, W - M, C.BORDER, 0.2);
    txt("Lilycrest Analytics", M, H - 9, { size: F.TINY, color: C.TEXT_TERTIARY });
    txt(`Page ${pageNum} of ${total}`, W - M, H - 9, {
      size: F.TINY, color: C.TEXT_TERTIARY, align: "right",
    });
  };

  // Section title: 0.8mm bar (3px) × 4.8mm (18px), gap 2.1mm, 11pt text
  const sectionTitle = (label, accent = C.BLUE_TEXT) => {
    // taller accent bar and slightly lower text baseline to avoid clipping
    rect(M, y, 0.8, 6.0, accent, 0.4);
    txt(label, M + 3.2, y + 4.8, { size: F.SECTION, weight: "normal", color: C.TEXT_PRIMARY });
    // add a larger post-title gap so following blocks can't touch the title bar
    y += S.XL + S.XXL;  // XL + XXL = more breathing room
  };

  // ══════════════════════════════════════════════════════════
  // PAGE HEADER
  // ══════════════════════════════════════════════════════════

  drawPageStripe();
  // create a larger top gap so the header and first content don't collide with the stripe
  y = M + S.LG + S.MD;  // 18mm margin + LG + MD

  // load logo (accepts dataURL or asset URL). convert via canvas to PNG dataURL.
  const loadImageData = async (src) => {
    if (!src) return null;
    if (typeof src !== "string") return src; // already dataURL or image
    if (src.startsWith("data:")) return src;
    try {
      await new Promise((res, rej) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => {
          try {
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0);
            const data = canvas.toDataURL("image/png");
            // resolve with data via outer scope
            (loadImageData._result = data);
            res();
          } catch (e) { rej(e); }
        };
        img.onerror = rej;
        img.src = src;
      });
      return loadImageData._result || null;
    } catch (_) { return null; }
  };

  const logoData = await loadImageData(logo);
  // layout: logo at left, stacked title + subtitle to the right of logo
  const logoSize = 12; // mm
  const logoY = y - 6; // raise logo to avoid overlapping section dividers / KPI borders
  if (logoData) {
    try { doc.addImage(logoData, "PNG", M, logoY, logoSize, logoSize); } catch (_) {}
  }
  const titleX = logoData ? M + logoSize + 3.2 : M;

  // title — positioned above the subtitle and aligned to `titleX`
  const titleY = y - 1.2;
  txt(title, titleX, titleY, { size: F.TITLE - 2, weight: "bold", color: C.TEXT_PRIMARY });

  // badge: align vertically with the title baseline
  const badgeW = 19;   // ~72px
  const badgeX = W - M - badgeW;
  rect(badgeX, titleY - 1.6, badgeW, 5.3, C.BLUE_BG, 1.6);
  txt(reportType, badgeX + badgeW / 2, titleY + 1.8, {
    size: F.LABEL + 1, weight: "bold", color: C.BLUE_TEXT, align: "center",
  });

  // subtitle/meta: render under the title and aligned to titleX (not at left margin)
  const meta = [subtitle, period].filter(Boolean).join("  ·  ");
  if (meta) {
    const metaY = titleY + 6.0; // mm below title
    txt(meta, titleX, metaY, { size: F.SMALL, color: C.TEXT_SECONDARY });
    y = metaY + S.MD;
  } else {
    y += S.LG + S.SM;
  }

  // 1px divider = 0.265mm → use 0.3
  hline(M, y, W - M, C.BORDER, 0.3);
  y += S.LG;

  // ══════════════════════════════════════════════════════════
  // KPI CARDS
  // HTML: padding 12px 14px, label 13px, value 28px, sub 11px
  // card height ~100px = 26.5mm; accent bar 3px=0.8mm × full height
  // gap 8px = 2.1mm between cards
  // ══════════════════════════════════════════════════════════

  if (kpis.length > 0) {
    sectionTitle("Key metrics", C.BLUE_TEXT);

    const estimateKpiCols = (items) => {
      const maxChars = items.reduce((max, item) => {
        return Math.max(
          max,
          String(item.label ?? "").length,
          String(formatValue(item.value)).length,
          String(item.sub ?? "").length,
        );
      }, 0);

      if (items.length <= 2) return items.length;
      if (maxChars > 48) return 2;
      if (maxChars > 26) return 3;
      return 4;
    };

    const COLS   = Math.max(1, Math.min(kpis.length, estimateKpiCols(kpis)));
    const GAP    = S.GAP;           // 8px = 2.1mm
    const CARD_W = (CW - GAP * (COLS - 1)) / COLS;
    const CARD_X = 3.8;
    const CARD_TXT_W = CARD_W - CARD_X - 1.9;
    const ACCENTS = [C.BLUE_TEXT, C.GREEN_FILL, C.AMBER_FILL, C.RED_FILL];

    const cardLayouts = kpis.map((kpi) => {
      const labelLines = wrap(kpi.label ?? "", CARD_TXT_W);
      const subLines = kpi.sub ? wrap(kpi.sub, CARD_TXT_W) : [];
      const valueText = formatValue(kpi.value);
      const valueSize = fitTextSize(valueText, CARD_TXT_W, kpi.highlight ? 18 : 16, 10.5, "bold");
      const labelSize = labelLines.length > 1 ? 7 : 8;
      const valueH = valueSize >= 17 ? 7.4 : valueSize >= 14 ? 6.6 : 5.8;
      const subH = subLines.length > 0 ? 0.8 + subLines.length * LH.SMALL : 0;
      const cardH = Math.max(23.5, 4.2 + labelLines.length * LH.SMALL + 1.0 + valueH + subH + 2.0);

      return { labelLines, subLines, valueText, valueSize, labelSize, valueH, cardH };
    });

    const rowCount = Math.ceil(kpis.length / COLS);
    const rowHeights = Array.from({ length: rowCount }, (_, row) => {
      const start = row * COLS;
      return Math.max(...cardLayouts.slice(start, start + COLS).map((layout) => layout.cardH));
    });

    // ensure room for KPI grid, otherwise start a new page
    ensureSpace(rowHeights.reduce((sum, rowH) => sum + rowH, 0) + GAP * (rowHeights.length - 1) + S.XL + S.MD);

    kpis.forEach((kpi, i) => {
      const col    = i % COLS;
      const row    = Math.floor(i / COLS);
      const cx     = M + col * (CARD_W + GAP);
      const cy     = y + rowHeights.slice(0, row).reduce((sum, rowH) => sum + rowH, 0) + row * GAP;
      const layout  = cardLayouts[i];
      const accent = ACCENTS[i % ACCENTS.length];
      const bg     = kpi.highlight ? C.BLUE_BG    : C.BG_SECONDARY;
      const valC   = kpi.highlight ? C.BLUE_TEXT  : C.TEXT_PRIMARY;
      const lblC   = kpi.highlight ? C.BLUE_TEXT  : C.TEXT_SECONDARY;
      const subC   = kpi.highlight ? C.BLUE_TEXT  : C.TEXT_TERTIARY;

      // card bg, border-radius 5px=1.3mm
      rect(cx, cy, CARD_W, layout.cardH, bg, 1.3);
      // accent bar 3px=0.8mm wide, full height
      rect(cx, cy, 0.8, layout.cardH, accent, 0.4);

      // label: allow wrapping and smaller type when needed
      txt(layout.labelLines, cx + CARD_X, cy + 4.2, {
        size: layout.labelSize,
        color: lblC,
        lh: LH.SMALL,
      });

      const labelBlockH = layout.labelLines.length * LH.SMALL;
      const valueY = cy + 4.2 + labelBlockH + 0.9;

      // value: shrink to fit inside the card instead of colliding with subtext
      txt(layout.valueText, cx + CARD_X, valueY, {
        size: layout.valueSize,
        weight: "bold",
        color: valC,
        lh: 5.2,
      });

      if (layout.subLines.length > 0) {
        const valueBlockH = layout.valueH;
        const subY = valueY + valueBlockH + 0.7;
        txt(layout.subLines, cx + CARD_X, subY, { size: F.SMALL, color: subC, lh: LH.SMALL });
      }
    });

    y += rowHeights.reduce((sum, rowH) => sum + rowH, 0) + GAP * (rowHeights.length - 1) + S.XL + S.MD;
  }

  // ══════════════════════════════════════════════════════════
  // AI INSIGHT BLOCK
  // ══════════════════════════════════════════════════════════

  if (aiInsight) {
    // ensure there's a comfortable gap before the AI block so it doesn't collide
    // bump required space on first-page AI to avoid title/line overlap
    ensureSpace(50);
    sectionTitle("AI occupancy summary", C.BLUE_TEXT);

    // headline 15px → 11pt bold
    if (aiInsight.headline) {
      const lines = wrap(aiInsight.headline, CW);
      txt(lines, M, y, { size: F.SECTION, weight: "bold", color: C.TEXT_PRIMARY, lh: 5.3 });
      y += lines.length * 5.3 + S.SM;
    }

    // summary 13px → 10pt muted, lh 1.7
    if (aiInsight.summary) {
      const lines = wrap(aiInsight.summary, CW);
      txt(lines, M, y, { size: F.BODY, color: C.TEXT_SECONDARY, lh: LH.BODY });
      y += lines.length * LH.BODY + S.LG + S.SM; // extra small gap before divider
    }

    // divider (1px = 0.265mm → 0.3)
    hline(M, y, W - M, C.BORDER, 0.3);
    y += S.MD + S.SM;

    // confidence row: 13px labels
    const conf      = aiInsight.confidence || 0;
    const confLabel = aiInsight.confidenceLabel || `${conf}%`;
    txt("Confidence", M, y, { size: F.BODY, color: C.TEXT_SECONDARY });
    txt(confLabel, W - M, y, { size: F.BODY, weight: "bold", color: C.GREEN_TEXT, align: "right" });
    y += S.SM;

    // bar 9px = 2.4mm tall, pill (r = half height = 1.2mm)
    rect(M, y, CW, 2.4, C.BG_SECONDARY, 1.2);
    if (conf > 0) rect(M, y, CW * (conf / 100), 2.4, C.GREEN_FILL, 1.2);
    y += 2.4 + S.LG;

    hline(M, y, W - M, C.BORDER, 0.3);
    y += S.LG;

    // ── 2-col boxes ─────────────────────────────────────────
    // HTML: grid gap 8px=2.1mm, each col = (CW - 2.1) / 2
    const CGAP         = S.GAP;
    const half         = (CW - CGAP) / 2;
    const colR         = M + half + CGAP;
    const standoutItems = aiInsight.standout || [];
    const watchItems    = aiInsight.watch    || [];

    // Item container padding and wrap width inside each AI card
    const AI_PAD_X = 4.0;
    const AI_PAD_Y = 2.2;
    const AI_LINE_GAP = 0.8;
    const AI_TEXT_W = half - AI_PAD_X * 2 - 2.6;

    // Item height: wrapped lines * LH.BULLET + balanced vertical padding
    const iH = (item, maxW) =>
      wrap(item, maxW).length * LH.BULLET + AI_PAD_Y * 2 + AI_LINE_GAP;

    // Box height: top-bar 0.8mm + header row 8mm + items
    const standoutH = 0.8 + S.XL + standoutItems.reduce((a, it) => a + iH(it, AI_TEXT_W), 0);
    const watchH    = 0.8 + S.XL + watchItems.reduce((a, it) => a + iH(it, AI_TEXT_W), 0);
    const twoColH   = Math.max(standoutH, watchH);

    ensureSpace(twoColH + S.LG);

    // standout box: #F5F4F0, gray top accent
    rect(M, y, half, twoColH, C.BG_SECONDARY, 1.3);
    rect(M, y, half, 0.8, C.TEXT_TERTIARY, 0.4);
    // header label: 8px → 6pt bold, padding-top 8px=2.1mm from top of box
    txt("WHAT STANDS OUT", M + 3.2, y + 5.5, {
      size: F.LABEL, weight: "bold", color: C.TEXT_TERTIARY, lh: LH.SMALL,
    });
    let leftY = y + 0.8 + S.XL + AI_PAD_Y;  // top-bar + header height + inner top padding
    standoutItems.forEach((item, idx) => {
      if (idx > 0) hline(M + AI_PAD_X, leftY - AI_LINE_GAP, M + half - AI_PAD_X, C.BORDER, 0.2);
      const lines = wrap(item, AI_TEXT_W);
      doc.setFillColor(...C.TEXT_TERTIARY);
      // keep bullet and text visually attached as one item
      doc.circle(M + AI_PAD_X - 0.1, leftY + 1.0, 0.8, "F");
      txt(lines, M + AI_PAD_X + 1.2, leftY + AI_PAD_Y, { size: F.SMALL, color: C.TEXT_SECONDARY, lh: LH.BULLET });
      leftY += lines.length * LH.BULLET + AI_PAD_Y * 2 + AI_LINE_GAP;
    });

    // watch box: #FAEEDA, amber top accent
    rect(colR, y, half, twoColH, C.AMBER_BG, 1.3);
    rect(colR, y, half, 0.8, C.AMBER_FILL, 0.4);
    txt("THINGS TO WATCH", colR + 3.2, y + 5.5, {
      size: F.LABEL, weight: "bold", color: C.AMBER_TEXT, lh: LH.SMALL,
    });
    let rightY = y + 0.8 + S.XL + AI_PAD_Y;
    watchItems.forEach((item, idx) => {
      if (idx > 0) hline(colR + AI_PAD_X, rightY - AI_LINE_GAP, colR + half - AI_PAD_X, C.AMBER_FILL, 0.2);
      const lines = wrap(item, AI_TEXT_W);
      doc.setFillColor(...C.AMBER_FILL);
      doc.circle(colR + AI_PAD_X - 0.1, rightY + 1.0, 0.8, "F");
      txt(lines, colR + AI_PAD_X + 1.2, rightY + AI_PAD_Y, { size: F.SMALL, color: C.TEXT_SECONDARY, lh: LH.BULLET });
      rightY += lines.length * LH.BULLET + AI_PAD_Y * 2 + AI_LINE_GAP;
    });

    y += twoColH + S.GAP;  // 8px gap below 2-col before next box

    // ── next steps: full width green box ────────────────────
    const steps  = aiInsight.nextSteps || [];
    // use the same text-wrap width as rendering to compute box height
    const STEPS_TEXT_W = CW - AI_PAD_X * 2 - 2.6;
    const stepsH = 0.8 + S.XL + steps.reduce((a, s) => a + iH(s, STEPS_TEXT_W), 0);

    ensureSpace(stepsH + S.LG);
    rect(M, y, CW, stepsH, C.GREEN_BG, 1.3);
    rect(M, y, CW, 0.8, C.GREEN_FILL, 0.4);
    txt("WHAT TO DO NEXT", M + 3.2, y + 5.5, {
      size: F.LABEL, weight: "bold", color: C.GREEN_TEXT, lh: LH.SMALL,
    });
    let stepsY = y + 0.8 + S.XL + AI_PAD_Y;
    steps.forEach((step, idx) => {
      if (idx > 0) hline(M + AI_PAD_X, stepsY - AI_LINE_GAP, W - M - AI_PAD_X, C.GREEN_FILL, 0.2);
      const lines = wrap(step, CW - AI_PAD_X * 2 - 2.6);
      doc.setFillColor(...C.GREEN_FILL);
      doc.circle(M + AI_PAD_X - 0.1, stepsY + 1.0, 0.8, "F");
      txt(lines, M + AI_PAD_X + 1.2, stepsY + AI_PAD_Y, { size: F.SMALL, color: C.TEXT_SECONDARY, lh: LH.BULLET });
      stepsY += lines.length * LH.BULLET + AI_PAD_Y * 2 + AI_LINE_GAP;
    });
    y = stepsY + S.LG;
  }

  // ══════════════════════════════════════════════════════════
  // SECTIONS — first on new page, rest flow with ensureSpace
  // ══════════════════════════════════════════════════════════

  sections.forEach((section, sIdx) => {
    if (sIdx === 0) {
      doc.addPage();
      drawPageStripe();
      y = M + S.LG;
    } else {
      ensureSpace(50);
      y += S.XL + S.SM;
    }

    sectionTitle(section.title || "", C.BLUE_TEXT);

    if (section.description) {
      const lines = wrap(section.description, CW);
      txt(lines, M, y, { size: F.SMALL, color: C.TEXT_SECONDARY, lh: LH.SMALL });
      y += lines.length * LH.SMALL + S.SM;
    }

    if (
      (section.type === "table" || section.type === "inventory") &&
      section.headers && section.rows
    ) {
      y = renderTable(section, y);
    }
  });

  // ── renderTable ────────────────────────────────────────────
  // HTML thead: #F1EFE8, 8px bold label, DCDAD2 borders top+bottom
  // HTML tbody: alternating #F5F4F0, 11px cells, 0.5px separator
  // padding: 8px 6px → 2.1mm top/bottom, 1.6mm left
  // ROW_H: content 11px + padding 8px*2 = 27px → 7.1mm → use 7.9mm

  function renderTable(section, startY) {
    let ty      = startY;
    const hdrs  = section.headers;
    const rows  = section.rows;
    const colWidths = section.colWidths || hdrs.map(() => CW / hdrs.length);

    const colX = [];
    let acc = M;
    colWidths.forEach((w) => { colX.push(acc); acc += w; });

    // base row height and paddings — increased to avoid collisions with borders
    const ROW_H     = 9.5;  // increase header/base row height
    const ROW_V_PAD = 3.0;  // vertical padding inside rows (top+bottom)
    const CELL_P    = 1.8;  // left/right cell padding

    // header: BG_TERTIARY #F1EFE8, top+bottom 0.3pt border
    rect(M, ty, CW, ROW_H, C.BG_TERTIARY);
    hline(M, ty,          W - M, C.BORDER, 0.3);
    hline(M, ty + ROW_H,  W - M, C.BORDER, 0.3);
    hdrs.forEach((h, i) => {
      // header text placed with slightly more top offset
      const headerY = ty + ROW_H / 2 + 1.2;
      txt(h, colX[i] + CELL_P, headerY, {
        size: F.LABEL, weight: "bold", color: C.TEXT_TERTIARY,
      });
    });
    ty += ROW_H;

    rows.forEach((row, rIdx) => {
      const cellTexts = hdrs.map((h) => {
        const v = row[h];
        return v == null ? "—" : String(v);
      });

      // wrap each cell at colWidth - 2*padding
      const wrapped   = cellTexts.map((ct, i) => wrap(ct, colWidths[i] - CELL_P * 2));
      const lineCount = Math.max(...wrapped.map((wc) => wc.length));
      // rowH: ensure enough vertical padding (top + bottom)
      const rowH      = Math.max(ROW_H, lineCount * LH.SMALL + ROW_V_PAD * 2);

      ensureSpace(rowH + 2);

      // alternating row bg (even = #F5F4F0)
      if (rIdx % 2 === 0) rect(M, ty, CW, rowH, C.BG_SECONDARY);

      // separator at bottom of row
      hline(M, ty + rowH, W - M, C.BORDER, 0.2);

      hdrs.forEach((h, i) => {
        const val  = row[h];
        const cx   = colX[i] + CELL_P;
        const midY = ty + rowH / 2;

        // occupancy: bold colored text (green/amber/red)
        if (h.toLowerCase() === "occupancy" && typeof val === "number") {
          const color = val >= 90 ? C.GREEN_TEXT
                      : val >= 75 ? C.AMBER_TEXT
                      : C.RED_TEXT;
          txt(`${val}%`, cx, midY, { size: F.SMALL, weight: "bold", color });
          return;
        }

        // status pill: ramp-matched bg+text, radius = pillH/2 (true pill)
        if (h.toLowerCase() === "status" && typeof val === "string") {
          const vLow  = val.toLowerCase();
          const pillC = vLow === "full"  || vLow === "good"
                          ? [C.GREEN_BG,    C.GREEN_TEXT]
                      : vLow === "watch"
                          ? [C.AMBER_BG,    C.AMBER_TEXT]
                      : vLow === "low"
                          ? [C.RED_BG,      C.RED_TEXT]
                          : [C.BG_TERTIARY, C.TEXT_SECONDARY];

          setFont(F.SMALL, "bold", pillC[1]);
          const tW    = doc.getTextWidth(val);
          const pH    = 4.2;               // pill height 4.2mm ≈ 16px
          const pW    = Math.min(tW + 5.3, colWidths[i] - CELL_P * 2);
          const pX    = colX[i] + CELL_P;
          const pY    = ty + rowH / 2 - pH / 2;
          rect(pX, pY, pW, pH, pillC[0], pH / 2);
          txt(val, pX + pW / 2, pY + pH / 2 + 0.8, {
            size: F.SMALL, weight: "bold", color: pillC[1], align: "center",
          });
          return;
        }

        // default: place lines starting at top padding to avoid overlap
        const isFirst = i === 0;
        const lines   = wrap(val == null ? "—" : String(val), colWidths[i] - CELL_P * 2);
        const lineStartY = ty + ROW_V_PAD + 0.6; // small offset to avoid top border
        txt(lines, cx, lineStartY, {
          size: F.SMALL,
          color: isFirst ? C.TEXT_PRIMARY : C.TEXT_SECONDARY,
          lh: LH.SMALL,
        });
      });

      ty += rowH;
    });

    return ty;
  }

  // ══════════════════════════════════════════════════════════
  // FOOTERS
  // ══════════════════════════════════════════════════════════

  const total = doc.internal.getNumberOfPages();
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    drawFooter(p, total);
  }

  doc.save(filename);
}