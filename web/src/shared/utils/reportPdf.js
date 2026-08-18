const defaultLogo = new URL("../../assets/images/LOGO.png", import.meta.url).href;

// ─────────────────────────────────────────────────────────────
// LILYCREST EXECUTIVE PDF DESIGN SYSTEM (Unit: mm unless noted)
// Aligned with /wf-color-objectives, /wf-frontend-overhaul, /wf-ui-redesign
// ─────────────────────────────────────────────────────────────

const C = {
  // Lilycrest Official Brand Colors
  NAVY_PRIMARY:    [ 10,  22,  40], // var(--color-primary) #0A1628
  NAVY_HOVER:      [ 19,  36,  61], // var(--color-primary-hover) #13243D
  GOLD_ACCENT:     [212, 175,  55], // var(--color-accent) #D4AF37
  GOLD_SUBTLE:     [251, 247, 234], // var(--color-accent-subtle) #FBF7EA

  // Slate Neutral Hierarchy
  TEXT_PRIMARY:    [ 10,  22,  40], // var(--text-heading) #0A1628
  TEXT_SECONDARY:  [ 30,  41,  59], // var(--text-body) #1E293B
  TEXT_MUTED:      [100, 116, 139], // var(--text-muted) #64748B
  TEXT_TERTIARY:   [148, 163, 184], // var(--text-secondary) #94A3B8

  // Surfaces & Clean 1px Neutral Borders
  BG_PAGE:         [255, 255, 255], // #FFFFFF
  BG_CARD:         [248, 250, 252], // var(--surface-card) #F8FAFC
  BG_HEADER:       [241, 245, 249], // var(--surface-muted) #F1F5F9
  BORDER:          [226, 232, 240], // var(--border-card) #E2E8F0
  BORDER_LIGHT:    [241, 245, 249], // var(--border-subtle) #F1F5F9

  // Semantic Status Colors (Real-World Objectives: Zero colored outlines)
  EMERALD_TEXT:    [  4, 120,  87], // text-emerald-700 #047857 (Active/Paid/Full/Resolved)
  EMERALD_DOT:     [ 16, 185, 129], // bg-emerald-500 #10B981
  EMERALD_BG:      [240, 253, 244], // #F0FDF4 Soft surface for action plans

  AMBER_TEXT:      [180,  83,   9], // text-amber-700 #B45309 (Pending/Partial/Review/At Risk)
  AMBER_DOT:       [245, 158,  11], // bg-amber-500 #F59E0B
  AMBER_BG:        [255, 251, 235], // #FFFBEB Soft surface for attention cards

  ROSE_TEXT:       [185,  28,  28], // text-rose-700 #B91C1C (Overdue/Breached/Critical)
  ROSE_DOT:        [239,  68,  68], // bg-rose-500 #EF4444

  SLATE_TEXT:      [ 71,  85, 105], // text-slate-600 #475569 (Vacant/Neutral/Draft)
  SLATE_DOT:       [148, 163, 184], // bg-slate-400 #94A3B8

  WHITE:           [255, 255, 255],
};

const F = {
  TITLE:   15,   // Document title
  SECTION: 10.5, // Section heading
  BODY:    8.8,  // Executive narrative body
  SMALL:   7.5,  // Table cells / bullets
  LABEL:   6.8,  // Card labels / table headers
  TINY:    6.5,  // Footers / metadata
};

const LH = {
  BODY:   4.5,
  SMALL:  3.8,
  BULLET: 4.2,
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
 * Replaces Unicode Peso symbol with "PHP", cleans formatting while preserving '+', '%', and punctuation.
 */
export const sanitizePdfText = (val) => {
  if (val == null) return "";
  let str = String(val);
  // Currency replacement
  str = str.replace(/₱/g, "PHP ");
  str = str.replace(/[\u20B1]/g, "PHP ");
  str = str.replace(/PHP\s+([0-9])/g, "PHP $1");
  // Arrows and trend indicators
  str = str.replace(/[\u2191\u25B2\u25B4]/g, "+");
  str = str.replace(/[\u2193\u25BC\u25BE]/g, "-");
  str = str.replace(/[\u2192\u25B6\u25BA]/g, ">");
  // Bullets, quotes, and dashes
  str = str
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[\u2022\u2023\u25E6\u2043\u2219]/g, "-")
    .replace(/[\u00B1]/g, "+-");
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
    if (typeof Image === "undefined" || typeof document === "undefined") return resolve(null);
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
    img.src = typeof src === "string" ? src : (typeof URL !== "undefined" && URL.createObjectURL ? URL.createObjectURL(src) : null);
  });

