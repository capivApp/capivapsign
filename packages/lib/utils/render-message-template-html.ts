import { renderCustomEmailTemplate } from './render-custom-email-template';

/**
 * Returns true when a message-template body is a full, self-contained HTML
 * document (i.e. it starts with a `<!DOCTYPE html>` or `<html>` tag) rather
 * than a short plain-text snippet.
 *
 * Full HTML templates are meant to *replace* the built-in Documenso email
 * layout, so callers should send them verbatim instead of embedding them as
 * escaped text inside the default template.
 */
export const isFullHtmlDocument = (body: string | null | undefined): boolean => {
  if (!body) {
    return false;
  }

  return /^\s*<(!doctype\s+html|html[\s>])/i.test(body);
};

/**
 * Derives a best-effort plain-text fallback from an HTML document by stripping
 * tags. Used so HTML-only templates still ship a `text/plain` MIME part.
 */
export const htmlToPlainText = (html: string): string =>
  html
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|h[1-6]|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

/**
 * Renders a full-HTML message template into `{ html, text }` by substituting
 * `{placeholder}` variables. Returns `null` when the body is not a full HTML
 * document, signalling the caller to fall back to the built-in React template.
 */
export const renderFullHtmlMessageTemplate = (
  body: string | null | undefined,
  variables: Record<string, string>,
): { html: string; text: string } | null => {
  if (!isFullHtmlDocument(body)) {
    return null;
  }

  const html = renderCustomEmailTemplate(body as string, variables);

  return { html, text: htmlToPlainText(html) };
};
