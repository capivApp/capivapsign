import Konva from 'konva';
import 'konva/skia-backend';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import sharp from 'sharp';
import type { Canvas } from 'skia-canvas';
import { Image as SkiaImage } from 'skia-canvas';
import { renderSVG } from 'uqr';

import { svgToPng } from '../../utils/images/svg-to-png';
import { ensureFontLibrary } from './helpers';

/**
 * Renders the ICP-Brasil "Relatório de auditoria e validação de assinaturas
 * eletrônicas" page into a single page-sized PDF (Autentique-style report).
 *
 * Self-contained: every value it shows is known before the document is sealed
 * (identifier, public verification URL, original SHA-256, signer identities +
 * their events), so the page can be baked into the SIGNED content (at `prepare`)
 * and the ITI validator sees no post-signature visual modification.
 */

export type IcpAuditSigner = {
  name: string;
  email: string;
  cpfCnpj: string | null;
  roleLabel: string;
  status: 'signed' | 'pending';
  /** Pre-formatted, e.g. "25/06/2026 19:44". */
  signedAt?: string | null;
  certIssuer?: string | null;
  ipAddress?: string | null;
  device?: string | null;
  sentAt?: string | null;
  viewedAt?: string | null;
};

export type BuildIcpAuditPageOptions = {
  pageWidth: number;
  pageHeight: number;
  /** Document identifier shown in the header (the public verification token). */
  identifier: string;
  /** Pre-formatted generation timestamp, e.g. "Data/Hora 25/06/2026 19:45 BRT". */
  generatedAtText: string;
  /** Public verification URL (also encoded into the QR code). */
  verifyUrl: string;
  /** Hex SHA-256 of the original (pre-signature) document. */
  documentHashHex: string;
  /** Brand name shown as the authentication provider, e.g. "CapivaSign". */
  brandName: string;
  signers: IcpAuditSigner[];
  /** White-label logo bytes; falls back to the bundled CapivaSign logo. */
  logoBytes?: Uint8Array;
};

const INK = '#0f172a';
const MUTED = '#64748b';
const FAINT = '#94a3b8';
const PRIMARY = '#2563eb';
const BORDER = '#e2e8f0';
const PANEL = '#f8fafc';
const GREEN = '#16a34a';
const FONT = 'Inter';

const loadLogo = async (logoBytes?: Uint8Array): Promise<SkiaImage> => {
  const raw = logoBytes
    ? Buffer.from(logoBytes)
    : fs.readFileSync(createRequire(import.meta.url).resolve('@documenso/assets/logo.png'));
  const png = await sharp(raw).resize(320, 130, { fit: 'inside' }).png().toBuffer();
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return new SkiaImage(png) as unknown as SkiaImage;
};

const loadQr = async (url: string): Promise<SkiaImage> => {
  const png = await svgToPng(renderSVG(url, { ecc: 'M' }));
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  return new SkiaImage(png) as unknown as SkiaImage;
};

