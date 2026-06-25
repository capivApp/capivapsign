import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { i18n, type MessageDescriptor } from '@lingui/core';

export const appMetaTags = (title?: MessageDescriptor) => {
  const description =
    'CapivaSign — assinatura eletrônica e digital com certificado ICP-Brasil (A1/A3, PAdES). Um fork open source do Documenso, com uma experiência de assinatura rápida, simples e segura.';

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
        'CapivaSign, ICP-Brasil, assinatura digital, certificado digital, A1, A3, PAdES, assinatura eletrônica, Documenso, open source',
    },
    {
      name: 'author',
      content: 'CapivaSign',
    },
    {
      name: 'robots',
      content: 'index, follow',
    },
    {
      property: 'og:title',
      content: 'CapivaSign - Assinatura digital ICP-Brasil',
    },
    {
      property: 'og:description',
      content: description,
    },
    {
      property: 'og:image',
      content: `${NEXT_PUBLIC_WEBAPP_URL()}/opengraph-image.jpg`,
    },
    {
      property: 'og:type',
      content: 'website',
    },
    {
      name: 'twitter:card',
      content: 'summary_large_image',
    },
    {
      name: 'twitter:site',
      content: '@documenso',
    },
    {
      name: 'twitter:description',
      content: description,
    },
    {
      name: 'twitter:image',
      content: `${NEXT_PUBLIC_WEBAPP_URL()}/opengraph-image.jpg`,
    },
  ];
};
