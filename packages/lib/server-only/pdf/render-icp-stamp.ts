import Konva from 'konva';
import 'konva/skia-backend';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import sharp from 'sharp';
import type { Canvas } from 'skia-canvas';
import { Image as SkiaImage } from 'skia-canvas';

import { ensureFontLibrary } from './helpers';

/**
 * Renders the ICP-Brasil signature stamp ("Assinado eletronicamente por …") for
 * one page into a page-sized overlay PDF, which the caller injects into the
 * recipient's pre-allocated `/Stamp` annotation (see `injectOverlayIntoStamp`).
 *
 * The stamp is a boxed card placed at each SIGNATURE field's rect: the brand /
 * white-label logo on the left, then the holder name, the recipient role and
 * the signing date. Field geometry is the CapivaSign convention — positionX/Y/
 * width/height as percentages (0–100) of the page, Konva top-left origin.
 */
export type IcpStampFieldRect = {
  positionX: number;
  positionY: number;
  width: number;
  height: number;
};

export type BuildIcpStampOverlayOptions = {
  pageWidth: number;
  pageHeight: number;
  fields: IcpStampFieldRect[];
  signerName: string;
  roleLabel: string;
  dateText: string;
  /** White-label logo bytes; falls back to the bundled CapivaSign icon. */
  logoBytes?: Uint8Array;
};

const GRAY = '#6b7280';
const DARK = '#111827';
const BORDER = '#cbd5e1';
const PRIMARY = '#3b3bd6';

const loadLogoImage = async (logoBytes?: Uint8Array): Promise<SkiaImage> => {
  const raw = logoBytes
    ? Buffer.from(logoBytes)
    : fs.readFileSync(createRequire(import.meta.url).resolve('@documenso/assets/logo_icon.png'));

  // Downscale (the source icon is ~1024²) so the overlay — which becomes the
  // stamp appearance — stays a few KB instead of ~900KB per page.
  const png = await sharp(raw).resize(128, 128, { fit: 'inside' }).png().toBuffer();

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return new SkiaImage(png) as unknown as SkiaImage;
};

export const buildIcpStampOverlay = async (options: BuildIcpStampOverlayOptions): Promise<Uint8Array> => {
  ensureFontLibrary();

  const { pageWidth, pageHeight, fields, signerName, roleLabel, dateText } = options;

  const stage = new Konva.Stage({ width: pageWidth, height: pageHeight });
  const layer = new Konva.Layer();
  const logo = await loadLogoImage(options.logoBytes);
  const logoRatio = logo.width && logo.height ? logo.width / logo.height : 1;

  for (const field of fields) {
    const x = pageWidth * (Number(field.positionX) / 100);
    const y = pageHeight * (Number(field.positionY) / 100);
    const w = pageWidth * (Number(field.width) / 100);
    const h = pageHeight * (Number(field.height) / 100);

    const pad = Math.max(3, h * 0.08);
    const logoH = h - pad * 2;
    const logoW = Math.min(w * 0.3, logoH * logoRatio);
    const textX = pad + logoW + pad;
    const textW = Math.max(10, w - textX - pad);

    const group = new Konva.Group({ x, y });

    group.add(
      new Konva.Rect({
        x: 0,
        y: 0,
        width: w,
        height: h,
        fill: '#ffffff',
        stroke: BORDER,
        strokeWidth: 1,
        cornerRadius: Math.min(8, h * 0.12),
      }),
    );

    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    group.add(
      new Konva.Image({
        image: logo as unknown as HTMLImageElement,
        x: pad,
        y: pad + (logoH - logoW / logoRatio) / 2,
        width: logoW,
        height: logoW / logoRatio,
      }),
    );

    group.add(
      new Konva.Text({
        x: textX,
        y: pad,
        width: textW,
        text: 'Assinado eletronicamente por',
        fontFamily: 'Inter',
        fontSize: Math.max(5, h * 0.15),
        fill: GRAY,
      }),
    );
    group.add(
      new Konva.Text({
        x: textX,
        y: pad + h * 0.2,
        width: textW,
        text: signerName,
        fontFamily: 'Inter',
        fontStyle: 'bold',
        fontSize: Math.max(6, h * 0.2),
        fill: DARK,
        ellipsis: true,
        wrap: 'none',
      }),
    );
    group.add(
      new Konva.Text({
        x: textX,
        y: pad + h * 0.47,
        width: textW,
        text: roleLabel,
        fontFamily: 'Inter',
        fontSize: Math.max(5, h * 0.14),
        fill: PRIMARY,
      }),
    );
    group.add(
      new Konva.Text({
        x: textX,
        y: pad + h * 0.66,
        width: textW,
        text: dateText,
        fontFamily: 'Inter',
        fontSize: Math.max(5, h * 0.14),
        fill: GRAY,
      }),
    );

    layer.add(group);
  }

  stage.add(layer);

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const canvas = layer.canvas._canvas as unknown as Canvas;
  const pdf = await canvas.toBuffer('pdf');

  stage.destroy();
  layer.destroy();

  return new Uint8Array(pdf);
};
