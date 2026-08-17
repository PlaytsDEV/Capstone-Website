const defaultLogo = new URL("../../assets/images/LOGO.png", import.meta.url).href;

// ─────────────────────────────────────────────────────────────
// LILYCREST EXECUTIVE PDF DESIGN SYSTEM (Unit: mm unless noted)
// Modern, clean, warm, and professional enterprise report layout
// ─────────────────────────────────────────────────────────────

const C = {
  // Brand & Navy Tokens
  BRAND_PRIMARY:   [ 37,  99, 235], // #2563EB Royal Blue
  BRAND_DARK:      [ 30,  58, 138], // #1E3A8A Deep Navy
  BRAND_LIGHT:     [239, 246, 255], // #EFF6FF Soft Blue
  BRAND_BORDER:    [219, 234, 254], // #DBEAFE

  // Slate Neutral Hierarchy
  TEXT_PRIMARY:    [ 15,  23,  42], // #0F172A Slate 900
  TEXT_SECONDARY:  [ 51,  65,  85], // #334155 Slate 700
  TEXT_MUTED:      [100, 116, 139], // #64748B Slate 500
  TEXT_TERTIARY:   [148, 163, 184], // #94A3B8 Slate 400

  // Backgrounds & Neutral 1px Borders
  BG_PAGE:         [255, 255, 255], // White
  BG_CARD:         [248, 250, 252], // #F8FAFC Slate 50
  BG_CARD_ALT:     [241, 245, 249], // #F1F5F9 Slate 100
  BORDER:          [226, 232, 240], // #E2E8F0 Slate 200
  BORDER_LIGHT:    [241, 245, 249], // #F1F5F9

  // Semantic Accents (Solid, professional, WCAG-compliant)
  EMERALD_TEXT:    [  4, 120,  87], // #047857 Emerald 700
  EMERALD_BG:      [240, 253, 244], // #F0FDF4 Emerald 50
  EMERALD_BORDER:  [187, 247, 208], // #BBF7D0 Emerald 200
  EMERALD_DOT:     [ 16, 185, 129], // #10B981 Emerald 500

  AMBER_TEXT:      [180,  83,   9], // #B45309 Amber 700
  AMBER_BG:        [255, 251, 235], // #FFFBEB Amber 50
  AMBER_BORDER:    [254, 243, 199], // #FEF3C7 Amber 200
  AMBER_DOT:       [245, 158,  11], // #F59E0B Amber 500

  ROSE_TEXT:       [185,  28,  28], // #B91C1C Red 700
  ROSE_BG:         [254, 242, 242], // #FEF2F2 Red 50
  ROSE_BORDER:     [254, 205, 211], // #FECDD3 Red 200
  ROSE_DOT:        [239,  68,  68], // #EF4444 Red 500

  WHITE:           [255, 255, 255],
};

const F = {
  TITLE:   15,   // Page title
  SECTION: 10.5, // Section heading
  BODY:    9,    // Body copy / AI summaries
  SMALL:   7.5,  // Table cells / bullets
  LABEL:   6.8,  // Card labels / table headers
  TINY:    6.5,  // Footers / metadata
};

const LH = {
  BODY:   4.8,
  SMALL:  4.0,
  BULLET: 4.4,
};

const S = {
  XS:  1.0,
  SM:  1.8,
  MD:  2.8,
  LG:  3.8,
  XL:  5.0,
  XXL: 7.0,
};

// Convert pt font size to approximate cap-height in mm
const capH = (pt) => pt * 0.72 * (25.4 / 72);

/**
 * Universal text sanitizer for jsPDF standard Helvetica.
 * Replaces Unicode Peso symbol with "PHP", normalizes dashes, quotes, and whitespace.
 */
export const sanitizePdfText = (val) => {
  if (val == null) return "";
  let str = String(val);
  str = str.replace(/₱/g, "PHP ");
  str = str.replace(/[\u20B1]/g, "PHP ");
  str = str.replace(/PHP\s+([0-9])/g, "PHP $1");
  str = str
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2022]/g, "-");
  return str.trim();
};

