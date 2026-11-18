import type { SentMessageInfo, Transport } from 'nodemailer';
import type Mail from 'nodemailer/lib/mailer';
import type MailMessage from 'nodemailer/lib/mailer/mail-message';

const VERSION = '1.0.0';

export const MAIL_SEND_DEFAULT_URL = 'https://mail.capivapp.com.br';

type NodeMailerAddress = Mail.Options['to'];

type MailSendAnexo = {
  nomeArquivo: string;
  tipo: string;
  conteudoBase64: string;
  contentId?: string;
};

type MailSendEmail = {
  nome: string;
  para: string[];
  cc?: string[];
  cco?: string[];
  responderPara?: string;
  assunto: string;
  html?: string;
  texto?: string;
  anexos?: MailSendAnexo[];
};

type MailSendErrorBody = {
  message?: string;
  errors?: Array<{ path: string; message: string }>;
};

export type MailSendTransportOptions = {
  endpoint?: string;
  token: string;
  fromName?: string;
  fetch?: (url: string, init: RequestInit) => Promise<Response>;
};

type MailSendCallback = (_err: Error | null, _info: SentMessageInfo) => void;

/**
 * Transport for sending email through the CapivApp `mail-send` service.
 *
 * The service always sends from noreply@capivapp.com.br, so only the sender
 * name travels with the request. It accepts the email (202), queues it and
 * retries on its own, so a success here means "queued", not "delivered".
 */
export const createMailSendTransport = (options: MailSendTransportOptions): Transport<SentMessageInfo> => {
  const endpoint = `${(options.endpoint || MAIL_SEND_DEFAULT_URL).replace(/\/+$/, '')}/v1/emails`;
  const fromName = options.fromName || 'CapivaSign';
  const fetchFn = options.fetch ?? fetch;

  const post = async (email: MailSendEmail) => {
    const response = await fetchFn(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${options.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(email),
    });

    if (!response.ok) {
      throw await toMailSendError(response);
    }

    const accepted: { id: string } = await response.json();

    return accepted;
  };

  const send = (mail: MailMessage, callback: MailSendCallback) => {
    if (!mail.data.to) {
      return callback(new Error('Missing required field "to"'), null);
    }

    mail.normalize((err, data) => {
      if (err || !data) {
        return callback(err ?? new Error('Could not read the email message'), null);
      }

      const email = toMailSendEmail(data, fromName);

      post(email)
        .then((accepted) => {
          callback(null, {
            messageId: accepted.id,
            envelope: data.envelope,
            accepted: email.para,
            rejected: [],
            pending: [],
          });
        })
        .catch((error) => callback(error, null));
    });
  };

  return {
    name: 'MailSendTransport',
    version: VERSION,
    send,
  };
};

const toMailSendEmail = (data: Mail.Options, fromName: string): MailSendEmail => {
  const cc = toAddresses(data.cc);
  const cco = toAddresses(data.bcc);
  const [responderPara] = toAddresses(data.replyTo);
  const anexos = (data.attachments ?? []).map(toMailSendAnexo);

  return {
    nome: fromName,
    para: toAddresses(data.to),
    ...(cc.length > 0 ? { cc } : {}),
    ...(cco.length > 0 ? { cco } : {}),
    ...(responderPara ? { responderPara } : {}),
    assunto: data.subject ?? '',
    ...(data.html ? { html: data.html.toString() } : {}),
    ...(data.text ? { texto: data.text.toString() } : {}),
    ...(anexos.length > 0 ? { anexos } : {}),
  };
};

/**
 * Converts nodemailer addresses to bare email addresses. mail-send takes
 * addresses only; the display names of recipients are dropped.
 */
const toAddresses = (address: NodeMailerAddress): string[] => {
  if (!address) {
    return [];
  }

  return [address].flat().map((entry) => (typeof entry === 'string' ? entry : entry.address));
};

/**
 * After `normalize()`, Buffer contents are already base64 (`encoding: 'base64'`)
 * and anything else is a plain utf-8 string.
 */
const toMailSendAnexo = (attachment: Mail.Attachment, index: number): MailSendAnexo => {
  const content = attachment.content?.toString() ?? '';
  const conteudoBase64 = attachment.encoding === 'base64' ? content : Buffer.from(content, 'utf-8').toString('base64');

  return {
    nomeArquivo: attachment.filename || `anexo-${index + 1}`,
    tipo: attachment.contentType || 'application/octet-stream',
    conteudoBase64,
    ...(attachment.cid ? { contentId: attachment.cid } : {}),
  };
};

const toMailSendError = async (response: Response) => {
  const body: MailSendErrorBody | null = await response.json().catch(() => null);

  const fieldErrors = (body?.errors ?? []).map((error) => `${error.path}: ${error.message}`).join('; ');
  const details = [body?.message, fieldErrors ? `(${fieldErrors})` : ''].filter(Boolean).join(' ');

  return new Error(`mail-send error [${response.status}]${details ? `: ${details}` : ''}`);
};
