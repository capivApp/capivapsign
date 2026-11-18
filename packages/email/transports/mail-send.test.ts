import { createTransport } from 'nodemailer';
import { describe, expect, it } from 'vitest';

import { createMailSendTransport } from './mail-send';

type RecordedRequest = { url: string; init: RequestInit };

const createFakeFetch = (status: number, body: unknown) => {
  const requests: RecordedRequest[] = [];

  const fetch = (url: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(url), init: init ?? {} });

    const payload = typeof body === 'string' ? body : JSON.stringify(body);

    return Promise.resolve(new Response(payload, { status, headers: { 'Content-Type': 'application/json' } }));
  };

  return { fetch, requests };
};

const getHeader = (request: RecordedRequest, name: string) => new Headers(request.init.headers).get(name);

const getBody = (request: RecordedRequest) => JSON.parse(String(request.init.body));

const makeMailer = (fetch: ReturnType<typeof createFakeFetch>['fetch'], endpoint?: string) =>
  createTransport(createMailSendTransport({ endpoint, token: 'token_capivasign', fromName: 'CapivaSign', fetch }));

const ACCEPTED = { id: 'email_1', situacao: 'pendente' };

describe('createMailSendTransport', () => {
  it('posts the message to mail-send with the app token', async () => {
    const { fetch, requests } = createFakeFetch(202, ACCEPTED);

    await makeMailer(fetch).sendMail({
      from: { name: 'Equipe X', address: 'noreply@capivasign.com' },
      to: [{ name: 'Maria', address: 'maria@example.com' }, 'joao@example.com'],
      cc: 'Ana <ana@example.com>, bia@example.com',
      bcc: { name: 'Auditoria', address: 'auditoria@example.com' },
      replyTo: 'Suporte <suporte@example.com>',
      subject: 'Documento para assinar',
      html: '<p>Olá</p>',
      text: 'Olá',
    });

    expect(requests).toHaveLength(1);
    expect(requests[0].url).toBe('https://mail.capivapp.com.br/v1/emails');
    expect(requests[0].init.method).toBe('POST');
    expect(getHeader(requests[0], 'authorization')).toBe('Bearer token_capivasign');
    expect(getHeader(requests[0], 'content-type')).toBe('application/json');
    expect(getBody(requests[0])).toEqual({
      nome: 'CapivaSign',
      para: ['maria@example.com', 'joao@example.com'],
      cc: ['ana@example.com', 'bia@example.com'],
      cco: ['auditoria@example.com'],
      responderPara: 'suporte@example.com',
      assunto: 'Documento para assinar',
      html: '<p>Olá</p>',
      texto: 'Olá',
    });
  });

  it('uses the configured endpoint, with or without a trailing slash', async () => {
    const { fetch, requests } = createFakeFetch(202, ACCEPTED);

    await makeMailer(fetch, 'http://localhost:4000/').sendMail({
      from: 'noreply@capivasign.com',
      to: 'maria@example.com',
      subject: 'Teste',
      text: 'Olá',
    });

    expect(requests[0].url).toBe('http://localhost:4000/v1/emails');
  });

  it('leaves out the optional fields the message does not have', async () => {
    const { fetch, requests } = createFakeFetch(202, ACCEPTED);

    await makeMailer(fetch).sendMail({
      from: 'noreply@capivasign.com',
      to: 'maria@example.com',
      subject: 'Só texto',
      text: 'Olá',
    });

    expect(getBody(requests[0])).toEqual({
      nome: 'CapivaSign',
      para: ['maria@example.com'],
      assunto: 'Só texto',
      texto: 'Olá',
    });
  });

  it('sends attachments in base64 and keeps the cid of inline images', async () => {
    const { fetch, requests } = createFakeFetch(202, ACCEPTED);

    await makeMailer(fetch).sendMail({
      from: 'noreply@capivasign.com',
      to: 'maria@example.com',
      subject: 'Documento assinado',
      html: '<img src="cid:logo@capivasign" />',
      attachments: [
        { filename: 'contrato.pdf', content: Buffer.from('%PDF-1.7'), contentType: 'application/pdf' },
        { filename: 'logo.png', content: Buffer.from('png-bytes'), contentType: 'image/png', cid: 'logo@capivasign' },
        { filename: 'leia-me.txt', content: 'texto puro' },
        { filename: 'ja-em-base64.bin', content: Buffer.from('abc').toString('base64'), encoding: 'base64' },
      ],
    });

    expect(getBody(requests[0]).anexos).toEqual([
      {
        nomeArquivo: 'contrato.pdf',
        tipo: 'application/pdf',
        conteudoBase64: Buffer.from('%PDF-1.7').toString('base64'),
      },
      {
        nomeArquivo: 'logo.png',
        tipo: 'image/png',
        conteudoBase64: Buffer.from('png-bytes').toString('base64'),
        contentId: 'logo@capivasign',
      },
      {
        nomeArquivo: 'leia-me.txt',
        tipo: 'text/plain',
        conteudoBase64: Buffer.from('texto puro').toString('base64'),
      },
      {
        nomeArquivo: 'ja-em-base64.bin',
        tipo: 'application/octet-stream',
        conteudoBase64: Buffer.from('abc').toString('base64'),
      },
    ]);
  });

  it('reports the mail-send id to nodemailer when the email is accepted', async () => {
    const { fetch } = createFakeFetch(202, ACCEPTED);

    const info = await makeMailer(fetch).sendMail({
      from: 'noreply@capivasign.com',
      to: ['maria@example.com', 'joao@example.com'],
      subject: 'Teste',
      text: 'Olá',
    });

    expect(info.messageId).toBe('email_1');
    expect(info.accepted).toEqual(['maria@example.com', 'joao@example.com']);
    expect(info.rejected).toEqual([]);
  });

  it('fails with the mail-send message and field errors when the email is refused', async () => {
    const { fetch } = createFakeFetch(400, {
      message: 'Dados inválidos.',
      errors: [{ path: 'assunto', message: 'Informe o assunto.' }],
    });

    await expect(
      makeMailer(fetch).sendMail({ from: 'noreply@capivasign.com', to: 'maria@example.com', subject: '', text: 'x' }),
    ).rejects.toThrow('mail-send error [400]: Dados inválidos. (assunto: Informe o assunto.)');
  });

  it('fails with the status when the response is not JSON', async () => {
    const { fetch } = createFakeFetch(502, '<html>Bad Gateway</html>');

    await expect(
      makeMailer(fetch).sendMail({ from: 'noreply@capivasign.com', to: 'maria@example.com', subject: 'x', text: 'x' }),
    ).rejects.toThrow('mail-send error [502]');
  });

  it('fails when mail-send cannot be reached', async () => {
    const fetch = () => Promise.reject(new TypeError('fetch failed'));

    await expect(
      makeMailer(fetch).sendMail({ from: 'noreply@capivasign.com', to: 'maria@example.com', subject: 'x', text: 'x' }),
    ).rejects.toThrow('fetch failed');
  });

  it('fails without calling mail-send when there is no recipient', async () => {
    const { fetch, requests } = createFakeFetch(202, ACCEPTED);

    await expect(
      makeMailer(fetch).sendMail({ from: 'noreply@capivasign.com', subject: 'x', text: 'x' }),
    ).rejects.toThrow('Missing required field "to"');
    expect(requests).toHaveLength(0);
  });
});