export const computeAutoColWidths = (hdrs = [], rows = [], printableW = 178) => {
  if (!hdrs || hdrs.length === 0) return [];
  if (hdrs.length === 1) return [printableW];

  const sampleRows = Array.isArray(rows) ? rows.slice(0, 15) : [];
  const weights = hdrs.map((h) => {
    const hStr = String(h || "");
    const hLen = hStr.length;
    const maxContentLen = sampleRows.reduce((max, r) => {
      const val = r && r[h] != null ? String(r[h]) : "";
      return Math.max(max, val.length);
    }, 0);
    const hLow = hStr.toLowerCase();

    let minW = 18;
    if (
      hLow.includes("date") ||
      hLow.includes("created") ||
      hLow.includes("move in") ||
      hLow.includes("submitted") ||
      hLow.includes("appointment") ||
      hLow.includes("effective")
    ) {
      minW = 23;
    } else if (
      hLow.includes("room") ||
      hLow.includes("tenant") ||
      hLow.includes("applicant") ||
      hLow.includes("name") ||
      hLow.includes("inquirer") ||
      hLow.includes("visitor")
    ) {
      minW = 26;
    } else if (hLow.includes("code") || hLow.includes("id") || hLow.includes("status")) {
      minW = 22;
    } else if (
      hLow.includes("message") ||
      hLow.includes("notes") ||
      hLow.includes("description") ||
      hLow.includes("title")
    ) {
      minW = 38;
    }

    return Math.max(minW, Math.max(hLen * 2.2, maxContentLen * 1.8));
  });

  const totalWeight = weights.reduce((a, b) => a + b, 0);
  return weights.map((w) => (w / totalWeight) * printableW);
};

