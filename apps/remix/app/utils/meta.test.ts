import { describe, expect, it } from 'vitest';

import { appMetaTags, recipientMetaTags } from './meta';

type MetaTag = { title?: string; name?: string; property?: string; content?: string };

const findProperty = (tags: MetaTag[], property: string) => tags.find((tag) => tag.property === property)?.content;

describe('recipientMetaTags', () => {
  // WhatsApp builds the link preview from these tags; React Router renders only
  // the deepest route's meta, so the signing layout must carry them itself.
  it('gives signing links a link preview with title, description and image', () => {
    const tags = recipientMetaTags('Assinar documento - CapivaSign');

    expect(findProperty(tags, 'og:title')).toBe('Você recebeu um documento');
    expect(findProperty(tags, 'og:description')).toBe('Abra o link para ver e assinar o documento no CapivaSign.');
    expect(findProperty(tags, 'og:image')).toMatch(/^https?:\/\/.+\/opengraph-image\.jpg$/);
    expect(findProperty(tags, 'og:site_name')).toBe('CapivaSign');
  });

  it('keeps signing pages out of search engines', () => {
    expect(recipientMetaTags('Assinar documento - CapivaSign')).toContainEqual({
      name: 'robots',
      content: 'noindex, nofollow, noarchive',
    });
  });
});

describe('appMetaTags', () => {
  it('keeps the link preview tags', () => {
    expect(findProperty(appMetaTags(), 'og:image')).toMatch(/\/opengraph-image\.jpg$/);
  });

  it('never uses an em dash in the visible preview text', () => {
    const texts = [...appMetaTags(), ...recipientMetaTags('Assinar documento - CapivaSign')].map(
      (tag: MetaTag) => tag.content ?? tag.title ?? '',
    );

    expect(texts.join(' ')).not.toContain('—');
  });
});
