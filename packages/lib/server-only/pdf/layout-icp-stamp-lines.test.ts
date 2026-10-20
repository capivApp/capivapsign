import { describe, expect, it } from 'vitest';

import { type IcpStampLine, LINE_HEIGHT, layoutIcpStampLines } from './layout-icp-stamp-lines';

// Monospace-like stand-in for real font metrics.
const measureWidth = (line: IcpStampLine, fontSize: number) => line.text.length * fontSize * 0.55;

const LINES: IcpStampLine[] = [
  { text: 'Assinado eletronicamente por', sizeRatio: 0.15 },
  { text: 'CAPIVAPP LTDA', sizeRatio: 0.2 },
  { text: 'Signatário', sizeRatio: 0.14 },
  { text: '20/10/2026 13:50', sizeRatio: 0.14 },
];

const layout = (width: number, height: number) =>
  layoutIcpStampLines({ lines: LINES, textWidth: width, height, pad: 6, measureWidth });

const expectNoOverlap = (placed: ReturnType<typeof layout>) => {
  placed.slice(1).forEach((line, index) => {
    const previous = placed[index];

    expect(line.y).toBeGreaterThanOrEqual(previous.y + previous.fontSize * LINE_HEIGHT - 0.001);
  });
};

describe('layoutIcpStampLines', () => {
  it('keeps every line on its own row in a narrow stamp', () => {
    const placed = layout(110, 90);

    expectNoOverlap(placed);
  });

  it('shrinks a line that does not fit the width instead of wrapping it', () => {
    const placed = layout(110, 90);

    placed.forEach((line, index) => {
      expect(measureWidth(LINES[index], line.fontSize)).toBeLessThanOrEqual(110 + 0.001);
    });
  });

  it('keeps the whole block inside the stamp, even when it is short', () => {
    const placed = layout(300, 40);
    const last = placed[placed.length - 1];

    expectNoOverlap(placed);
    expect(placed[0].y).toBeGreaterThanOrEqual(6 - 0.001);
    expect(last.y + last.fontSize * LINE_HEIGHT).toBeLessThanOrEqual(40 - 6 + 0.001);
  });

  it('centres the block vertically when there is room', () => {
    const placed = layout(400, 200);
    const last = placed[placed.length - 1];

    const top = placed[0].y;
    const bottom = 200 - (last.y + last.fontSize * LINE_HEIGHT);

    expect(Math.abs(top - bottom)).toBeLessThan(0.5);
  });
});
