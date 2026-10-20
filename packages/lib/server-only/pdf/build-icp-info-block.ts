import Konva from 'konva';

const INK = '#0f172a';
const MUTED = '#64748b';
const BORDER = '#e2e8f0';
const PANEL = '#f8fafc';
const FONT = 'Inter';

const PADDING_TOP = 10;
const PADDING_BOTTOM = 12;
const PADDING_LEFT = 16;
const PADDING_RIGHT = 12;
const BADGE_GAP = 4;
const TITLE_GAP = 6;

export type BuildIcpInfoBlockOptions = {
  x: number;
  y: number;
  width: number;
  badge: string;
  title: string;
  body: string;
  accent: string;
};

/**
 * One compliance card of the ICP audit page (badge, title, body). Each text
 * goes below the previous one by its measured height and the card grows with
 * them, so a title that wraps never runs into the body.
 */
export const buildIcpInfoBlock = ({ x, y, width, badge, title, body, accent }: BuildIcpInfoBlockOptions) => {
  const textWidth = width - PADDING_LEFT - PADDING_RIGHT;
  const text = (config: Konva.TextConfig) =>
    new Konva.Text({ x: x + PADDING_LEFT, width: textWidth, fontFamily: FONT, ...config });

  const badgeNode = text({ y: y + PADDING_TOP, text: badge, fontStyle: 'bold', fontSize: 8, fill: accent });

  const titleNode = text({ text: title, fontStyle: 'bold', fontSize: 10.5, fill: INK, lineHeight: 1.25 });
  titleNode.y(badgeNode.y() + badgeNode.height() + BADGE_GAP);

  const bodyNode = text({ text: body, fontSize: 8, fill: MUTED, lineHeight: 1.4 });
  bodyNode.y(titleNode.y() + titleNode.height() + TITLE_GAP);

  const height = bodyNode.y() + bodyNode.height() + PADDING_BOTTOM - y;

  const group = new Konva.Group();

  group.add(
    new Konva.Rect({ x, y, width, height, fill: PANEL, stroke: BORDER, strokeWidth: 1, cornerRadius: 6 }),
    new Konva.Rect({ x, y, width: 4, height, fill: accent, cornerRadius: 6 }),
    badgeNode,
    titleNode,
    bodyNode,
  );

  return { group, badge: badgeNode, title: titleNode, body: bodyNode, y, height };
};