const formatPdfValue = (v) => {
  if (v == null) return "-";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : v.toFixed(1);
  return sanitizePdfText(v);
};

// Rasterize logo src to a PNG dataURL
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
      } catch (e) {
        console.error("Logo rasterize failed:", e);
        resolve(null);
      }
    };
    img.onerror = (e) => {
      console.error("Logo load failed:", e);
      resolve(null);
    };
    img.src = typeof src === "string" ? src : URL.createObjectURL(src);
  });

export async function exportReportPdf({
  logo       = defaultLogo,
  title      = "Analytics Report",
  subtitle   = "",
  filename   = "report.pdf",
  period     = "",
  reportType = "Analytics",
  kpis       = [],
  aiInsight  = null,
  sections   = [],
} = {}) {
  const logoData = await loadImageAsDataURL(logo);
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF("p", "mm", "a4");

  const W   = doc.internal.pageSize.getWidth();    // 210 mm
  const H   = doc.internal.pageSize.getHeight();   // 297 mm
  const M   = 16;                                  // 16 mm margins
  const CW  = W - M * 2;                           // 178 mm printable width

  const Y_START_PAGE1 = M + 2;
  const Y_START_CONT  = M + 10;

  let y = Y_START_PAGE1;

  // ── Primitives ──────────────────────────────────────────────

  const setFont = (size, weight = "normal", color = C.TEXT_PRIMARY) => {
    doc.setFont("helvetica", weight);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };

  const txt = (str, x, yPos, opts = {}) => {
    const {
      size = F.BODY,
      weight = "normal",
      color = C.TEXT_PRIMARY,
      align = "left",
      lh = LH.BODY,
      maxW,
    } = opts;
    setFont(size, weight, color);
    const cleanStr = Array.isArray(str)
      ? str.map((s) => sanitizePdfText(s)).join("\n")
      : sanitizePdfText(str);
    const lines = doc.splitTextToSize(cleanStr, maxW || 9999);
    lines.forEach((l, i) => doc.text(l, x, yPos + i * lh, { align }));
    return lines.length;
  };

  const rect = (x, yPos, w, h, fill, r = 0, strokeColor = null, lineWidth = 0.25) => {
    if (fill) doc.setFillColor(...fill);
    if (strokeColor) {
      doc.setDrawColor(...strokeColor);
      doc.setLineWidth(lineWidth);
    }
    const style = fill && strokeColor ? "FD" : strokeColor ? "S" : "F";
    if (r > 0) doc.roundedRect(x, yPos, w, h, r, r, style);
    else doc.rect(x, yPos, w, h, style);
  };

  const hline = (x1, yPos, x2, color = C.BORDER, lw = 0.2) => {
    doc.setDrawColor(...color);
    doc.setLineWidth(lw);
    doc.line(x1, yPos, x2, yPos);
  };

  const wrap = (str, maxW) => doc.splitTextToSize(sanitizePdfText(str), maxW);

  const fitTextSize = (text, maxW, maxSize, minSize = 8, weight = "bold") => {
    const clean = sanitizePdfText(text);
    let size = maxSize;
    while (size >= minSize) {
      setFont(size, weight, C.TEXT_PRIMARY);
      if (doc.getTextWidth(clean) <= maxW) break;
      size -= 0.5;
    }
    return size;
  };

  const ensureSpace = (needed) => {
    if (y + needed > H - 18) {
      doc.addPage();
      drawPageHeaderContinuation();
      y = Y_START_CONT;
    }
  };

  // ── Page chrome ──────────────────────────────────────────────

  const drawTopAccentBar = () => {
    rect(0, 0, W, 1.8, C.BRAND_PRIMARY);
  };

  const drawPageHeaderContinuation = () => {
    drawTopAccentBar();
    hline(M, M + 4, W - M, C.BORDER, 0.2);
    txt(sanitizePdfText(title), M, M + 2.5, {
      size: F.TINY + 0.5,
      weight: "bold",
      color: C.TEXT_MUTED,
    });
    txt(sanitizePdfText(reportType).toUpperCase(), W - M, M + 2.5, {
      size: F.TINY,
      weight: "bold",
      color: C.BRAND_PRIMARY,
      align: "right",
    });
  };

  const drawFooter = (pageNum, total) => {
    hline(M, H - 11, W - M, C.BORDER, 0.2);
    txt("Lilycrest Dormitory Management System  ·  Confidential & Proprietary", M, H - 7, {
      size: F.TINY,
      color: C.TEXT_MUTED,
    });
    txt(`Page ${pageNum} of ${total}`, W - M, H - 7, {
      size: F.TINY,
      weight: "bold",
      color: C.TEXT_MUTED,
      align: "right",
    });
  };

  const sectionTitle = (label, rightBadge = null) => {
    const cleanLabel = sanitizePdfText(label);
    ensureSpace(12);
    
    // Clean, modern section title with solid dot indicator
    doc.setFillColor(...C.BRAND_PRIMARY);
    doc.circle(M + 1.2, y + capH(F.SECTION) * 0.5, 0.9, "F");

    txt(cleanLabel, M + 3.8, y + capH(F.SECTION), {
      size: F.SECTION,
      weight: "bold",
      color: C.TEXT_PRIMARY,
    });

    if (rightBadge) {
      txt(sanitizePdfText(rightBadge), W - M, y + capH(F.SECTION), {
        size: F.TINY + 0.5,
        weight: "bold",
        color: C.TEXT_MUTED,
        align: "right",
      });
    }

    y += capH(F.SECTION) + S.MD;
  };

  // ══════════════════════════════════════════════════════════
  // PAGE 1: EXECUTIVE HEADER
  // ══════════════════════════════════════════════════════════

  drawTopAccentBar();

  const LOGO_SIZE = 13;
  const LOGO_GAP = 3.5;
  const HEADER_H = LOGO_SIZE;

  const titleLineH = capH(F.TITLE);
  const metaLineH  = capH(F.TINY);
  const textBlockH = titleLineH + S.SM + metaLineH;
  const textBlockY = y + (HEADER_H - textBlockH) / 2;

  if (logoData) {
    try {
      doc.addImage(logoData, "PNG", M, y, LOGO_SIZE, LOGO_SIZE);
    } catch (e) {
      console.error("addImage failed:", e);
    }
  }

  const titleX = M + LOGO_SIZE + LOGO_GAP;
  const badgeW = 28;
  const badgeH = 5.2;
  const badgeX = W - M - badgeW;
  const titleTextW = badgeX - titleX - 4;

  const titleBaseY = textBlockY + titleLineH;
  txt(title, titleX, titleBaseY, {
    size: F.TITLE,
    weight: "bold",
    color: C.TEXT_PRIMARY,
    maxW: titleTextW,
  });

  // Category Pill Badge (Clean 1px border, no loud gradients)
  const badgeY = y + (HEADER_H - badgeH) / 2;
  rect(badgeX, badgeY, badgeW, badgeH, C.BRAND_LIGHT, 1.2, C.BRAND_BORDER, 0.25);
  txt(sanitizePdfText(reportType).toUpperCase(), badgeX + badgeW / 2, badgeY + badgeH / 2 + capH(F.LABEL) / 2, {
    size: F.LABEL,
    weight: "bold",
    color: C.BRAND_PRIMARY,
    align: "center",
  });

  // Subtitle / Generation timestamp
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const metaParts = [subtitle, period, `Generated ${dateStr}`].filter(Boolean);
  const metaLine = metaParts.join("   ·   ");
  const metaBaseY = titleBaseY + S.SM + metaLineH;
  if (metaLine) {
    txt(metaLine, titleX, metaBaseY, {
      size: F.TINY + 0.5,
      color: C.TEXT_MUTED,
    });
  }

  y = y + HEADER_H + S.MD;
  hline(M, y, W - M, C.BORDER, 0.25);
  y += S.LG;

  // ══════════════════════════════════════════════════════════
  // KPI METRICS GRID (Flat, modern cards with clean 1px borders)
  // ══════════════════════════════════════════════════════════

  if (kpis.length > 0) {
    sectionTitle("Key Performance Indicators");

    const COLS = Math.min(4, Math.max(2, kpis.length));
    const GAP  = S.MD;
    const CARD_W = (CW - GAP * (COLS - 1)) / COLS;
    const CARD_PAD = 3.0;
    const TXT_W = CARD_W - CARD_PAD * 2;

    const parsedKpis = kpis.map((kpi) => {
      const cleanVal = formatPdfValue(kpi.value);
      const valSize  = fitTextSize(cleanVal, TXT_W, kpi.highlight ? 14.5 : 13.5, 9.5, "bold");
      const labelLines = wrap(kpi.label || "", TXT_W);
      const subLines   = kpi.sub ? wrap(kpi.sub, TXT_W) : [];
      return {
        ...kpi,
        cleanVal,
        valSize,
        labelLines,
        subLines,
      };
    });

    const cardH = 22; // Fixed uniform height for executive symmetry
    ensureSpace(cardH + S.MD);

    parsedKpis.forEach((layout, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const cx  = M + col * (CARD_W + GAP);
      const cy  = y + row * (cardH + GAP);

      const bg = layout.highlight ? C.BRAND_LIGHT : C.BG_CARD;
      const borderC = layout.highlight ? C.BRAND_BORDER : C.BORDER;

      rect(cx, cy, CARD_W, cardH, bg, 1.5, borderC, 0.25);

      // Label (Uppercase, muted)
      const lblY = cy + CARD_PAD + capH(F.LABEL);
      txt(layout.labelLines[0] || "", cx + CARD_PAD, lblY, {
        size: F.LABEL,
        weight: "bold",
        color: layout.highlight ? C.BRAND_PRIMARY : C.TEXT_MUTED,
      });

      // Value (Bold, high-contrast)
      const valY = cy + CARD_PAD + capH(F.LABEL) + 2.0 + capH(layout.valSize);
      txt(layout.cleanVal, cx + CARD_PAD, valY, {
        size: layout.valSize,
        weight: "bold",
        color: layout.highlight ? C.BRAND_PRIMARY : C.TEXT_PRIMARY,
      });

      // Subtitle / Trend
      if (layout.subLines.length > 0) {
        const subY = cy + cardH - CARD_PAD;
        txt(layout.subLines[0], cx + CARD_PAD, subY, {
          size: F.TINY,
          color: C.TEXT_MUTED,
        });
      }
    });

    const rowsCount = Math.ceil(parsedKpis.length / COLS);
    y += rowsCount * cardH + (rowsCount - 1) * GAP + S.LG;
  }

  // ══════════════════════════════════════════════════════════
  // EXECUTIVE BRIEFING & AI SUMMARY
  // ══════════════════════════════════════════════════════════

  if (aiInsight) {
    ensureSpace(45);

    const summarySectionTitle = `${reportType || "Executive"} Performance Summary`;
    const conf = aiInsight.confidence || 0;
    const confLabel = aiInsight.confidenceLabel || (conf >= 80 ? "High Confidence" : conf >= 50 ? "Medium Confidence" : "Standard");
    const rightBadgeText = `Executive AI Briefing  ·  ${confLabel}`;

    sectionTitle(summarySectionTitle, rightBadgeText);

    // Headline
    if (aiInsight.headline) {
      const headLines = wrap(aiInsight.headline, CW);
      txt(headLines, M, y + capH(F.SECTION), {
        size: F.SECTION - 0.5,
        weight: "bold",
        color: C.TEXT_PRIMARY,
        lh: 4.8,
      });
      y += headLines.length * 4.8 + S.SM;
    }

    // Narrative paragraph (Clean left-aligned layout with comfortable line height)
    if (aiInsight.summary) {
      const sumLines = wrap(aiInsight.summary, CW);
      txt(sumLines, M, y + capH(F.BODY), {
        size: F.BODY,
        color: C.TEXT_SECONDARY,
        lh: LH.BODY,
      });
      y += sumLines.length * LH.BODY + S.MD;
    }

    // Structured Observation Cards
    const standoutItems = aiInsight.standout || aiInsight.keyFindings || [];
    const watchItems    = aiInsight.watch || aiInsight.anomalies || [];
    const nextStepItems = aiInsight.nextSteps || aiInsight.recommendedActions || [];

    const has2Col = standoutItems.length > 0 || watchItems.length > 0;
    if (has2Col) {
      const CGAP = S.MD;
      const colW = (CW - CGAP) / 2;
      const colR = M + colW + CGAP;

      const calcBoxHeight = (items) => {
        const itemLineCounts = items.map((it) => wrap(it, colW - 9).length);
        const totalLines = itemLineCounts.reduce((a, b) => a + b, 0);
        return 7.0 + totalLines * LH.BULLET + Math.max(0, items.length - 1) * 2.2 + 3.0;
      };

      const hLeft  = calcBoxHeight(standoutItems);
      const hRight = calcBoxHeight(watchItems);
      const blockH = Math.max(hLeft, hRight);

      ensureSpace(blockH + S.SM);

      const drawBriefingCard = (bx, by, bw, bh, titleText, items, theme) => {
        rect(bx, by, bw, bh, theme.bg, 1.5, theme.border, 0.25);

        // Header
        txt(titleText.toUpperCase(), bx + 3.5, by + 3.0 + capH(F.LABEL), {
          size: F.LABEL,
          weight: "bold",
          color: theme.labelColor,
        });

        let iy = by + 7.5;
        items.forEach((item) => {
          const lines = wrap(item, bw - 9.5);
          doc.setFillColor(...theme.dotColor);
          doc.circle(bx + 4.5, iy + capH(F.SMALL) * 0.5, 0.65, "F");

          txt(lines, bx + 7.5, iy + capH(F.SMALL), {
            size: F.SMALL,
            color: C.TEXT_SECONDARY,
            lh: LH.BULLET,
            maxW: bw - 9.5,
          });

          iy += lines.length * LH.BULLET + 2.0;
        });
      };

      if (standoutItems.length > 0) {
        drawBriefingCard(M, y, colW, blockH, "Key Observations", standoutItems, {
          bg: C.BG_CARD,
          border: C.BORDER,
          labelColor: C.TEXT_PRIMARY,
          dotColor: C.BRAND_PRIMARY,
        });
      }

      if (watchItems.length > 0) {
        drawBriefingCard(colR, y, colW, blockH, "Areas of Attention", watchItems, {
          bg: C.AMBER_BG,
          border: C.AMBER_BORDER,
          labelColor: C.AMBER_TEXT,
          dotColor: C.AMBER_DOT,
        });
      }

      y += blockH + S.MD;
    }

    // Recommended Actions Plan (Full-width card)
    if (nextStepItems.length > 0) {
      const stepLineCounts = nextStepItems.map((it) => wrap(it, CW - 12).length);
      const totalStepLines = stepLineCounts.reduce((a, b) => a + b, 0);
      const stepsH = 7.0 + totalStepLines * LH.BULLET + Math.max(0, nextStepItems.length - 1) * 2.2 + 3.0;

      ensureSpace(stepsH + S.SM);

      rect(M, y, CW, stepsH, C.EMERALD_BG, 1.5, C.EMERALD_BORDER, 0.25);

      txt("RECOMMENDED ACTION PLAN", M + 3.5, y + 3.0 + capH(F.LABEL), {
        size: F.LABEL,
        weight: "bold",
        color: C.EMERALD_TEXT,
      });

      let stepY = y + 7.5;
      nextStepItems.forEach((step, idx) => {
        const lines = wrap(step, CW - 12);
        
        // Step number indicator
        setFont(F.SMALL, "bold", C.EMERALD_TEXT);
        doc.text(`${idx + 1}.`, M + 4.0, stepY + capH(F.SMALL));

        txt(lines, M + 8.5, stepY + capH(F.SMALL), {
          size: F.SMALL,
          color: C.TEXT_SECONDARY,
          lh: LH.BULLET,
          maxW: CW - 12,
        });

        stepY += lines.length * LH.BULLET + 2.0;
      });

      y += stepsH + S.LG;
    }
  }

  // ══════════════════════════════════════════════════════════
  // SECTIONS & TABLES
  // ══════════════════════════════════════════════════════════

  sections.forEach((section) => {
    ensureSpace(30);

    sectionTitle(section.title || "Report Details");

    if (section.description) {
      const lines = wrap(section.description, CW);
      txt(lines, M, y + capH(F.SMALL), {
        size: F.SMALL,
        color: C.TEXT_MUTED,
        lh: LH.SMALL,
      });
      y += lines.length * LH.SMALL + S.SM;
    }

    if (Array.isArray(section.rows) && section.rows.length > 0) {
      if (section.type === "table" || section.headers) {
        y = renderTable(section, y);
      } else {
        y = renderListSection(section, y);
      }
    }

    y += S.MD;
  });

  // ── renderListSection ───────────────────────────────────────

  function renderListSection(section, startY) {
    let ly = startY;
    const rows = section.rows || [];
    const bulletX = M + 2.0;
    const textX = M + 5.5;
    const textW = CW - 5.5;

    rows.forEach((row) => {
      const cleanText = Array.isArray(row)
        ? row.map(sanitizePdfText).join(" ")
        : sanitizePdfText(row);
      const lines = wrap(cleanText, textW);
      const rowH = lines.length * LH.SMALL + 1.2;

      ensureSpace(rowH + 1);

      doc.setFillColor(...C.BRAND_PRIMARY);
      doc.circle(bulletX, ly + capH(F.SMALL) * 0.5, 0.65, "F");

      txt(lines, textX, ly + capH(F.SMALL), {
        size: F.SMALL,
        color: C.TEXT_SECONDARY,
        lh: LH.SMALL,
        maxW: textW,
      });

      ly += rowH;
    });

    return ly;
  }

  // ── renderTable ─────────────────────────────────────────────

  function renderTable(section, startY) {
    let ty = startY;
    const hdrs = section.headers || [];
    const rows = section.rows || [];
    const colWidths = section.colWidths || hdrs.map(() => CW / hdrs.length);

    const colX = [];
    let acc = M;
    colWidths.forEach((w) => {
      colX.push(acc);
      acc += w;
    });

    const ROW_H_BASE = 7.5;
    const CELL_PAD_X = 2.5;
    const CELL_PAD_Y = 2.0;

    const isNumericHeader = (h) => {
      const key = String(h || "").toLowerCase();
      return (
        key.includes("amount") ||
        key.includes("collected") ||
        key.includes("billed") ||
        key.includes("balance") ||
        key.includes("overdue") ||
        key.includes("rate") ||
        key.includes("revenue") ||
        key.includes("rent") ||
        key.includes("hours") ||
        key.includes("count") ||
        key.includes("total")
      );
    };

    const renderTableHeader = (yPos) => {
      rect(M, yPos, CW, ROW_H_BASE, C.BG_CARD_ALT, 0, C.BORDER, 0.25);
      hdrs.forEach((h, i) => {
        const alignRight = isNumericHeader(h);
        const textX = alignRight ? colX[i] + colWidths[i] - CELL_PAD_X : colX[i] + CELL_PAD_X;
        txt(sanitizePdfText(h).toUpperCase(), textX, yPos + CELL_PAD_Y + capH(F.LABEL), {
          size: F.LABEL,
          weight: "bold",
          color: C.TEXT_MUTED,
          align: alignRight ? "right" : "left",
        });
      });
      return yPos + ROW_H_BASE;
    };

    ty = renderTableHeader(ty);

    rows.forEach((row, rIdx) => {
      const cellValues = hdrs.map((h) => formatPdfValue(row[h]));
      const wrappedCells = cellValues.map((val, i) => wrap(val, colWidths[i] - CELL_PAD_X * 2));
      const maxLines = Math.max(1, ...wrappedCells.map((lines) => lines.length));
      const rowH = Math.max(ROW_H_BASE, maxLines * LH.SMALL + CELL_PAD_Y * 2);

      const pageBefore = doc.internal.getNumberOfPages();
      ensureSpace(rowH + 2);
      const pageAfter = doc.internal.getNumberOfPages();
      if (pageAfter > pageBefore) {
        ty = renderTableHeader(y);
      }

      // Alternating row zebra striping
      const rowBg = rIdx % 2 === 0 ? C.WHITE : C.BG_CARD;
      rect(M, ty, CW, rowH, rowBg);
      hline(M, ty + rowH, W - M, C.BORDER, 0.15);

      const cellBaseY = ty + CELL_PAD_Y + capH(F.SMALL);

      hdrs.forEach((h, i) => {
        const val = row[h];
        const cx = colX[i] + CELL_PAD_X;
        const hLow = h.toLowerCase();

        // Status Badge Pill
        if (hLow === "status" || hLow.includes("turnaround status") || hLow.includes("sla")) {
          const vStr = sanitizePdfText(val);
          const vLow = vStr.toLowerCase();

          const isGood = ["full", "good", "closed", "sent", "paid", "finalized", "on-time", "within target", "active", "resolved", "completed"].some((k) => vLow.includes(k));
          const isWarn = ["watch", "ready", "open", "pending", "partial", "at risk", "at-risk"].some((k) => vLow.includes(k));
          const isCrit = ["low", "overdue", "rejected", "canceled", "breached", "delayed", "critical", "vacant", "unpaid"].some((k) => vLow.includes(k));

          const pillBg = isGood ? C.EMERALD_BG : isWarn ? C.AMBER_BG : isCrit ? C.ROSE_BG : C.BG_CARD_ALT;
          const pillText = isGood ? C.EMERALD_TEXT : isWarn ? C.AMBER_TEXT : isCrit ? C.ROSE_TEXT : C.TEXT_MUTED;
          const pillBorder = isGood ? C.EMERALD_BORDER : isWarn ? C.AMBER_BORDER : isCrit ? C.ROSE_BORDER : C.BORDER;

          setFont(F.TINY, "bold", pillText);
          const tW = doc.getTextWidth(vStr);
          const pH = 4.2;
          const pW = Math.min(tW + 4.0, colWidths[i] - CELL_PAD_X * 2);
          const pX = cx;
          const pY = cellBaseY - capH(F.TINY) - 0.6;

          rect(pX, pY, pW, pH, pillBg, 1.0, pillBorder, 0.2);
          txt(vStr, pX + pW / 2, pY + pH / 2 + capH(F.TINY) / 2, {
            size: F.TINY,
            weight: "bold",
            color: pillText,
            align: "center",
          });
          return;
        }

        const alignRight = isNumericHeader(h);
        const textX = alignRight ? colX[i] + colWidths[i] - CELL_PAD_X : cx;
        const lines = wrappedCells[i];

        txt(lines, textX, cellBaseY, {
          size: F.SMALL,
          color: i === 0 ? C.TEXT_PRIMARY : C.TEXT_SECONDARY,
          lh: LH.SMALL,
          align: alignRight ? "right" : "left",
        });
      });

      ty += rowH;
    });

    return ty;
  }

  // ══════════════════════════════════════════════════════════
  // FOOTER RENDER (Across all pages)
  // ══════════════════════════════════════════════════════════

  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawFooter(p, totalPages);
  }

  doc.save(filename);
}