import { jsPDF } from "jspdf";
import logoUrl from "../../assets/images/LOGO.svg?url";
// ── Design Tokens ─────────────────────────────────────────────
const C = {
  GOLD:       [212, 175, 55],
  GOLD_DARK:  [184, 134, 11],
  BLUE_BG:      [230, 241, 251],
  BLUE_TEXT:    [24,  95,  165],
  BLUE_BORDER:  [55,  138, 221],
  GREEN_BG:     [234, 243, 222],
  GREEN_TEXT:   [59,  109, 17],
  GREEN_FILL:   [29,  158, 117],
  AMBER_BG:     [250, 238, 218],
  AMBER_TEXT:   [133, 79,  11],
  AMBER_FILL:   [186, 117, 23],
  RED_BG:       [252, 235, 235],
  RED_TEXT:     [163, 45,  45],
  RED_FILL:     [226, 75,  74],
  BG_PRIMARY:   [255, 255, 255],
  BG_SECONDARY: [245, 244, 240],
  BG_TERTIARY:  [241, 239, 232],
  TEXT_PRIMARY:  [33,  33,  33],
  TEXT_SECONDARY:[117, 117, 117],
  TEXT_TERTIARY: [160, 158, 150],
  BORDER:        [220, 218, 210],
  WHITE:         [255, 255, 255],
};

const formatValue = (value) => {
  if (value == null) return "—";
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toFixed(1);
  }
  return String(value);
};

function imageUrlToBase64(url) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = url;

    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width || 100;
      canvas.height = img.height || 100;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);

      resolve(canvas.toDataURL("image/png"));
    };
  });
}

