// ─────────────────────────────────────────────────────────────
// UNIT SYSTEM  (all mm unless noted)
// jsPDF text: baseline is BOTTOM of cap-height.
//   capH(pt) = pt × 0.72 × (25.4/72)  →  mm above baseline to visual top
//   To top-align text inside a box: textY = boxTop + padding + capH(pt)
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

const F = {
  TITLE:   19,   // page title
  SECTION: 11,   // section heading
  BODY:    10,   // body copy
  SMALL:   8,    // bullets / table cells
  LABEL:   6,    // box header labels
  TINY:    7.5,  // footer
};

const LH = { BODY: 5.5, SMALL: 4.5, BULLET: 5.2 };

const S = {
  GAP:  2.1,   //  8px
  XS:   1.1,   //  4px
  SM:   1.6,   //  6px
  MD:   2.6,   // 10px
  LG:   3.2,   // 12px
  XL:   4.2,   // 16px
  XXL:  6.3,   // 24px
};

// mm above baseline equal to the cap-height of a given pt size
const capH = (pt) => pt * 0.72 * (25.4 / 72);

const formatValue = (v) => {
  if (v == null) return "—";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(1);
  return String(v);
};

// Rasterise any logo src (imported asset, URL, existing dataURL) to a PNG dataURL
const loadImageAsDataURL = (src) =>
  new Promise((resolve) => {
    if (!src) return resolve(null);
    if (typeof src === "string" && src.startsWith("data:")) return resolve(src);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width  = img.naturalWidth  || img.width;
        canvas.height = img.naturalHeight || img.height;
        canvas.getContext("2d").drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      } catch (e) { console.error("Logo rasterise failed:", e); resolve(null); }
    };
    img.onerror = (e) => { console.error("Logo load failed:", e); resolve(null); };
    img.src = typeof src === "string" ? src : URL.createObjectURL(src);
  });

