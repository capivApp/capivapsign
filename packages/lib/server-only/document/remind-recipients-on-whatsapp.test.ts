import { RecipientRole } from '@prisma/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { sendWhatsappNotification } from '../whatsapp/send-whatsapp-notification';
import { remindRecipientsOnWhatsapp } from './remind-recipients-on-whatsapp';

vi.mock('../whatsapp/send-whatsapp-notification', () => ({
  sendWhatsappNotification: vi.fn(),
}));

const buildRecipient = (
  overrides: Partial<Parameters<typeof remindRecipientsOnWhatsapp>[0]['recipients'][number]> = {},
) => ({
  name: 'Ana Exemplo',
  email: 'ana@exemplo.com',
  phone: '5567999990000',
  role: RecipientRole.SIGNER,
  token: 'token-da-ana',
  ...overrides,
});

const remind = (recipients: ReturnType<typeof buildRecipient>[]) =>
  remindRecipientsOnWhatsapp({
    teamId: 7,
    documentTitle: 'Contrato de Prestação de Serviços',
    recipients,
    buildSigningLink: (token) => `https://assina.exemplo/sign/${token}`,
    getActionVerb: () => 'assinar',
  });

describe('remindRecipientsOnWhatsapp', () => {
  beforeEach(() => {
    vi.mocked(sendWhatsappNotification).mockReset();
  });

  it('sends the signing reminder on WhatsApp to a recipient with a phone', async () => {
    await remind([buildRecipient()]);

    expect(sendWhatsappNotification).toHaveBeenCalledWith({
      teamId: 7,
      event: 'SIGNING_REMINDER',
      to: '5567999990000',
      vars: {
        'signer.name': 'Ana Exemplo',
        'signer.email': 'ana@exemplo.com',
        'document.name': 'Contrato de Prestação de Serviços',
        link: 'https://assina.exemplo/sign/token-da-ana',
      },
      fallbackBody:
        'Lembrete: assinar o documento "Contrato de Prestação de Serviços". Acesse: https://assina.exemplo/sign/token-da-ana',
    });
  });

  it('skips recipients without a phone and CC recipients', async () => {
    await remind([
      buildRecipient({ phone: null }),
      buildRecipient({ phone: '', token: 'sem-telefone' }),
      buildRecipient({ role: RecipientRole.CC, token: 'copia' }),
    ]);

    expect(sendWhatsappNotification).not.toHaveBeenCalled();
  });

  it('reminds every reachable recipient', async () => {
    await remind([buildRecipient(), buildRecipient({ phone: '5567888880000', token: 'token-do-bruno' })]);

    expect(sendWhatsappNotification).toHaveBeenCalledTimes(2);
  });
});