export function exportReportPdf({
  logo       = null,     // optional logo URL for header
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
  const W   = doc.internal.pageSize.getWidth();
  const H   = doc.internal.pageSize.getHeight();
  const M   = 18;
  const CW  = W - M * 2;

  let y = M;

  // ── Helpers ────────────────────────────────────────────────

  const setFont = (size, weight = "normal", color = C.TEXT_PRIMARY) => {
    doc.setFont("helvetica", weight);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };

  const txt = (str, x, yPos, opts = {}) => {
    const { size = 9, weight = "normal", color = C.TEXT_PRIMARY, align = "left" } = opts;
    setFont(size, weight, color);
    const lines = Array.isArray(str)
      ? str
      : doc.splitTextToSize(String(str), opts.maxW || 9999);
    lines.forEach((l, i) =>
      doc.text(l, x, yPos + i * (opts.lh || 5.5), { align })
    );
  };

  const rect = (x, yPos, w, h, fill, r = 0) => {
    doc.setFillColor(...fill);
    if (r > 0) doc.roundedRect(x, yPos, w, h, r, r, "F");
    else        doc.rect(x, yPos, w, h, "F");
  };

  const hline = (x1, yPos, x2, color = C.BORDER, lw = 0.3) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(lw);
    doc.line(x1, yPos, x2, yPos);
  };

  const wrap = (str, maxW) => doc.splitTextToSize(String(str), maxW);

  const fitFontSize = (text, maxWidth, { start = 14, min = 8, weight = "bold" } = {}) => {
    const value = String(text ?? "");
    let size = start;
    while (size > min) {
      setFont(size, weight, C.TEXT_PRIMARY);
      if (doc.getTextWidth(value) <= maxWidth) break;
      size -= 0.5;
    }
    return Math.max(size, min);
  };

  const ensureSpace = (needed) => {
    if (y + needed > H - 24) {
      doc.addPage();
      drawPageStripe();
      y = M + 8;
    }
  };

  const drawPageStripe = () => {
    rect(0, 0, W, 3, C.GOLD);
    rect(0, 3, W, 1, C.GOLD_DARK);
  };

  const drawFooter = (pageNum, total) => {
    hline(M, H - 16, W - M, C.BORDER, 0.2);
    txt("Lilycrest Analytics", M, H - 10, { size: 7.5, color: C.TEXT_TERTIARY });
    txt(`Page ${pageNum} of ${total}`, W - M, H - 10, {
      size: 7.5, color: C.TEXT_TERTIARY, align: "right",
    });
  };

  // ── Section label helper ───────────────────────────────────
  const sectionLabel = (label) => {
    txt(label.toUpperCase(), M, y, {
      size: 8, weight: "bold", color: C.TEXT_TERTIARY,
    });
    y += 6;
  };

  // ══════════════════════════════════════════════════════════
  // PAGE 1 HEADER
  // ══════════════════════════════════════════════════════════

  drawPageStripe();
  y = M + 8;

  // LOGO
  const logoSize = 10;
  if (logo) {
    doc.addImage(logo, "PNG", M, y - 1, logoSize, logoSize);
  }

  // Report title
 const titleX = logo ? M + 14 : M;
 const badgeW = 30;
 const titleMaxW = W - M - badgeW - titleX - 6;
 const titleSize = fitFontSize(title, titleMaxW, { start: 18, min: 12, weight: "bold" });

txt(title, titleX, y, {
  size: titleSize,
  weight: "bold",
  color: C.TEXT_PRIMARY,
  maxW: titleMaxW,
  lh: 5,
});

  // Badge
  const badgeX = W - M - badgeW;
  rect(badgeX, y - 5, badgeW, 7, C.BLUE_BG, 3);
  txt(reportType, badgeX + badgeW / 2, y, {
    size: 7, weight: "bold", color: C.BLUE_TEXT, align: "center",
  });

  y += 5.5;

  const meta = [subtitle, period].filter(Boolean).join("  ·  ");
  if (meta) {
    txt(meta, M, y, { size: 8, color: C.TEXT_SECONDARY });
    y += 5;
  }

  hline(M, y, W - M, C.BORDER, 0.4);
  y += 7;

  // ══════════════════════════════════════════════════════════
  // KPI CARDS
  // ══════════════════════════════════════════════════════════

  if (kpis.length > 0) {
    // "KEY METRICS" big label
    txt("KEY METRICS", M, y, { size: 11, weight: "bold", color: C.TEXT_PRIMARY });
    y += 7;

    const COLS   = Math.min(kpis.length, 4);
    const GAP    = 4;
    const CARD_W = (CW - GAP * (COLS - 1)) / COLS;
    const CARD_H = 30;

    kpis.forEach((kpi, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const cx  = M + col * (CARD_W + GAP);
      const cy  = y + row * (CARD_H + GAP);

      const bg   = kpi.highlight ? C.BLUE_BG    : C.BG_SECONDARY;
      const valC = kpi.highlight ? C.BLUE_TEXT   : C.TEXT_PRIMARY;
      const lblC = kpi.highlight ? C.BLUE_TEXT   : C.TEXT_SECONDARY;

      rect(cx, cy, CARD_W, CARD_H, bg, 3);
      const labelLines = wrap(kpi.label, CARD_W - 8);
      txt(labelLines, cx + 4, cy + 7, { size: 6.8, color: lblC, lh: 3.6 });

      const valueText = formatValue(kpi.value);
      const valueSize = fitFontSize(valueText, CARD_W - 8, { start: 16, min: 9.5, weight: "bold" });
      const valueY = cy + 7 + labelLines.length * 3.6 + 5;
      txt(valueText, cx + 4, valueY, {
        size: valueSize, weight: "bold", color: valC,
      });

      if (kpi.sub) {
        txt(kpi.sub, cx + 4, cy + CARD_H - 2.5, { size: 6.5, color: C.TEXT_TERTIARY });
      }
    });

    const rows = Math.ceil(kpis.length / COLS);
    y += rows * (CARD_H + GAP) + 7;
  }

  // ══════════════════════════════════════════════════════════
  // AI INSIGHT BLOCK
  // ══════════════════════════════════════════════════════════

  if (aiInsight) {

    // ── Section title
    txt(`AI ${String(reportType || "Report").toUpperCase()} SUMMARY`, M, y, {
      size: 11, weight: "bold", color: C.TEXT_PRIMARY,
    });
    y += 7;

    // ── Headline
    const headlineLines = wrap(aiInsight.headline || "", CW);
    txt(headlineLines, M, y, {
      size: 10, weight: "bold", color: C.TEXT_PRIMARY, lh: 5.2,
    });
    y += headlineLines.length * 5.2 + 4;

    // ── Summary
    const summaryLines = wrap(aiInsight.summary || "", CW);
    txt(summaryLines, M, y, {
      size: 8.5, color: C.TEXT_SECONDARY, lh: 4.8,
    });
    y += summaryLines.length * 4.8 + 6;

    // ── Confidence
    hline(M, y, W - M, C.BORDER, 0.2);
    y += 5;

    const conf      = aiInsight.confidence || 0;
    const confLabel = aiInsight.confidenceLabel || `${conf}%`;

    txt("Confidence", M, y, { size: 9, weight: "bold", color: C.TEXT_PRIMARY });
    txt(confLabel, W - M, y, {
      size: 9, weight: "bold", color: C.TEXT_PRIMARY, align: "right",
    });
    y += 4;
    rect(M, y, CW, 4, C.BG_SECONDARY, 2);
    if (conf > 0) rect(M, y, CW * (conf / 100), 4, C.GREEN_FILL, 2);
    y += 7;

    hline(M, y, W - M, C.BORDER, 0.2);
    y += 6;

    // ── 2-col: What stands out + Things to watch
    const LH  = 4.5;
    const PAD = 4;
    const half = (CW - 5) / 2;
    const colR = M + half + 5;

    const standoutItems = aiInsight.standout || [];
    const watchItems    = aiInsight.watch    || [];

    const standoutH = 8 + standoutItems.reduce((acc, item) =>
      acc + wrap(item, half - 12).length * LH + PAD, 0);
    const watchH = 8 + watchItems.reduce((acc, item) =>
      acc + wrap(item, half - 12).length * LH + PAD, 0);
    const twoColH = Math.max(standoutH, watchH);

    ensureSpace(twoColH + 6);

    // What stands out box
    rect(M, y, half, twoColH, C.BG_SECONDARY, 3);
    txt("WHAT STANDS OUT", M + 5, y + 7, {
      size: 7, weight: "bold", color: C.TEXT_TERTIARY,
    });
    let leftY = y + 10.5;
    standoutItems.forEach((item) => {
      const lines = wrap(item, half - 12);
      doc.setFillColor(...C.TEXT_TERTIARY);
      doc.circle(M + 5, leftY + 2.5, 1.2, "F");
      txt(lines, M + 9, leftY + 1, {
        size: 8, color: C.TEXT_SECONDARY, lh: LH,
      });
      leftY += lines.length * LH + PAD;
    });

    // Things to watch box
    rect(colR, y, half, twoColH, C.AMBER_BG, 3);
    txt("THINGS TO WATCH", colR + 5, y + 7, {
      size: 7, weight: "bold", color: C.TEXT_TERTIARY,
    });
    let rightY = y + 10.5;
    watchItems.forEach((item) => {
      const lines = wrap(item, half - 12);
      doc.setFillColor(...C.AMBER_FILL);
      doc.circle(colR + 5, rightY + 2.5, 1.2, "F");
      txt(lines, colR + 9, rightY + 1, {
        size: 8, color: C.TEXT_SECONDARY, lh: LH,
      });
      rightY += lines.length * LH + PAD;
    });

    y += twoColH + 6;

    // ── What to do next — full width box
    const steps  = aiInsight.nextSteps || [];
    const stepsH = 8 + steps.reduce((acc, step) =>
      acc + wrap(step, CW - 14).length * LH + PAD, 0);

    ensureSpace(stepsH + 4);
    rect(M, y, CW, stepsH, C.GREEN_BG, 3);
    txt("WHAT TO DO NEXT", M + 5, y + 7, {
      size: 7, weight: "bold", color: C.TEXT_TERTIARY,
    });
    let stepsY = y + 10.5;
    steps.forEach((step) => {
      const lines = wrap(step, CW - 14);
      doc.setFillColor(...C.GREEN_FILL);
      doc.circle(M + 5, stepsY + 2.5, 1.2, "F");
      txt(lines, M + 9, stepsY + 1, {
        size: 8, color: C.TEXT_SECONDARY, lh: LH,
      });
      stepsY += lines.length * LH + PAD;
    });
    y = stepsY + 6;
  }

  // ══════════════════════════════════════════════════════════
  // SECTIONS — always start on a new page, then flow naturally
  // ══════════════════════════════════════════════════════════

sections.forEach((section, sIdx) => {

  // estimate needed space before rendering section
  const estimatedHeight =
    20 +
    (section.rows?.length || 0) * 10;

  ensureSpace(estimatedHeight);

  if (sIdx > 0) {
    y += 6;
  }

    // Section title — big
    txt(section.title || "", M, y, {
      size: 11, weight: "bold", color: C.TEXT_PRIMARY,
    });
    y += 7;

    if (section.description) {
      const descLines = wrap(section.description, CW);
      txt(descLines, M, y, { size: 8, color: C.TEXT_SECONDARY, lh: 4.4 });
      y += descLines.length * 4.4 + 4;
    }

    if (
      (section.type === "table" || section.type === "inventory") &&
      section.headers &&
      section.rows
    ) {
      y = renderTable(section, y);
    }
  });

  // ── renderTable ────────────────────────────────────────────

  function renderTable(section, startY) {
    let ty = startY;
    const hdrs = section.headers;
    const rows = section.rows;

    const colWidths = section.colWidths
      ? section.colWidths
      : hdrs.map(() => CW / hdrs.length);

    const colX = [];
    let acc = M;
    colWidths.forEach((w) => { colX.push(acc); acc += w; });

    const ROW_H = 8;

    // Header row
    rect(M, ty, CW, ROW_H, C.BG_TERTIARY);
    hline(M, ty,          W - M, C.BORDER, 0.3);
    hline(M, ty + ROW_H,  W - M, C.BORDER, 0.3);
    hdrs.forEach((h, i) => {
      txt(h.toUpperCase(), colX[i] + 3, ty + 6, {
        size: 6.3, weight: "bold", color: C.TEXT_TERTIARY,
      });
    });
    ty += ROW_H;

    rows.forEach((row, rIdx) => {
      const cellTexts = hdrs.map((h) => {
        const v = row[h];
        return v == null ? "—" : String(v);
      });

      const wrappedCells = cellTexts.map((ct, i) =>
        wrap(ct, colWidths[i] - 6)
      );
      const lineCount = Math.max(...wrappedCells.map((wc) => wc.length));
      const rowH = Math.max(ROW_H, lineCount * 4.6 + 3.2);

      ensureSpace(rowH + 4);

      if (rIdx % 2 === 0) rect(M, ty, CW, rowH, C.BG_SECONDARY);
      hline(M, ty + rowH, W - M, C.BORDER, 0.2);

      hdrs.forEach((h, i) => {
        const val  = row[h];
        const cx   = colX[i] + 3;
        const midY = ty + rowH / 2 + 2;

       // Occupancy colored text
if (h.toLowerCase() === "occupancy" && typeof val === "number") {

  const occColor =
    val >= 90
      ? C.GREEN_TEXT
      : val >= 75
      ? C.AMBER_TEXT
      : C.RED_TEXT;

  txt(`${val}%`, cx, midY, {
    size: 8,
    weight: "bold",
    color: occColor,
  });

  return;
}

        // Status pill
        if (h.toLowerCase() === "status" && typeof val === "string") {
          const vLow  = val.toLowerCase();
          const pillC = vLow === "full"  ? [C.GREEN_BG,  C.GREEN_TEXT]
                      : vLow === "good"  ? [C.GREEN_BG,  C.GREEN_TEXT]
                      : vLow === "watch" ? [C.AMBER_BG,  C.AMBER_TEXT]
                      : vLow === "low"   ? [C.RED_BG,    C.RED_TEXT]
                      :                    [C.BG_TERTIARY, C.TEXT_SECONDARY];
          const textW = doc.getTextWidth(val) + 10;
const pillW = Math.min(textW, colWidths[i] - 10);

const pillH = 5.8;
const pillX = colX[i] + 3;
const pillY = ty + rowH / 2 - pillH / 2;

rect(pillX, pillY, pillW, pillH, pillC[0], 3);

txt(val, pillX + pillW / 2, midY + 0.2, {
  size: 6.5,
  weight: "bold",
  color: pillC[1],
  align: "center",
});
          return;
        }

        // Default
        const isFirst    = i === 0;
        const lines      = wrap(val == null ? "—" : String(val), colWidths[i] - 6);
        const textColor  = isFirst ? C.TEXT_PRIMARY : C.TEXT_SECONDARY;
        const lineStartY = ty + (rowH - lines.length * 4.6) / 2 + 3.2;
        txt(lines, cx, lineStartY, { size: 8, color: textColor, lh: 4.6 });
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