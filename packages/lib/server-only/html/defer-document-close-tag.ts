import { Transform } from 'node:stream';
import { StringDecoder } from 'node:string_decoder';

const DOCUMENT_CLOSE_TAG = '</body></html>';

/**
 * Length of the longest tail of `text` that is a prefix of the close tag, so
 * a tag split across chunks is held back until the next chunk completes it.
 */
const getPartialCloseTagLength = (text: string) => {
  for (let length = DOCUMENT_CLOSE_TAG.length - 1; length > 0; length--) {
    if (text.endsWith(DOCUMENT_CLOSE_TAG.slice(0, length))) {
      return length;
    }
  }

  return 0;
};

/**
 * React 18 flushes `</body></html>` with the shell, so everything React Router
 * streams afterwards (hydration data and the Suspense `$RC` swaps) lands after
 * `</html>`. Browsers then hoist the Suspense comment markers to the document
 * node while the templates stay in `<body>`, and once a proxy such as
 * Cloudflare injects a script before `</body>`, `$RC` writes "$" into the text
 * node it left behind. Holding the close tag until the stream ends keeps all
 * streamed markup inside `<body>`.
 */
export const createDocumentCloseTagDeferrer = () => {
  const decoder = new StringDecoder('utf8');

  let pending = '';
  let hasDeferredCloseTag = false;

  const takeOutput = (text: string) => {
    if (hasDeferredCloseTag) {
      return text;
    }

    const closeTagIndex = text.indexOf(DOCUMENT_CLOSE_TAG);

    if (closeTagIndex !== -1) {
      hasDeferredCloseTag = true;

      return takeOutput(text.slice(0, closeTagIndex) + text.slice(closeTagIndex + DOCUMENT_CLOSE_TAG.length));
    }

    const splitAt = text.length - getPartialCloseTagLength(text);

    pending = text.slice(splitAt);

    return text.slice(0, splitAt);
  };

  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      const text = pending + decoder.write(chunk);

      pending = '';

      const output = takeOutput(text);

      callback(null, output || undefined);
    },
    flush(callback) {
      const closeTag = hasDeferredCloseTag ? DOCUMENT_CLOSE_TAG : '';

      callback(null, pending + decoder.end() + closeTag || undefined);
    },
  });
};
