import { describe, expect, it } from 'vitest';

import { buildWhatsappMessage, resolveSenderName } from './build-whatsapp-message';

const input = {
  signerName: 'Patricia Jesus da Silva',
  senderName: 'Mateus Seiboth',
  documentName: 'Certidão Fiscal de Valor Venal.pdf',
  link: 'https://assina.exemplo/sign/abc',
  actionVerb: 'assinar',
};

describe('buildWhatsappMessage', () => {
  it('invites the signer naming the platform, the sender and the document', () => {
    expect(buildWhatsappMessage('SIGNING_REQUEST', input)).toBe(
      [
        '✍️ *CapivaSign*',
        '',
        'Olá, Patricia!',
        '',
        '*Mateus Seiboth* enviou o documento *Certidão Fiscal de Valor Venal.pdf* para você assinar.',
        '',
        'Acesse para assinar:',
        'https://assina.exemplo/sign/abc',
      ].join('\n'),
    );
  });

  it('reminds the signer who sent the pending document', () => {
    expect(buildWhatsappMessage('SIGNING_REMINDER', input)).toBe(
      [
        '⏰ *CapivaSign* · Lembrete',
        '',
        'Olá, Patricia!',
        '',
        'O documento *Certidão Fiscal de Valor Venal.pdf*, enviado por *Mateus Seiboth*, ainda está esperando por você.',
        '',
        'Acesse para assinar:',
        'https://assina.exemplo/sign/abc',
      ].join('\n'),
    );
  });

  it('tells the signer the document is complete and where to download it', () => {
    expect(buildWhatsappMessage('DOCUMENT_COMPLETED', input)).toBe(
      [
        '✅ *CapivaSign*',
        '',
        'Olá, Patricia!',
        '',
        'O documento *Certidão Fiscal de Valor Venal.pdf*, enviado por *Mateus Seiboth*, foi assinado por todos e está concluído.',
        '',
        'Baixe a versão final:',
        'https://assina.exemplo/sign/abc',
      ].join('\n'),
    );
  });

  it('tells the signer who cancelled the document and that nothing is left to do', () => {
    expect(buildWhatsappMessage('DOCUMENT_CANCELLED', input)).toBe(
      [
        '🚫 *CapivaSign*',
        '',
        'Olá, Patricia!',
        '',
        '*Mateus Seiboth* cancelou o documento *Certidão Fiscal de Valor Venal.pdf*. Você não precisa fazer mais nada.',
      ].join('\n'),
    );
  });

  it('confirms the rejection to the signer and says the sender was told', () => {
    expect(buildWhatsappMessage('DOCUMENT_REJECTED', input)).toBe(
      [
        '📝 *CapivaSign*',
        '',
        'Olá, Patricia!',
        '',
        'Registramos que você recusou o documento *Certidão Fiscal de Valor Venal.pdf*, enviado por *Mateus Seiboth*. Avisamos *Mateus Seiboth*.',
      ].join('\n'),
    );
  });

  it('greets without a name when the signer has none', () => {
    expect(buildWhatsappMessage('DOCUMENT_CANCELLED', { ...input, signerName: '  ' })).toContain('\nOlá!\n');
  });

  it('never uses an em dash', () => {
    const events = [
      'SIGNING_REQUEST',
      'SIGNING_REMINDER',
      'DOCUMENT_COMPLETED',
      'DOCUMENT_CANCELLED',
      'DOCUMENT_REJECTED',
    ] as const;

    for (const event of events) {
      expect(buildWhatsappMessage(event, input)).not.toContain('—');
    }
  });
});

describe('resolveSenderName', () => {
  it('uses the document owner name', () => {
    expect(resolveSenderName('Mateus Seiboth', 'CapivApp')).toBe('Mateus Seiboth');
  });

  it('falls back to the team name when the owner has no name', () => {
    expect(resolveSenderName(null, 'CapivApp')).toBe('CapivApp');
    expect(resolveSenderName('   ', 'CapivApp')).toBe('CapivApp');
  });
});
