import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { BRAND_NAME, BRAND_SOCIAL_HANDLE } from '@documenso/lib/constants/brand';
import { i18n, type MessageDescriptor } from '@lingui/core';

type LinkPreview = {
  title: string;
  description: string;
};

/**
 * Open Graph / Twitter tags: what WhatsApp, Telegram, Slack and social
 * networks read to draw a link preview (title, text and image).
 *
 * React Router renders only the DEEPEST matching route's `meta`, so a route
 * that exports its own `meta` drops the root's tags. Every such route must
 * spread these in, or its links unfurl as a bare URL.
 */
export const linkPreviewTags = ({ title, description }: LinkPreview) => [
  { property: 'og:title', content: title },
  { property: 'og:description', content: description },
  { property: 'og:image', content: `${NEXT_PUBLIC_WEBAPP_URL()}/opengraph-image.jpg` },
  { property: 'og:image:width', content: '1200' },
  { property: 'og:image:height', content: '630' },
  { property: 'og:type', content: 'website' },
  { property: 'og:site_name', content: BRAND_NAME() },
  { name: 'twitter:card', content: 'summary_large_image' },
  { name: 'twitter:site', content: BRAND_SOCIAL_HANDLE() },
  { name: 'twitter:description', content: description },
  { name: 'twitter:image', content: `${NEXT_PUBLIC_WEBAPP_URL()}/opengraph-image.jpg` },
];

export const appMetaTags = (title?: MessageDescriptor) => {
  const description =
    'CapivaSign: assinatura eletrônica e digital com certificado ICP-Brasil (A1/A3, PAdES), com uma experiência de assinatura rápida, simples e segura.';

  return [
    {
      title: title ? `${i18n._(title)} - CapivaSign` : 'CapivaSign',
    },
    {
      name: 'description',
      content: description,
    },
    {
      name: 'keywords',
      content:
        'CapivaSign, ICP-Brasil, assinatura digital, certificado digital, A1, A3, PAdES, assinatura eletrônica, open source',
    },
    {
      name: 'author',
      content: 'CapivaSign',
    },
    {
      name: 'robots',
      content: 'index, follow',
    },
    ...linkPreviewTags({ title: 'CapivaSign - Assinatura digital ICP-Brasil', description }),
  ];
};

/**
 * Signing links (`/sign/:token`, sent by e-mail and WhatsApp). The preview is
 * generic on purpose: the URL carries the recipient token, so the unfurl must
 * not reveal the document name or the parties.
 */
export const recipientMetaTags = (pageTitle: string) => [
  { title: pageTitle },
  { name: 'robots', content: 'noindex, nofollow, noarchive' },
  ...linkPreviewTags({
    title: 'Você recebeu um documento',
    description: `Abra o link para ver e assinar o documento no ${BRAND_NAME()}.`,
  }),
];
