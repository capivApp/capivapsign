import { describe, expect, it } from 'vitest';

import { withAutomaticMessageFooter } from './automatic-message-footer';

describe('withAutomaticMessageFooter', () => {
  // Sent from the CapivaSign default number: a reply ("ok", "assinei") reaches nobody.
  it('tells the recipient there is no need to reply when sent from the CapivaSign number', () => {
    expect(withAutomaticMessageFooter('Assine o documento.', 'capiva')).toBe(
      'Assine o documento.\n\n_Mensagem automática, não precisa responder._',
    );
  });

  it('only flags the message as automatic when sent from the organisation own number', () => {
    expect(withAutomaticMessageFooter('Assine o documento.', 'own')).toBe(
      'Assine o documento.\n\n_Mensagem automática._',
    );
  });
});
