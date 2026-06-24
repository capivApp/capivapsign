import { z } from 'zod';

/**
 * One entry in an ICP-Brasil sign-time session, pinning the bytes
 * (`documentDataId`) whose signedAttrs digest (`hashB64`) was captured at prep
 * time for a given envelope item. Mirrors `ZCscSessionItemSchema`; `ordinal`
 * is this entry's position in the session items array so the desktop agent's
 * position-ordered signatures line up at complete time.
 */
export const ZIcpSignSessionItemSchema = z.object({
  envelopeItemId: z.string(),
  documentDataId: z.string(),
  hashB64: z.string(),
  ordinal: z.number().int().nonnegative(),
});

export const ZIcpSignSessionItemsSchema = z.array(ZIcpSignSessionItemSchema);

export type TIcpSignSessionItem = z.infer<typeof ZIcpSignSessionItemSchema>;
export type TIcpSignSessionItems = z.infer<typeof ZIcpSignSessionItemsSchema>;

/**
 * Certificate hardware tier the recipient signed with. `A1` is a software
 * `.p12`/`.pfx`; `A3` is a token / smartcard (PKCS#11) or the Windows store.
 * Persisted on the session and the evidence row for audit/reporting. The
 * server-side flow is identical for both — the distinction lives in the
 * desktop agent.
 */
export const ZIcpCertTypeSchema = z.enum(['A1', 'A3']);

export type TIcpCertType = z.infer<typeof ZIcpCertTypeSchema>;

/**
 * Leaf-first DER certificate chain (base64) the desktop agent submitted at prep
 * time. Stored on the session so the embed pass at complete time uses the exact
 * same certificate whose digest was captured (it is hashed into the ESS
 * signingCertificate attribute, so it MUST match bit-for-bit).
 */
export const ZIcpCertChainSchema = z.array(z.string()).min(1);

export type TIcpCertChain = z.infer<typeof ZIcpCertChainSchema>;
