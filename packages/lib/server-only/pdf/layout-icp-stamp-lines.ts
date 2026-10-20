export const LINE_HEIGHT = 1.15;

const LINE_GAP_RATIO = 0.03;
const MIN_FONT_SIZE = 3;

export type IcpStampLine = {
  text: string;
  /** Preferred font size as a fraction of the stamp height. */
  sizeRatio: number;
  fontStyle?: 'normal' | 'bold';
};

export type LayoutIcpStampLinesOptions = {
  lines: IcpStampLine[];
  textWidth: number;
  height: number;
  pad: number;
  measureWidth: (line: IcpStampLine, fontSize: number) => number;
};

export type PlacedIcpStampLine = { fontSize: number; y: number };

// Glyph widths do not scale perfectly linearly with the font size, so a line
// shrunk to the exact width can still overflow by a fraction of a point and
// get cut with an ellipsis. Aim slightly inside the box.
const WIDTH_SAFETY = 0.95;

// One row per line: a line too wide for the stamp gets a smaller font instead
// of wrapping, since a wrapped line would run into the one below it.
const fitToWidth = (line: IcpStampLine, { textWidth, height, measureWidth }: LayoutIcpStampLinesOptions) => {
  const preferred = Math.max(MIN_FONT_SIZE, height * line.sizeRatio);
  const width = measureWidth(line, preferred);
  const targetWidth = textWidth * WIDTH_SAFETY;

  return width > targetWidth ? Math.max(MIN_FONT_SIZE, (preferred * targetWidth) / width) : preferred;
};

/**
 * Font size and top offset of each stamp line, stacked without overlap,
 * shrunk as a block when the stamp is too short, and centred vertically.
 */
export const layoutIcpStampLines = (options: LayoutIcpStampLinesOptions): PlacedIcpStampLine[] => {
  const { lines, height, pad } = options;

  const available = height - pad * 2;
  const fontSizes = lines.map((line) => fitToWidth(line, options));
  const gap = height * LINE_GAP_RATIO;

  const naturalHeight = fontSizes.reduce((sum, size) => sum + size * LINE_HEIGHT, 0) + gap * (lines.length - 1);
  const scale = Math.min(1, available / naturalHeight);

  let y = pad + (available - naturalHeight * scale) / 2;

  return fontSizes.map((size) => {
    const fontSize = size * scale;
    const placed = { fontSize, y };

    y += fontSize * LINE_HEIGHT + gap * scale;

    return placed;
  });
};