export const computeKpiColumns = (count) => {
  if (count <= 3) return count || 1;
  if (count === 4) return 4;
  if (count === 5) return 5;
  if (count === 6) return 3; // Symmetrical 3x2 grid
  if (count % 3 === 0) return 3;
  return 4;
};

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

  const Y_START_PAGE1    = M + 2;
  const Y_START_CONT     = M + 10;
  const FOOTER_CLEARANCE = 18; // Keep 7mm buffer above footer line at H - 11

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
    if (y + needed > H - FOOTER_CLEARANCE) {
      doc.addPage();
      drawPageHeaderContinuation();
      y = Y_START_CONT;
      return true;
    }
    return false;
  };

  // ── Page chrome ──────────────────────────────────────────────

  // Lilycrest Official Dual-Tone Brand Stripe (Navy + Gold)
  const drawTopAccentBar = () => {
    rect(0, 0, W, 1.4, C.NAVY_PRIMARY);
    rect(0, 1.4, W, 0.6, C.GOLD_ACCENT);
  };

  const drawPageHeaderContinuation = () => {
    drawTopAccentBar();
    hline(M, M + 4, W - M, C.BORDER, 0.2);
    txt(sanitizePdfText(title), M, M + 2.5, {
      size: F.TINY + 0.5,
      weight: "bold",
      color: C.NAVY_PRIMARY,
    });
    txt(sanitizePdfText(reportType).toUpperCase(), W - M, M + 2.5, {
      size: F.TINY,
      weight: "bold",
      color: C.TEXT_MUTED,
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

  // Clean, high-contrast section heading
  const sectionTitle = (label, rightBadge = null) => {
    const cleanLabel = sanitizePdfText(label);
    ensureSpace(12);

    txt(cleanLabel, M, y + capH(F.SECTION), {
      size: F.SECTION,
      weight: "bold",
      color: C.NAVY_PRIMARY,
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
    color: C.NAVY_PRIMARY,
    maxW: titleTextW,
  });

  // Category Pill Badge (Clean 1px border, neutral surface, no gradients)
  const badgeY = y + (HEADER_H - badgeH) / 2;
  rect(badgeX, badgeY, badgeW, badgeH, C.BG_HEADER, 1.2, C.BORDER, 0.25);
  txt(sanitizePdfText(reportType).toUpperCase(), badgeX + badgeW / 2, badgeY + badgeH / 2 + capH(F.LABEL) / 2, {
    size: F.LABEL,
    weight: "bold",
    color: C.NAVY_PRIMARY,
    align: "center",
  });

  // Subtitle / Generation timestamp deduplication
  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const generatedLabel = `Generated ${dateStr}`;

  const cleanSubtitle = sanitizePdfText(subtitle);
  const cleanPeriod   = sanitizePdfText(period);

  const metaParts = [];
  if (cleanSubtitle) metaParts.push(cleanSubtitle);
  if (
    cleanPeriod &&
    cleanPeriod !== cleanSubtitle &&
    !cleanPeriod.toLowerCase().startsWith("generated") &&
    !cleanPeriod.toLowerCase().includes(dateStr.toLowerCase())
  ) {
    metaParts.push(cleanPeriod);
  }
  metaParts.push(generatedLabel);

  const metaLine = metaParts.join("   ·   ");
  const metaBaseY = titleBaseY + S.SM + metaLineH;
  if (metaLine) {
    txt(metaLine, titleX, metaBaseY, {
      size: F.TINY + 0.5,
      color: C.TEXT_MUTED,
      maxW: titleTextW,
    });
  }

  y = y + HEADER_H + S.MD;
  hline(M, y, W - M, C.BORDER, 0.25);
  y += S.LG;

  // ══════════════════════════════════════════════════════════
  // KPI METRICS GRID (Symmetrical distribution, dynamic height)
  // ══════════════════════════════════════════════════════════

  if (kpis.length > 0) {
    sectionTitle("Key Performance Indicators");

    const COLS = computeKpiColumns(kpis.length);
    const GAP  = S.MD;
    const CARD_W = (CW - GAP * (COLS - 1)) / COLS;
    const CARD_PAD_X = 2.8;
    const CARD_PAD_Y = 2.4;
    const TXT_W = CARD_W - CARD_PAD_X * 2;

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

    const hasAnySub = parsedKpis.some((k) => k.subLines && k.subLines.length > 0);
    // Dynamic height: Compact 17.5mm when no subtext, 22.0mm when subtext exists
    const CARD_H = hasAnySub ? 22.0 : 17.5;

    const rowsCount = Math.ceil(parsedKpis.length / COLS);
    const totalGridH = rowsCount * CARD_H + (rowsCount - 1) * GAP;
    ensureSpace(totalGridH + S.MD);

    parsedKpis.forEach((layout, i) => {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const cx  = M + col * (CARD_W + GAP);
      const cy  = y + row * (CARD_H + GAP);

      // Clean 1px solid neutral border, soft neutral background
      rect(cx, cy, CARD_W, CARD_H, C.BG_CARD, 1.5, C.BORDER, 0.25);

      // 1. Label (Uppercase, muted slate)
      const lblY = cy + CARD_PAD_Y + capH(F.LABEL);
      txt(layout.labelLines[0] || "", cx + CARD_PAD_X, lblY, {
        size: F.LABEL,
        weight: "bold",
        color: C.TEXT_MUTED,
      });

      // 2. Value (Bold, high-contrast Navy, vertically centered)
      const valY = hasAnySub
        ? cy + 8.5 + capH(layout.valSize)
        : cy + (CARD_H + capH(F.LABEL) + CARD_PAD_Y) / 2 + capH(layout.valSize) / 2 - 0.5;

      txt(layout.cleanVal, cx + CARD_PAD_X, valY, {
        size: layout.valSize,
        weight: "bold",
        color: C.NAVY_PRIMARY,
      });

      // 3. Subtitle / Trend (if present)
      if (layout.subLines.length > 0) {
        const subY = cy + 15.0 + capH(F.TINY);
        txt(layout.subLines.slice(0, 2), cx + CARD_PAD_X, subY, {
          size: F.TINY,
          color: C.TEXT_MUTED,
          lh: 3.2,
          maxW: TXT_W,
        });
      }
    });

    y += totalGridH + S.LG;
  }

  // ══════════════════════════════════════════════════════════
  // EXECUTIVE BRIEFING & AI SUMMARY
  // ══════════════════════════════════════════════════════════

  const hasAiContent = Boolean(
    aiInsight && (
      (aiInsight.summary && aiInsight.summary.trim().length > 0) ||
      (aiInsight.standout && aiInsight.standout.length > 0) ||
      (aiInsight.watch && aiInsight.watch.length > 0) ||
      (aiInsight.nextSteps && aiInsight.nextSteps.length > 0)
    )
  );

  if (hasAiContent) {
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
        color: C.NAVY_PRIMARY,
        lh: 4.8,
      });
      y += headLines.length * 4.8 + S.SM;
    }

    // Narrative summary paragraph (Clean left-aligned typography)
    if (aiInsight.summary && aiInsight.summary.trim().length > 0) {
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
          labelColor: C.NAVY_PRIMARY,
          dotColor: C.NAVY_PRIMARY,
        });
      }

      if (watchItems.length > 0) {
        drawBriefingCard(colR, y, colW, blockH, "Areas of Attention", watchItems, {
          bg: C.AMBER_BG,
          border: C.BORDER,
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

      rect(M, y, CW, stepsH, C.EMERALD_BG, 1.5, C.BORDER, 0.25);

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

  // ── renderListSection ───────────────────────────────────────

  function renderListSection(section, startY) {
    y = startY;
    const rows = section.rows || [];
    const bulletX = M + 2.0;
    const textX = M + 5.5;
    const textW = CW - 5.5;

    ensureSpace(12);

    rows.forEach((row) => {
      const cleanText = Array.isArray(row)
        ? row.map(sanitizePdfText).join(" ")
        : sanitizePdfText(row);
      const lines = wrap(cleanText, textW);
      const rowH = lines.length * LH.SMALL + 1.2;

      ensureSpace(rowH + 1);

      doc.setFillColor(...C.NAVY_PRIMARY);
      doc.circle(bulletX, y + capH(F.SMALL) * 0.5, 0.65, "F");

      txt(lines, textX, y + capH(F.SMALL), {
        size: F.SMALL,
        color: C.TEXT_SECONDARY,
        lh: LH.SMALL,
        maxW: textW,
      });

      y += rowH;
    });

    return y;
  }

  // ── renderTable ─────────────────────────────────────────────

  function renderTable(section, startY) {
    y = startY;
    const hdrs = section.headers || [];
    const rows = section.rows || [];

    const rawColWidths = section.colWidths || [];
    let colWidths = [];
    if (Array.isArray(rawColWidths) && rawColWidths.length === hdrs.length && rawColWidths.length > 0) {
      const rawSum = rawColWidths.reduce((a, b) => a + b, 0);
      colWidths = rawColWidths.map((w) => (w / rawSum) * CW);
    } else {
      colWidths = computeAutoColWidths(hdrs, rows, CW);
    }

    const colX = [];
    let acc = M;
    colWidths.forEach((w) => {
      colX.push(acc);
      acc += w;
    });

    const ROW_H_BASE = 7.5;
    const CELL_PAD_X = 2.0;
    const CELL_PAD_Y = 2.2;

    // Detect numeric, monetary, rate, and counter columns for right-alignment
    const isNumericHeader = (h) => {
      const key = String(h || "").toLowerCase();
      return (
        key.includes("capacity") ||
        key.includes("occupied") ||
        key.includes("available") ||
        key.includes("unavailable") ||
        key.includes("rate") ||
        key.includes("amount") ||
        key.includes("collected") ||
        key.includes("billed") ||
        key.includes("balance") ||
        key.includes("overdue") ||
        key.includes("revenue") ||
        key.includes("rent") ||
        key.includes("hours") ||
        key.includes("count") ||
        key.includes("tickets") ||
        key.includes("events") ||
        key.includes("inquiries") ||
        key.includes("leads") ||
        key.includes("viewings") ||
        key.includes("tenants") ||
        key.includes("total")
      );
    };

    const renderTableHeader = (yPos) => {
      rect(M, yPos, CW, ROW_H_BASE, C.BG_HEADER, 0, C.BORDER, 0.25);
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

    // Ensure space for header + at least 1-2 rows before starting table
    ensureSpace(ROW_H_BASE * 2);
    y = renderTableHeader(y);

    rows.forEach((row, rIdx) => {
      const cellValues = hdrs.map((h) => formatPdfValue(row[h]));
      const wrappedCells = cellValues.map((val, i) => wrap(val, colWidths[i] - CELL_PAD_X * 2));
      const maxLines = Math.max(1, ...wrappedCells.map((lines) => lines.length));
      const rowH = Math.max(ROW_H_BASE, maxLines * LH.SMALL + CELL_PAD_Y * 2);

      // Trigger multi-page pagination with repeated table header
      if (y + rowH > H - FOOTER_CLEARANCE) {
        doc.addPage();
        drawPageHeaderContinuation();
        y = Y_START_CONT;
        y = renderTableHeader(y);
      }

      // Alternating row zebra striping
      const rowBg = rIdx % 2 === 0 ? C.WHITE : C.BG_CARD;
      rect(M, y, CW, rowH, rowBg);
      hline(M, y + rowH, W - M, C.BORDER, 0.15);

      const cellBaseY = y + CELL_PAD_Y + capH(F.SMALL);

      hdrs.forEach((h, i) => {
        const val = row[h];
        const cx = colX[i] + CELL_PAD_X;
        const hLow = h.toLowerCase();

        // Status Badge: Strict Invariant
        // Transparent background + colored status dot + semantic text (Strictly ZERO matching colored border outlines)
        if (hLow === "status" || hLow.includes("turnaround status") || hLow.includes("sla")) {
          const vStr = sanitizePdfText(val);
          const vLow = vStr.toLowerCase();

          const isGood = ["full", "good", "closed", "sent", "paid", "finalized", "on-time", "within target", "active", "resolved", "completed"].some((k) => vLow.includes(k));
          const isWarn = ["watch", "ready", "open", "pending", "partial", "at risk", "at-risk"].some((k) => vLow.includes(k));
          const isCrit = ["low", "overdue", "rejected", "canceled", "breached", "delayed", "critical", "unpaid"].some((k) => vLow.includes(k));

          const dotColor = isGood ? C.EMERALD_DOT : isWarn ? C.AMBER_DOT : isCrit ? C.ROSE_DOT : C.SLATE_DOT;
          const textColor = isGood ? C.EMERALD_TEXT : isWarn ? C.AMBER_TEXT : isCrit ? C.ROSE_TEXT : C.SLATE_TEXT;

          // Draw semantic status dot
          doc.setFillColor(...dotColor);
          doc.circle(cx + 1.2, cellBaseY - capH(F.SMALL) * 0.35, 0.75, "F");

          // Draw semantic text label (No colored border outline)
          txt(vStr, cx + 3.4, cellBaseY, {
            size: F.SMALL,
            weight: "bold",
            color: textColor,
            align: "left",
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

      y += rowH;
    });

    return y;
  }

  sections.forEach((section) => {
    ensureSpace(25);

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

  // ══════════════════════════════════════════════════════════
  // FOOTER RENDER (Across all generated pages)
  // ══════════════════════════════════════════════════════════

  const totalPages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawFooter(p, totalPages);
  }

  doc.save(filename);
  return doc;
}