export async function exportReportPdf({
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

  const logoData = await loadImageAsDataURL(logo);
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF("p", "mm", "a4");
  const W   = doc.internal.pageSize.getWidth();    // 210 mm
  const H   = doc.internal.pageSize.getHeight();   // 297 mm
  const M   = 18;         // side margin
  const CW  = W - M * 2;  // 174 mm content width

  // Y_START: for continuation pages that have the gold stripe
  const Y_START = M + S.LG + S.MD; // 23.8 mm — clears 4.3 mm stripe + margin

  let y = Y_START;

  // ── Primitives ──────────────────────────────────────────────

  const setFont = (size, weight = "normal", color = C.TEXT_PRIMARY) => {
    doc.setFont("helvetica", weight);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };

  // Always split so maxW is honoured; join array before split so wrapping stays consistent
  const txt = (str, x, yPos, opts = {}) => {
    const { size = F.BODY, weight = "normal", color = C.TEXT_PRIMARY,
            align = "left", lh = LH.BODY, maxW } = opts;
    setFont(size, weight, color);
    const input = Array.isArray(str) ? str.join("\n") : String(str);
    const lines = doc.splitTextToSize(input, maxW || 9999);
    lines.forEach((l, i) => doc.text(l, x, yPos + i * lh, { align }));
  };

  // Justified body text: fills each line to maxW using word spacing
  const txtJustified = (str, x, yPos, maxW, opts = {}) => {
    const { size = F.BODY, weight = "normal", color = C.TEXT_PRIMARY, lh = LH.BODY } = opts;
    setFont(size, weight, color);
    const lines = doc.splitTextToSize(String(str), maxW);
    lines.forEach((line, i) => {
      const isLast = i === lines.length - 1;
      if (isLast) {
        // last line: left-align naturally
        doc.text(line, x, yPos + i * lh);
      } else {
        const words = line.trim().split(/\s+/);
        if (words.length <= 1) {
          doc.text(line, x, yPos + i * lh);
        } else {
          setFont(size, weight, color);
          const lineW   = doc.getTextWidth(line.trim());
          const totalWordW = words.reduce((s, w) => s + doc.getTextWidth(w), 0);
          const spaceW  = (maxW - totalWordW) / (words.length - 1);
          let cx = x;
          words.forEach((word, wi) => {
            doc.text(word, cx, yPos + i * lh);
            cx += doc.getTextWidth(word) + (wi < words.length - 1 ? spaceW : 0);
          });
        }
      }
    });
    return lines.length;
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

  // Loop uses >= so it always evaluates at minSize
  const fitTextSize = (text, maxW, maxSize, minSize = 7, weight = "normal") => {
    const value = String(text);
    let size = maxSize;
    while (size >= minSize) {
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
      y = Y_START;
    }
  };

  // ── Page chrome ──────────────────────────────────────────────

  // No top stripe on the first page — drawPageStripe() is only used on
  // continuation pages so they stay visually consistent.
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

  // Section title: thin accent bar + label, consistent spacing after
  const sectionTitle = (label, accent = C.BLUE_TEXT) => {
    const BAR_PAD = 1.4;
    const barH    = capH(F.SECTION) + BAR_PAD * 2; // ~5.4 mm
    rect(M, y, 0.8, barH, accent, 0.4);
    txt(label, M + 3.2, y + BAR_PAD + capH(F.SECTION), {
      size: F.SECTION, weight: "normal", color: C.TEXT_PRIMARY,
    });
    y += barH + S.MD + S.LG;
  };

  // ══════════════════════════════════════════════════════════
  // PAGE HEADER  (no gold stripe on page 1)
  // Layout:
  //   [Logo 14×14mm]  [Title bold 19pt]              [Badge]
  //                   [subtitle · period  8pt muted]
  //   ────────────────────────────────────────────────────────
  // Logo and text block are both vertically centred inside the
  // header zone height (HEADER_H).
  // ══════════════════════════════════════════════════════════

  // Page 1 starts at the very top margin — no stripe offset needed
  y = M; // 18 mm from top

  const LOGO_SIZE   = 14;   // logo square, mm
  const LOGO_GAP    = 4;    // gap between logo right edge and title left edge, mm
  const HEADER_H    = LOGO_SIZE; // header zone equals logo height

  // Vertical centres inside the header zone
  const titleLineH  = capH(F.TITLE);
  const metaLineH   = capH(F.SMALL);
  const textBlockH  = titleLineH + S.SM + metaLineH; // title + gap + meta
  const textBlockY  = y + (HEADER_H - textBlockH) / 2; // vertically centred

  // Logo — vertically centred in header zone
  if (logoData) {
    try { doc.addImage(logoData, "PNG", M, y, LOGO_SIZE, LOGO_SIZE); }
    catch (e) { console.error("addImage failed:", e); }
  }

  const titleX      = M + LOGO_SIZE + LOGO_GAP;
  const titleTextW  = W - titleX - M - 28; // leave room for badge on the right

  // Title baseline
  const titleBaseY  = textBlockY + titleLineH;
  txt(title, titleX, titleBaseY, {
    size: F.TITLE, weight: "bold", color: C.TEXT_PRIMARY, maxW: titleTextW,
  });

  // Badge — right-aligned, vertically centred on the title line
  const badgeH      = 5.8;
  const badgeW      = 26;
  const badgeX      = W - M - badgeW;
  const badgeY      = titleBaseY - titleLineH + (HEADER_H - badgeH) / 2;
  rect(badgeX, badgeY, badgeW, badgeH, C.BLUE_BG, 1.8);
  // Badge text: vertically centred inside badge
  txt(reportType, badgeX + badgeW / 2, badgeY + badgeH / 2 + capH(F.LABEL + 1) / 2, {
    size: F.LABEL + 1, weight: "bold", color: C.BLUE_TEXT, align: "center",
  });

  // Subtitle / period — sits S.SM below title baseline
  const meta     = [subtitle, period].filter(Boolean).join("  ·  ");
  const metaBaseY = titleBaseY + S.SM + metaLineH;
  if (meta) {
    txt(meta, titleX, metaBaseY, { size: F.SMALL, color: C.TEXT_SECONDARY });
  }

  // Divider — S.MD below the bottom of the header zone
  y = y + HEADER_H + S.MD;
  hline(M, y, W - M, C.BORDER, 0.3);
  y += S.LG;

  // ══════════════════════════════════════════════════════════
  // KPI CARDS
  // ══════════════════════════════════════════════════════════

  if (kpis.length > 0) {
    sectionTitle("Key metrics", C.BLUE_TEXT);

    const estimateKpiCols = (items) => {
      const maxChars = items.reduce((max, item) => Math.max(
        max,
        String(item.label ?? "").length,
        String(formatValue(item.value)).length,
        String(item.sub ?? "").length,
      ), 0);
      if (items.length <= 2) return items.length;
      if (maxChars > 48) return 2;
      if (maxChars > 26) return 3;
      return 4;
    };

    const COLS       = Math.max(1, Math.min(kpis.length, estimateKpiCols(kpis)));
    const GAP        = S.GAP;
    const CARD_W     = (CW - GAP * (COLS - 1)) / COLS;
    const CARD_PAD_X = 3.8;
    const CARD_TXT_W = CARD_W - CARD_PAD_X - 1.9;
    const ACCENTS    = [C.BLUE_TEXT, C.GREEN_FILL, C.AMBER_FILL, C.RED_FILL];

    // ── FIXED: uniform card height across all cards in a row ──
    // All non-highlighted cards share the same value font size to prevent
    // the occupancy rate card having a different apparent size from its siblings.
    const VALUE_MAX  = 16;   // cap for normal cards
    const VALUE_HL   = 18;   // cap for highlighted card
    const VALUE_MIN  = 10.5;

    // First pass: compute per-card sizes
    const rawLayouts = kpis.map((kpi) => {
      const labelLines = wrap(kpi.label ?? "", CARD_TXT_W);
      const subLines   = kpi.sub ? wrap(kpi.sub, CARD_TXT_W) : [];
      const valueText  = formatValue(kpi.value);
      const valueSize  = fitTextSize(
        valueText, CARD_TXT_W,
        kpi.highlight ? VALUE_HL : VALUE_MAX,
        VALUE_MIN, "bold"
      );
      const labelSize  = labelLines.length > 1 ? 7 : 8;
      return { kpi, labelLines, subLines, valueText, valueSize, labelSize };
    });

    // Second pass: within each row, non-highlighted cards share the smallest
    // value size so they visually match each other
    const rowCount    = Math.ceil(kpis.length / COLS);
    const cardLayouts = rawLayouts.map((layout, i) => {
      const row   = Math.floor(i / COLS);
      const start = row * COLS;
      const rowItems = rawLayouts.slice(start, start + COLS);
      // smallest size among non-highlighted siblings
      const minNorm = rowItems
        .filter((r) => !r.kpi.highlight)
        .reduce((mn, r) => Math.min(mn, r.valueSize), VALUE_MAX);
      const valueSize = layout.kpi.highlight ? layout.valueSize : minNorm;
      const valueH    = (valueSize / 72) * 25.4 * 1.55;
      const subH      = layout.subLines.length > 0
        ? 0.8 + layout.subLines.length * LH.SMALL : 0;
      const cardH     = Math.max(
        24,
        4.2 + layout.labelLines.length * LH.SMALL + 1.0 + valueH + subH + 2.5
      );
      return { ...layout, valueSize, valueH, cardH };
    });

    const rowHeights = Array.from({ length: rowCount }, (_, row) => {
      const start = row * COLS;
      return Math.max(...cardLayouts.slice(start, start + COLS).map((l) => l.cardH));
    });

    ensureSpace(
      rowHeights.reduce((s, h) => s + h, 0) + GAP * (rowHeights.length - 1) + S.XL + S.MD
    );

    cardLayouts.forEach((layout, i) => {
      const col    = i % COLS;
      const row    = Math.floor(i / COLS);
      const cx     = M + col * (CARD_W + GAP);
      const cy     = y + rowHeights.slice(0, row).reduce((s, h) => s + h, 0) + row * GAP;
      const rH     = rowHeights[row];
      const accent = ACCENTS[i % ACCENTS.length];
      const bg     = layout.kpi.highlight ? C.BLUE_BG   : C.BG_SECONDARY;
      const valC   = layout.kpi.highlight ? C.BLUE_TEXT : C.TEXT_PRIMARY;
      const lblC   = layout.kpi.highlight ? C.BLUE_TEXT : C.TEXT_SECONDARY;
      const subC   = layout.kpi.highlight ? C.BLUE_TEXT : C.TEXT_TERTIARY;

      // Use full row height so all cards in a row are the same height
      rect(cx, cy, CARD_W, rH, bg, 1.3);
      rect(cx, cy, 0.8, rH, accent, 0.4);

      const labelBaseY = cy + 4.2 + capH(layout.labelSize);
      txt(layout.labelLines, cx + CARD_PAD_X, labelBaseY, {
        size: layout.labelSize, color: lblC, lh: LH.SMALL,
      });

      const labelBlockH = layout.labelLines.length * LH.SMALL;
      const valueBaseY  = cy + 4.2 + labelBlockH + 0.9 + capH(layout.valueSize);
      txt(layout.valueText, cx + CARD_PAD_X, valueBaseY, {
        size: layout.valueSize, weight: "bold", color: valC, lh: 5.2,
      });

      if (layout.subLines.length > 0) {
        const subBaseY = valueBaseY + layout.valueH + 0.7;
        txt(layout.subLines, cx + CARD_PAD_X, subBaseY, {
          size: F.SMALL, color: subC, lh: LH.SMALL,
        });
      }
    });

    y += rowHeights.reduce((s, h) => s + h, 0) + GAP * (rowHeights.length - 1) + S.XL + S.MD;
  }

  // ══════════════════════════════════════════════════════════
  // AI INSIGHT BLOCK
  // ══════════════════════════════════════════════════════════

  if (aiInsight) {
    ensureSpace(50);
    sectionTitle("AI occupancy summary", C.BLUE_TEXT);

    // Headline — bold, left-aligned
    if (aiInsight.headline) {
      const lines = wrap(aiInsight.headline, CW);
      txt(lines, M, y + capH(F.SECTION), {
        size: F.SECTION, weight: "bold", color: C.TEXT_PRIMARY, lh: 5.5,
      });
      y += lines.length * 5.5 + S.SM;
    }

    // Summary — justified body text
    if (aiInsight.summary) {
      const lineCount = txtJustified(aiInsight.summary, M, y + capH(F.BODY), CW, {
        size: F.BODY, color: C.TEXT_SECONDARY, lh: LH.BODY,
      });
      y += lineCount * LH.BODY + S.LG + S.SM;
    }

    hline(M, y, W - M, C.BORDER, 0.3);
    y += S.MD + S.SM;

    // Confidence row
    const conf      = aiInsight.confidence || 0;
    const confLabel = aiInsight.confidenceLabel || `${conf}%`;
    txt("Confidence", M, y + capH(F.BODY), { size: F.BODY, color: C.TEXT_SECONDARY });
    txt(confLabel, W - M, y + capH(F.BODY), {
      size: F.BODY, weight: "bold", color: C.GREEN_TEXT, align: "right",
    });
    y += capH(F.BODY) + S.SM;

    rect(M, y, CW, 2.4, C.BG_SECONDARY, 1.2);
    if (conf > 0) rect(M, y, CW * (conf / 100), 2.4, C.GREEN_FILL, 1.2);
    y += 2.4 + S.LG;

    hline(M, y, W - M, C.BORDER, 0.3);
    y += S.LG;

    // ── 2-col boxes ────────────────────────────────────────────
    const CGAP         = S.GAP;
    const half         = (CW - CGAP) / 2;
    const colR         = M + half + CGAP;
    const standoutItems = aiInsight.standout || aiInsight.keyFindings || [];
    const watchItems    = aiInsight.watch || aiInsight.anomalies || [];
    const nextStepItems = aiInsight.nextSteps || aiInsight.recommendedActions || [];

    // ── Insight box layout constants ──────────────────────────
    const AI_LABEL_PT  = 7;      // FIX: larger label font (was 6pt)
    const AI_PAD_X     = 4.0;   // left/right inner padding of box
    const AI_ITEM_PAD  = 3.0;   // equal top padding above first item AND bottom padding after last item
    const ITEM_SEP     = 4.5;   // total vertical zone between two items (separator drawn at midpoint)
    const BULLET_W     = 3.2;   // bullet dot x-offset + gap before text (dot cx at AI_PAD_X + 1.0)
    // jsPDF font metrics run ~3-4% wider than actual rendering, causing
    // splitTextToSize to break lines earlier than necessary. We compensate by
    // adding a proportional slack (4% of the available text width) to the wrap
    // budget only — the render position is unchanged so text stays within padding.
    const textWFor = (bw) => {
      const raw = bw - AI_PAD_X - BULLET_W - AI_PAD_X;
      return raw * 1.04; // 4% slack — corrects metric drift at any box width
    };

    // Label row height: accent bar (0.8) + top pad (S.SM) + label cap + bottom pad (S.SM)
    const LABEL_ROW_H  = 0.8 + S.SM + capH(AI_LABEL_PT) + S.SM;

    // Height of one item's text block
    const itemTextH = (item, bw) => wrap(item, textWFor(bw)).length * LH.BULLET;

    // Full box height with equal top/bottom item padding
    const boxH = (items, bw) => {
      if (items.length === 0) return LABEL_ROW_H + AI_ITEM_PAD * 2;
      const textTotal = items.reduce((a, it) => a + itemTextH(it, bw), 0);
      const sepTotal  = (items.length - 1) * ITEM_SEP;
      return LABEL_ROW_H + AI_ITEM_PAD + textTotal + sepTotal + AI_ITEM_PAD;
    };

    // ── drawInsightBox ─────────────────────────────────────────
    // bw is the actual box width so text wrap is always exact for that box.
    const drawInsightBox = (bx, by, bw, bh, items, bgColor, accentColor, labelColor, labelText) => {
      // Box background + accent bar
      rect(bx, by, bw, bh, bgColor, 1.5);
      rect(bx, by, bw, 0.8, accentColor, 0.4);

      // Label — FIX: larger pt, same left indent as bullets
      txt(labelText, bx + AI_PAD_X, by + 0.8 + S.SM + capH(AI_LABEL_PT), {
        size: AI_LABEL_PT, weight: "bold", color: labelColor,
      });

      const TW  = textWFor(bw);        // text wrap width for THIS box
      const textX = bx + AI_PAD_X + BULLET_W; // text left edge (right of bullet)
      let iy = by + LABEL_ROW_H + AI_ITEM_PAD;

      items.forEach((item, idx) => {
        // Separator line — drawn exactly halfway between previous item bottom and this item top
        if (idx > 0) {
          const sepY = iy - ITEM_SEP / 2;
          const sepColor = accentColor === C.TEXT_TERTIARY ? C.BORDER : accentColor;
          hline(bx + AI_PAD_X, sepY, bx + bw - AI_PAD_X, sepColor, 0.25);
        }

        // Wrap text to exactly TW — this guarantees no overflow past the right pad
        const lines = wrap(item, TW);
        const textH = lines.length * LH.BULLET;

        // Bullet dot — vertically centred on first-line cap-height midpoint
        doc.setFillColor(...accentColor);
        doc.circle(bx + AI_PAD_X + 1.0, iy + capH(F.SMALL) * 0.5, 0.75, "F");

        // Item text block — starts at textX, wrapped to TW
        txt(lines, textX, iy + capH(F.SMALL), {
          size: F.SMALL, color: C.TEXT_SECONDARY, lh: LH.BULLET, maxW: TW,
        });

        iy += textH + (idx < items.length - 1 ? ITEM_SEP : 0);
      });
    };

    const standoutH = boxH(standoutItems, half);
    const watchH    = boxH(watchItems,    half);
    const twoColH   = Math.max(standoutH, watchH);

    ensureSpace(twoColH + S.LG);

    drawInsightBox(M,    y, half, twoColH, standoutItems,
      C.BG_SECONDARY, C.TEXT_TERTIARY, C.TEXT_TERTIARY, "WHAT STANDS OUT");
    drawInsightBox(colR, y, half, twoColH, watchItems,
      C.AMBER_BG, C.AMBER_FILL, C.AMBER_TEXT, "THINGS TO WATCH");

    y += twoColH + S.GAP;

    // Next steps — full-width green box
    const steps  = nextStepItems;
    const stepsH = boxH(steps, CW);

    ensureSpace(stepsH + S.LG);
    drawInsightBox(M, y, CW, stepsH, steps,
      C.GREEN_BG, C.GREEN_FILL, C.GREEN_TEXT, "WHAT TO DO NEXT");

    y += stepsH + S.LG;
  }

  // ══════════════════════════════════════════════════════════
  // SECTIONS
  // ══════════════════════════════════════════════════════════

  sections.forEach((section, sIdx) => {
    ensureSpace(35);
    if (sIdx > 0) {
      y += S.MD;
    }

    sectionTitle(section.title || "", C.BLUE_TEXT);

    if (section.description) {
      const lines = wrap(section.description, CW);
      txt(lines, M, y + capH(F.SMALL), {
        size: F.SMALL, color: C.TEXT_SECONDARY, lh: LH.SMALL,
      });
      y += lines.length * LH.SMALL + S.SM;
    }

    if (Array.isArray(section.rows) && section.rows.length > 0) {
      if (
        (section.type === "table" || section.type === "inventory") &&
        section.headers
      ) {
        y = renderTable(section, y);
      } else {
        y = renderListSection(section, y);
      }
    }
  });

  // ── renderTable ─────────────────────────────────────────────

  function renderListSection(section, startY) {
    let ly = startY;
    const rows = section.rows || [];
    const bulletX = M + 2.3;
    const textX = M + 6;
    const textW = CW - (textX - M);
    const rowGap = 1.6;

    rows.forEach((row, idx) => {
      const text = Array.isArray(row) ? row.join(" ") : String(row);
      const lines = wrap(text, textW);
      const rowH = lines.length * LH.SMALL;

      ensureSpace(rowH + 2);

      doc.setFillColor(...C.AMBER_FILL);
      doc.circle(bulletX, ly + capH(F.SMALL) * 0.5, 0.7, "F");
      txt(lines, textX, ly + capH(F.SMALL), {
        size: F.SMALL,
        color: C.TEXT_SECONDARY,
        lh: LH.SMALL,
        maxW: textW,
      });

      ly += rowH + (idx < rows.length - 1 ? rowGap : 0);
    });

    return ly;
  }

  function renderTable(section, startY) {
    let ty          = startY;
    const hdrs      = section.headers;
    const rows      = section.rows;
    const colWidths = section.colWidths || hdrs.map(() => CW / hdrs.length);

    const colX = [];
    let acc = M;
    colWidths.forEach((w) => { colX.push(acc); acc += w; });

    const ROW_H     = 9.5;
    const ROW_V_PAD = 3.0;
    const CELL_P    = 1.8;

    const isRightAligned = (headerName) =>
      ["usage", "charge", "bill amount", "balance", "rate", "amount"].includes(
        String(headerName || "").toLowerCase(),
      );

    const renderTableHeader = (yPos) => {
      rect(M, yPos, CW, ROW_H, C.BG_TERTIARY);
      hline(M, yPos, W - M, C.BORDER, 0.3);
      hline(M, yPos + ROW_H, W - M, C.BORDER, 0.3);
      hdrs.forEach((h, i) => {
        const alignRight = isRightAligned(h);
        const alignX = alignRight ? colX[i] + colWidths[i] - CELL_P : colX[i] + CELL_P;
        txt(h, alignX, yPos + ROW_V_PAD + capH(F.LABEL), {
          size: F.LABEL,
          weight: "bold",
          color: C.TEXT_TERTIARY,
          align: alignRight ? "right" : "left",
        });
      });
      return yPos + ROW_H;
    };

    // Header row
    ty = renderTableHeader(ty);

    rows.forEach((row, rIdx) => {
      const cellTexts = hdrs.map((h) => {
        const v = row[h]; return v == null ? "—" : String(v);
      });

      const wrapped   = cellTexts.map((ct, i) => wrap(ct, colWidths[i] - CELL_P * 2));
      const lineCount = Math.max(...wrapped.map((wc) => wc.length));
      const rowH      = Math.max(ROW_H, lineCount * LH.SMALL + ROW_V_PAD * 2);

      const pageBefore = doc.internal.getNumberOfPages();
      ensureSpace(rowH + 2);
      const pageAfter = doc.internal.getNumberOfPages();
      if (pageAfter > pageBefore) {
        ty = renderTableHeader(y);
      }

      if (rIdx % 2 === 0) rect(M, ty, CW, rowH, C.BG_SECONDARY);
      hline(M, ty + rowH, W - M, C.BORDER, 0.2);

      // Single anchor for all cell types — top-padded baseline
      const cellBaseY = ty + ROW_V_PAD + capH(F.SMALL);

      hdrs.forEach((h, i) => {
        const val = row[h];
        const cx  = colX[i] + CELL_P;

        if (h.toLowerCase() === "occupancy" && typeof val === "number") {
          const color = val >= 90 ? C.GREEN_TEXT : val >= 75 ? C.AMBER_TEXT : C.RED_TEXT;
          txt(`${val}%`, cx, cellBaseY, { size: F.SMALL, weight: "bold", color });
          return;
        }

        if (h.toLowerCase() === "status" && typeof val === "string") {
          const vLow  = val.toLowerCase();
          const pillC = ["full", "good", "closed", "sent", "paid", "finalized"].includes(vLow)
                          ? [C.GREEN_BG, C.GREEN_TEXT]
                      : ["watch", "ready", "ready_to_send", "open", "active", "pending"].includes(vLow)
                          ? [C.AMBER_BG, C.AMBER_TEXT]
                      : ["low", "revised", "overdue", "rejected", "canceled", "cancelled", "voided"].includes(vLow)
                          ? [C.RED_BG, C.RED_TEXT]
                          : [C.BG_TERTIARY, C.TEXT_SECONDARY];

          setFont(F.SMALL, "bold", pillC[1]);
          const tW  = doc.getTextWidth(val);
          const pH  = 4.2;
          const pW  = Math.min(tW + 5.3, colWidths[i] - CELL_P * 2);
          const pX  = cx;
          const pY  = cellBaseY - capH(F.SMALL) - (pH - capH(F.SMALL)) / 2;
          rect(pX, pY, pW, pH, pillC[0], pH / 2);
          txt(val, pX + pW / 2, pY + pH / 2 + capH(F.SMALL) / 2, {
            size: F.SMALL, weight: "bold", color: pillC[1], align: "center",
          });
          return;
        }

        const isFirst = i === 0;
        const alignRight = isRightAligned(h);
        const textX = alignRight ? colX[i] + colWidths[i] - CELL_P : cx;
        const lines   = wrap(val == null ? "—" : String(val), colWidths[i] - CELL_P * 2);
        txt(lines, textX, cellBaseY, {
          size: F.SMALL,
          color: isFirst ? C.TEXT_PRIMARY : C.TEXT_SECONDARY,
          lh: LH.SMALL,
          align: alignRight ? "right" : "left",
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