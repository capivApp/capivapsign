import { createHash } from 'node:crypto';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

import { degrees, type PDF, rgb } from '@libpdf/core';
import sharp from 'sharp';

/**
 * Draws the CapivaSign verification mark on every page of `pdfDoc`: a compact
 * 250×50 card with the brand / white-label logo and the document's SHA-256 hash
 * as a clickable link to the public verification page.
 *
 * Positions: FOOTER / HEADER (horizontal bands), LEFT / RIGHT (rotated 90° on
 * the edge), or CUSTOM (free placement at `customX`/`customY`, percentages of
 * the page from the top-left — the sender drags it in the editor).
 *
 * MUST run BEFORE any PAdES signature (send-time `materializeTspAnchorsForEnvelope`).
 * Drawing onto the page content stream after a signature would invalidate its
 * `/ByteRange`; run pre-signature it simply becomes part of the signed content.
 */
export type PageStampPosition = 'FOOTER' | 'HEADER' | 'LEFT' | 'RIGHT' | 'CUSTOM';

export type StampBrandMarkOptions = {
  position: PageStampPosition;
  /** Public verification URL the mark links to, e.g. `/share/{qrToken}`. */
  verifyUrl: string;
  /** Bytes to hash for the integrity line (the pre-signature document). */
  documentBytes: Uint8Array;
  /** White-label logo bytes; falls back to the bundled CapivaSign icon. */
  logoBytes?: Uint8Array;
  /** CUSTOM placement — percentages (0–100) of the page, top-left origin. */
  customX?: number;
  customY?: number;
  /**
   * Per-page position overrides (1-based page number → top-left %). A page with
   * an override is placed there regardless of `position`; pages without one use
   * `position`. Lets the sender drag the mark independently on each page.
   */
  overridesByPage?: Map<number, { x: number; y: number }>;
};

const DEFAULT_LOGO_PATH = () => createRequire(import.meta.url).resolve('@documenso/assets/logo_icon.png');

// Mark size, in points.
export const MARK_WIDTH = 250;
export const MARK_HEIGHT = 50;
const PAGE_MARGIN = 12;

const LINK_COLOR = rgb(0.23, 0.23, 0.72);
const MUTED_COLOR = rgb(0.45, 0.45, 0.45);

export const stampBrandMarkOnAllPages = async (pdfDoc: PDF, opts: StampBrandMarkOptions): Promise<void> => {
  const { position, verifyUrl } = opts;
  const fileHash = createHash('sha256').update(Buffer.from(opts.documentBytes)).digest('hex');

  const source = opts.logoBytes ? Buffer.from(opts.logoBytes) : fs.readFileSync(resolveDefaultLogoPath());
  const logoPng = await sharp(source).resize(128, 128, { fit: 'inside' }).png().toBuffer();
  const logo = pdfDoc.embedImage(new Uint8Array(logoPng));

  for (let i = 0; i < pdfDoc.getPageCount(); i++) {
    const page = pdfDoc.getPage(i);

    if (!page) {
      continue;
    }

    // A per-page override (sender dragged the mark on this page) wins over the
    // document-wide preset and is treated as a CUSTOM placement.
    const override = opts.overridesByPage?.get(i + 1);
    const { x, y, rotate } = override
      ? placement('CUSTOM', page.width, page.height, override.x, override.y)
      : placement(position, page.width, page.height, opts.customX, opts.customY);

    drawMark(page, logo, fileHash, verifyUrl, x, y, rotate);
  }
};

const resolveDefaultLogoPath = (): string => {
  try {
    return DEFAULT_LOGO_PATH();
  } catch {
    const candidates = [
      path.join(process.cwd(), 'packages/assets/logo_icon.png'),
      path.join(process.cwd(), '../../packages/assets/logo_icon.png'),
    ];
    const found = candidates.find((candidate) => fs.existsSync(candidate));

    if (!found) {
      throw new Error('CapivaSign logo_icon.png could not be resolved.');
    }

    return found;
  }
};

/** Bottom-left anchor (PDF coords) + rotation for the mark, by position. */
const placement = (
  position: PageStampPosition,
  pageWidth: number,
  pageHeight: number,
  customX?: number,
  customY?: number,
): { x: number; y: number; rotate: number } => {
  if (position === 'CUSTOM') {
    // Percentages from the top-left (field convention) → PDF bottom-left origin.
    const left = ((customX ?? 0) / 100) * pageWidth;
    const top = ((customY ?? 0) / 100) * pageHeight;
    const x = Math.max(0, Math.min(left, pageWidth - MARK_WIDTH));
    const y = Math.max(0, Math.min(pageHeight - top - MARK_HEIGHT, pageHeight - MARK_HEIGHT));
    return { x, y, rotate: 0 };
  }

  if (position === 'HEADER') {
    return { x: (pageWidth - MARK_WIDTH) / 2, y: pageHeight - PAGE_MARGIN - MARK_HEIGHT, rotate: 0 };
  }

  if (position === 'LEFT') {
    // Rotated 90° CCW; the rotated box occupies a MARK_HEIGHT-wide left strip.
    return { x: PAGE_MARGIN + MARK_HEIGHT, y: (pageHeight - MARK_WIDTH) / 2, rotate: 90 };
  }

  if (position === 'RIGHT') {
    return { x: pageWidth - PAGE_MARGIN, y: (pageHeight - MARK_WIDTH) / 2, rotate: 90 };
  }

  // FOOTER (default).
  return { x: (pageWidth - MARK_WIDTH) / 2, y: PAGE_MARGIN, rotate: 0 };
};

type DrawablePage = {
  drawImage: (image: unknown, options: Record<string, unknown>) => void;
  drawText: (text: string, options: Record<string, unknown>) => void;
  drawRectangle: (options: Record<string, unknown>) => void;
  addLinkAnnotation: (options: Record<string, unknown>) => unknown;
};

/**
 * Draw the 250×50 mark with its bottom-left corner at (x, y). For rotated
 * placements the whole mark is rotated about (x, y); the clickable link
 * annotation covers the mark's axis-aligned bounding box.
 */
const drawMark = (
  page: unknown,
  logo: unknown,
  fileHash: string,
  verifyUrl: string,
  x: number,
  y: number,
  rotate: number,
) => {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const p = page as DrawablePage;
  const rot = rotate ? { rotate: degrees(rotate) } : {};
  const pad = 8;
  const logoH = MARK_HEIGHT - pad * 2;

  p.drawRectangle({
    x,
    y,
    width: MARK_WIDTH,
    height: MARK_HEIGHT,
    color: rgb(1, 1, 1),
    borderColor: rgb(0.8, 0.85, 0.9),
    borderWidth: 1,
    ...rot,
  });
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  p.drawImage(logo, { x: x + pad, y: y + pad, width: logoH, height: logoH, ...rot });

  const textX = x + pad + logoH + pad;
  p.drawText('Documento assinado · verificar:', {
    x: textX,
    y: y + MARK_HEIGHT - pad - 9,
    size: 7,
    color: MUTED_COLOR,
    ...rot,
  });
  p.drawText(`SHA-256: ${fileHash.slice(0, 24)}…`, { x: textX, y: y + pad + 2, size: 7, color: LINK_COLOR, ...rot });

  // The whole mark is the clickable link to the verification page. For rotated
  // marks the annotation covers the rotated bounding box.
  const rect =
    rotate === 90
      ? { x: x - MARK_HEIGHT, y, width: MARK_HEIGHT, height: MARK_WIDTH }
      : { x, y, width: MARK_WIDTH, height: MARK_HEIGHT };
  p.addLinkAnnotation({ rect, uri: verifyUrl });
};
