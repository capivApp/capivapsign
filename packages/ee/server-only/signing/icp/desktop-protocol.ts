import { z } from 'zod';

import { ZIcpCertTypeSchema } from '@documenso/lib/types/icp-sign-session';

/**
 * Wire contracts between the ICP-Brasil desktop agent and the Documenso server.
 *
 * Two transports share these shapes:
 *   - desktop Rust core <-> Java crypto helper, over loopback NDJSON stdin/stdout
 *     ({@link ZHelperListRequest}/{@link ZHelperSignRequest} families); and
 *   - desktop <-> server, over HTTPS ({@link ZIcpPrepareRequest} /
 *     {@link ZIcpCompleteRequest}).
 *
 * Keeping them as Zod schemas means both the Hono routes and the (future)
 * desktop TS layer validate against one source of truth.
 */

// ---- Java helper protocol (loopback NDJSON) --------------------------------

export const ZHelperCertSourceSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('P12'), path: z.string(), password: z.string().optional() }),
  // Future A3 backends register here without touching call sites.
  z.object({ type: z.literal('PKCS11'), module: z.string(), pin: z.string().optional(), slot: z.number().optional() }),
  z.object({ type: z.literal('WINDOWS_MY') }),
]);

export const ZHelperListRequestSchema = z.object({
  cmd: z.literal('list'),
  source: ZHelperCertSourceSchema,
});

export const ZHelperSignRequestSchema = z.object({
  cmd: z.literal('sign'),
  source: ZHelperCertSourceSchema,
  alias: z.string().optional(),
  digestB64: z.string(),
  digestAlgo: z.enum(['SHA-256', 'SHA-384', 'SHA-512']).default('SHA-256'),
});

export const ZHelperCertInfoSchema = z.object({
  alias: z.string(),
  subject: z.string(),
  commonName: z.string(),
  cpfCnpj: z.string().nullable(),
  issuer: z.string(),
  notAfter: z.string(),
  keyType: z.string(),
  type: ZIcpCertTypeSchema,
  certB64: z.string(),
});

export const ZHelperListResponseSchema = z.object({
  ok: z.literal(true),
  certs: z.array(ZHelperCertInfoSchema),
});

export const ZHelperSignResponseSchema = z.object({
  ok: z.literal(true),
  signatureB64: z.string(),
  signatureAlgorithm: z.string(),
  certChainB64: z.array(z.string()).min(1),
});

export const ZHelperErrorResponseSchema = z.object({
  ok: z.literal(false),
  error: z.string(),
});

// ---- server API: /api/icp/sign/* -------------------------------------------

/**
 * `POST /api/icp/sign/prepare`. The desktop submits the recipient token, the
 * chosen leaf-first DER cert chain (base64), and the hardware tier. The server
 * captures one signedAttrs digest per envelope item and returns them.
 */
export const ZIcpPrepareRequestSchema = z.object({
  recipientToken: z.string(),
  certChainB64: z.array(z.string()).min(1),
  certType: ZIcpCertTypeSchema,
});

export const ZIcpPrepareItemSchema = z.object({
  envelopeItemId: z.string(),
  digestB64: z.string(),
});

export const ZIcpPrepareResponseSchema = z.object({
  sessionId: z.string(),
  items: z.array(ZIcpPrepareItemSchema),
  policy: z.object({
    digestAlgo: z.enum(['SHA-256', 'SHA-384', 'SHA-512']),
    signAlgo: z.string(),
  }),
});

/**
 * `POST /api/icp/sign/complete`. The desktop returns one signature per item
 * (over the digest from prepare). The server embeds them at B-T and, when the
 * envelope is fully signed, schedules the B-LTA seal.
 */
export const ZIcpCompleteItemSchema = z.object({
  envelopeItemId: z.string(),
  signatureB64: z.string(),
});

export const ZIcpCompleteRequestSchema = z.object({
  sessionId: z.string(),
  items: z.array(ZIcpCompleteItemSchema).min(1),
});

export const ZIcpCompleteResponseSchema = z.object({
  outcome: z.enum(['signed', 'already_signed']),
});

export type THelperListResponse = z.infer<typeof ZHelperListResponseSchema>;
export type THelperSignResponse = z.infer<typeof ZHelperSignResponseSchema>;
export type TIcpPrepareRequest = z.infer<typeof ZIcpPrepareRequestSchema>;
export type TIcpPrepareResponse = z.infer<typeof ZIcpPrepareResponseSchema>;
export type TIcpCompleteRequest = z.infer<typeof ZIcpCompleteRequestSchema>;
export type TIcpCompleteResponse = z.infer<typeof ZIcpCompleteResponseSchema>;