export const buildIcpAuditPagePdf = async (options: BuildIcpAuditPageOptions): Promise<Uint8Array> => {
  ensureFontLibrary();

  const { pageWidth, pageHeight } = options;
  const margin = 48;
  const contentWidth = pageWidth - margin * 2;

  const stage = new Konva.Stage({ width: pageWidth, height: pageHeight });
  const layer = new Konva.Layer();

  layer.add(new Konva.Rect({ x: 0, y: 0, width: pageWidth, height: pageHeight, fill: '#ffffff' }));

  const [logo, qr] = await Promise.all([loadLogo(options.logoBytes), loadQr(options.verifyUrl)]);

  // ---- Header: logo (left) + identifier / date / provider (right) ----------
  const logoRatio = logo.width && logo.height ? logo.width / logo.height : 3;
  const logoH = 34;
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  layer.add(
    new Konva.Image({
      image: logo as unknown as HTMLImageElement,
      x: margin,
      y: margin,
      height: logoH,
      width: logoH * logoRatio,
    }),
  );

  const headerRight = (text: string, y: number, bold = false) =>
    layer.add(
      new Konva.Text({
        x: margin,
        y,
        width: contentWidth,
        align: 'right',
        text,
        fontFamily: FONT,
        fontStyle: bold ? 'bold' : 'normal',
        fontSize: 9,
        fill: bold ? INK : MUTED,
      }),
    );

  headerRight(`Identificador: ${options.identifier}`, margin, true);
  headerRight(options.generatedAtText, margin + 14);
  headerRight(`Autenticação eletrônica por ${options.brandName}`, margin + 27);

  // ---- Title ----------------------------------------------------------------
  layer.add(
    new Konva.Text({
      x: margin,
      y: margin + 70,
      width: contentWidth,
      align: 'center',
      text: 'Relatório de auditoria e validação de assinaturas eletrônicas',
      fontFamily: FONT,
      fontStyle: 'bold',
      fontSize: 19,
      fill: INK,
    }),
  );

  // ---- Left column: QR + hash ----------------------------------------------
  const colTop = margin + 130;
  const qrSize = 168;
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  layer.add(
    new Konva.Image({ image: qr as unknown as HTMLImageElement, x: margin, y: colTop, width: qrSize, height: qrSize }),
  );

  layer.add(
    new Konva.Text({
      x: margin,
      y: colTop + qrSize + 10,
      width: qrSize,
      align: 'center',
      text: 'Hash SHA-256 do original',
      fontFamily: FONT,
      fontSize: 8,
      fill: FAINT,
    }),
  );
  layer.add(
    new Konva.Text({
      x: margin,
      y: colTop + qrSize + 22,
      width: qrSize,
      align: 'center',
      text: options.documentHashHex,
      fontFamily: FONT,
      fontSize: 7,
      lineHeight: 1.35,
      fill: MUTED,
    }),
  );

  // ---- Right column: URL + compliance + info blocks ------------------------
  const rightX = margin + qrSize + 28;
  const rightW = pageWidth - margin - rightX;
  let y = colTop;

  // Verification URL panel.
  layer.add(
    new Konva.Rect({
      x: rightX,
      y,
      width: rightW,
      height: 46,
      fill: PANEL,
      stroke: BORDER,
      strokeWidth: 1,
      cornerRadius: 6,
    }),
  );
  layer.add(
    new Konva.Text({
      x: rightX + 12,
      y: y + 8,
      width: rightW - 24,
      text: 'URL pública de verificação de integridade e autenticidade',
      fontFamily: FONT,
      fontSize: 8.5,
      fill: MUTED,
    }),
  );
  layer.add(
    new Konva.Text({
      x: rightX + 12,
      y: y + 24,
      width: rightW - 24,
      text: options.verifyUrl,
      fontFamily: FONT,
      fontStyle: 'bold',
      fontSize: 9,
      fill: PRIMARY,
      ellipsis: true,
      wrap: 'none',
    }),
  );
  y += 58;

  layer.add(
    new Konva.Text({
      x: rightX,
      y,
      width: rightW,
      text: 'Assinaturas eletrônicas realizadas em conformidade com a Lei nº 14.063/2020 e Regulamento (UE) nº 910/2014 (eIDAS).',
      fontFamily: FONT,
      fontSize: 8.5,
      fill: MUTED,
      lineHeight: 1.4,
    }),
  );
  y += 34;

  const infoBlock = (title: string, body: string, accent: string, badge: string) => {
    const blockH = 78;
    layer.add(
      new Konva.Rect({
        x: rightX,
        y,
        width: rightW,
        height: blockH,
        fill: PANEL,
        stroke: BORDER,
        strokeWidth: 1,
        cornerRadius: 6,
      }),
    );
    layer.add(new Konva.Rect({ x: rightX, y, width: 4, height: blockH, fill: accent, cornerRadius: 6 }));
    layer.add(
      new Konva.Text({
        x: rightX + 16,
        y: y + 10,
        width: rightW - 28,
        text: badge,
        fontFamily: FONT,
        fontStyle: 'bold',
        fontSize: 8,
        fill: accent,
      }),
    );
    layer.add(
      new Konva.Text({
        x: rightX + 16,
        y: y + 22,
        width: rightW - 28,
        text: title,
        fontFamily: FONT,
        fontStyle: 'bold',
        fontSize: 10.5,
        fill: INK,
      }),
    );
    layer.add(
      new Konva.Text({
        x: rightX + 16,
        y: y + 38,
        width: rightW - 28,
        text: body,
        fontFamily: FONT,
        fontSize: 8,
        fill: MUTED,
        lineHeight: 1.4,
      }),
    );
    y += blockH + 12;
  };

  infoBlock(
    'Este documento contém assinaturas qualificadas',
    'O arquivo foi assinado no padrão PAdES, incorporando os certificados digitais e as evidências criptográficas utilizadas no processo de assinatura.',
    PRIMARY,
    'PAdES',
  );
  infoBlock(
    'Este documento foi assinado com certificados ICP-Brasil',
    'Possui assinaturas realizadas com certificados da cadeia ICP-Brasil. O arquivo mantém a integridade do conteúdo original e incorpora os certificados e evidências criptográficas.',
    GREEN,
    'ICP-Brasil',
  );

  // ---- Signers --------------------------------------------------------------
  let sy = Math.max(y, colTop + qrSize + 60) + 6;

  layer.add(
    new Konva.Text({
      x: margin,
      y: sy,
      width: contentWidth,
      text: 'Assinaturas',
      fontFamily: FONT,
      fontStyle: 'bold',
      fontSize: 12,
      fill: INK,
    }),
  );
  sy += 22;

  for (const signer of options.signers) {
    const isSigned = signer.status === 'signed';
    // Signed cards carry the full event log; identity-only cards are compact.
    const cardH = isSigned ? 92 : 44;

    if (sy + cardH > pageHeight - margin) {
      break; // Single page; overflow signers are omitted (rare).
    }

    layer.add(
      new Konva.Rect({
        x: margin,
        y: sy,
        width: contentWidth,
        height: cardH,
        fill: '#ffffff',
        stroke: BORDER,
        strokeWidth: 1,
        cornerRadius: 8,
      }),
    );

    const padX = margin + 16;
    layer.add(
      new Konva.Text({
        x: padX,
        y: sy + 12,
        width: contentWidth - 32,
        text: signer.name,
        fontFamily: FONT,
        fontStyle: 'bold',
        fontSize: 11,
        fill: INK,
      }),
    );
    layer.add(
      new Konva.Text({
        x: padX,
        y: sy + 12,
        width: contentWidth - 32,
        align: 'right',
        text: isSigned ? '● Assinado' : 'Assinatura ICP-Brasil',
        fontFamily: FONT,
        fontStyle: 'bold',
        fontSize: 9,
        fill: isSigned ? GREEN : FAINT,
      }),
    );

    const line = (label: string, value: string, col: 0 | 1, row: number) => {
      const cx = col === 0 ? padX : padX + (contentWidth - 32) / 2;
      const cw = (contentWidth - 32) / 2 - 8;
      layer.add(
        new Konva.Text({
          x: cx,
          y: sy + 30 + row * 14,
          width: cw,
          text: `${label}: ${value}`,
          fontFamily: FONT,
          fontSize: 8,
          fill: MUTED,
          ellipsis: true,
          wrap: 'none',
        }),
      );
    };

    line('E-mail', signer.email, 0, 0);
    line('Papel', signer.roleLabel, 1, 0);

    // Event log only on signed (single-signer) cards — multi-signer cards stay
    // identity-only so the page never changes between signatures.
    if (isSigned) {
      line('CPF/CNPJ', signer.cpfCnpj ?? '—', 0, 1);
      line('Assinado em', signer.signedAt ?? '—', 1, 1);
      line('IP', signer.ipAddress ?? '—', 0, 2);
      line('Dispositivo', signer.device ?? '—', 1, 2);
      line('Enviado', signer.sentAt ?? '—', 0, 3);
      line('Visualizado', signer.viewedAt ?? '—', 1, 3);
    }

    sy += cardH + 10;
  }

  stage.add(layer);

  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
  const canvas = layer.canvas._canvas as unknown as Canvas;
  const pdf = await canvas.toBuffer('pdf');

  stage.destroy();
  layer.destroy();

  return new Uint8Array(pdf);
};
