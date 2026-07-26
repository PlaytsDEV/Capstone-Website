import { rgb } from "pdf-lib";

export const PREPARED_COPY_LABEL =
  "PREPARED COPY — NOT YET SIGNED OR NOTARIZED";

const overflowError = (fieldName, value, config) => {
  const error = new Error(`The value for ${fieldName} cannot fit safely in the official template.`);
  error.code = config.overflowCode || "CONTRACT_FIELD_OVERFLOW";
  error.statusCode = 422;
  error.details = {
    field: fieldName,
    valueLength: String(value ?? "").length,
    width: config.width,
    minimumFontSize: config.minimumFontSize ?? config.minFontSize,
  };
  return error;
};

export const fitSingleLineText = (font, value, config, fieldName) => {
  const text = String(value ?? "").trim();
  const preferredFontSize = config.preferredFontSize ?? config.fontSize;
  const minimumFontSize = config.minimumFontSize ?? config.minFontSize;
  if (!text) return { text: "", fontSize: preferredFontSize, width: 0 };
  for (
    let size = preferredFontSize;
    size >= minimumFontSize;
    size = Math.round((size - 0.25) * 100) / 100
  ) {
    const width = font.widthOfTextAtSize(text, size);
    if (width <= config.width) return { text, fontSize: size, width };
  }
  throw overflowError(fieldName, text, config);
};

const fitTextLines = (font, value, config, fieldName) => {
  if ((config.maximumLines || 1) === 1) {
    const fitted = fitSingleLineText(font, value, config, fieldName);
    return { ...fitted, lines: [fitted.text] };
  }
  const text = String(value ?? "").trim();
  const preferred = config.preferredFontSize ?? config.fontSize;
  const minimum = config.minimumFontSize ?? config.minFontSize;
  for (let size = preferred; size >= minimum; size = Math.round((size - 0.25) * 100) / 100) {
    const lines = [];
    for (const word of text.split(/\s+/)) {
      const candidate = lines.length ? `${lines.at(-1)} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= config.width) {
        if (lines.length) lines[lines.length - 1] = candidate;
        else lines.push(candidate);
      } else {
        if (font.widthOfTextAtSize(word, size) > config.width) {
          lines.length = config.maximumLines + 1;
          break;
        }
        lines.push(word);
      }
    }
    const fontHeight = font.heightAtSize(size, { descender: false });
    const totalHeight = fontHeight + (lines.length - 1) * (config.lineHeight || fontHeight);
    if (lines.length <= config.maximumLines && totalHeight <= config.height) {
      return {
        text,
        lines,
        fontSize: size,
        width: Math.max(0, ...lines.map((line) => font.widthOfTextAtSize(line, size))),
      };
    }
  }
  throw overflowError(fieldName, text, config);
};

const resolveFont = (fonts, config) =>
  config.fontWeight === "bold" ? fonts.bold : fonts.regular;

export const drawTextInsideFieldBox = ({
  page,
  fonts,
  fieldName,
  value,
  config,
  erase = true,
  debug = false,
}) => {
  const font = resolveFont(fonts, config);
  const fitted = fitTextLines(font, value, config, fieldName);
  if (erase) {
    const padding = config.erasePadding ?? 1;
    page.drawRectangle({
      x: config.x - padding,
      y: config.y - padding,
      width: config.width + padding * 2,
      height: config.height + padding * 2,
      color: rgb(1, 1, 1),
    });
    if (debug) {
      page.drawRectangle({
        x: config.x - padding,
        y: config.y - padding,
        width: config.width + padding * 2,
        height: config.height + padding * 2,
        borderColor: rgb(0.9, 0.1, 0.1),
        borderWidth: 0.5,
        color: rgb(1, 0.85, 0.85),
        opacity: 0.22,
      });
    }
  }
  if (!fitted.text) return fitted;
  const fontHeight = font.heightAtSize(fitted.fontSize, { descender: false });
  const lineHeight = config.lineHeight || fontHeight;
  const totalHeight = fontHeight + (fitted.lines.length - 1) * lineHeight;
  const baselineY = config.y + ((config.height - totalHeight) / 2)
    + (fitted.lines.length - 1) * lineHeight + (config.verticalOffset || 0);
  const positions = fitted.lines.map((line, index) => {
    const width = font.widthOfTextAtSize(line, fitted.fontSize);
    const x = config.horizontalAlignment === "left" || config.alignment === "left"
      ? config.x
      : config.horizontalAlignment === "right" || config.alignment === "right"
        ? config.x + config.width - width
        : config.x + (config.width - width) / 2;
    const y = baselineY - index * lineHeight;
    page.drawText(line, { x, y, size: fitted.fontSize, font, color: rgb(0, 0, 0) });
    return { text: line, x, y, width };
  });
  if (debug) {
    page.drawLine({
      start: { x: config.x, y: baselineY },
      end: { x: config.x + config.width, y: baselineY },
      thickness: 0.4,
      color: rgb(0, 0.25, 1),
      opacity: 0.8,
    });
    page.drawText(fieldName, {
      x: config.x,
      y: config.y + config.height + 1,
      size: 4,
      font: fonts.regular,
      color: rgb(0.75, 0, 0.75),
    });
  }
  return {
    ...fitted,
    x: positions[0]?.x,
    baselineY,
    positions,
    fontWeight: config.fontWeight,
  };
};

export const drawFittedField = drawTextInsideFieldBox;
