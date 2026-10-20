import Konva from 'konva';
import 'konva/skia-backend';
import { describe, expect, it } from 'vitest';

import { buildIcpInfoBlock } from './build-icp-info-block';

const bottomOf = (node: Konva.Text) => node.y() + node.height();

const build = (width: number) =>
  buildIcpInfoBlock({
    x: 0,
    y: 100,
    width,
    badge: 'ICP-Brasil',
    title: 'Este documento foi assinado com certificados ICP-Brasil',
    body: 'Possui assinaturas realizadas com certificados da cadeia ICP-Brasil. O arquivo mantém a integridade do conteúdo original e incorpora os certificados e evidências criptográficas.',
    accent: '#16a34a',
  });

describe('buildIcpInfoBlock', () => {
  it('starts the body below a title that wraps', () => {
    const block = build(220);

    expect(block.title.height()).toBeGreaterThan(block.title.fontSize() * 1.5);
    expect(block.body.y()).toBeGreaterThanOrEqual(bottomOf(block.title));
    expect(block.title.y()).toBeGreaterThanOrEqual(bottomOf(block.badge));
  });

  it('grows the card to fit its content', () => {
    const narrow = build(220);
    const wide = build(600);

    expect(narrow.y + narrow.height).toBeGreaterThan(bottomOf(narrow.body));
    expect(narrow.height).toBeGreaterThan(wide.height);
  });

  it('draws the background before the text', () => {
    const block = build(400);
    const children = block.group.getChildren();

    expect(children[0]).toBeInstanceOf(Konva.Rect);
    expect(children.indexOf(block.body)).toBeGreaterThan(0);
  });
});
