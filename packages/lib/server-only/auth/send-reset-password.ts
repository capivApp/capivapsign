import { ResetPasswordTemplate } from '@documenso/email/templates/reset-password';
import { prisma } from '@documenso/prisma';
import { msg } from '@lingui/core/macro';
import { createElement } from 'react';

import { getI18nInstance } from '../../client-only/providers/i18n-server';
import { NEXT_PUBLIC_WEBAPP_URL } from '../../constants/app';
import { renderEmailWithI18N } from '../../utils/render-email-with-i18n';
import { getAuthEmailTransport } from '../email/get-auth-email-transport';

export interface SendResetPasswordOptions {
  userId: number;
}

export const sendResetPassword = async ({ userId }: SendResetPasswordOptions) => {
  const user = await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
  });

  const assetBaseUrl = NEXT_PUBLIC_WEBAPP_URL() || 'http://localhost:3000';

  const template = createElement(ResetPasswordTemplate, {
    assetBaseUrl,
    userEmail: user.email,
    userName: user.name || '',
  });

  const [html, text] = await Promise.all([
    renderEmailWithI18N(template),
    renderEmailWithI18N(template, { plainText: true }),
  ]);

  const i18n = await getI18nInstance();

  const { transporter, senderEmail } = await getAuthEmailTransport();

  return await transporter.sendMail({
    to: {
      address: user.email,
      name: user.name || '',
    },
    from: senderEmail,
    subject: i18n._(msg`Password Reset Success!`),
    html,
    text,
  });
};
