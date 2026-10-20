import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';

import { createDocumentCloseTagDeferrer } from './defer-document-close-tag';

const readThrough = async (chunks: Array<string | Buffer>) => {
  const output: string[] = [];

  const stream = Readable.from(chunks).pipe(createDocumentCloseTagDeferrer());

  for await (const chunk of stream) {
    output.push(chunk.toString());
  }

  return output.join('');
};

describe('createDocumentCloseTagDeferrer', () => {
  it('moves the document close tag after content streamed past it', async () => {
    const html = await readThrough([
      '<html><body><main></main>',
      '</body></html>',
      '<!--$?--><template id="B:0"></template><!--/$-->',
      '<script>$RC("B:0","S:0")</script>',
    ]);

    expect(html).toBe(
      '<html><body><main></main><!--$?--><template id="B:0"></template><!--/$--><script>$RC("B:0","S:0")</script></body></html>',
    );
  });

  it('finds the close tag when it is split across chunks', async () => {
    const html = await readThrough(['<html><body>a</bo', 'dy></ht', 'ml><script>late</script>']);

    expect(html).toBe('<html><body>a<script>late</script></body></html>');
  });

  it('keeps a partial match that turns out not to be the close tag', async () => {
    const html = await readThrough(['<html><body>a</b', '>b</body></html>']);

    expect(html).toBe('<html><body>a</b>b</body></html>');
  });

  it('keeps multi-byte characters split across chunks intact', async () => {
    const bytes = Buffer.from('<html><body>Assinatura concluída</body></html>');
    const splitAt = bytes.indexOf(Buffer.from('í')) + 1;

    const html = await readThrough([bytes.subarray(0, splitAt), bytes.subarray(splitAt)]);

    expect(html).toBe('<html><body>Assinatura concluída</body></html>');
  });

  it('leaves a document without the close tag untouched', async () => {
    const html = await readThrough(['<div>', 'fragment</div>']);

    expect(html).toBe('<div>fragment</div>');
  });
});
