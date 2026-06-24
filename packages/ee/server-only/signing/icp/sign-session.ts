import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import {
  type TIcpCertChain,
  type TIcpCertType,
  type TIcpSignSessionItems,
  ZIcpCertChainSchema,
  ZIcpCertTypeSchema,
  ZIcpSignSessionItemsSchema,
} from '@documenso/lib/types/icp-sign-session';
import { prisma } from '@documenso/prisma';
import { Prisma } from '@prisma/client';

/**
 * DB helpers for `IcpSignSession` — the per-recipient transient row that bridges
 * `prepare` (capture the per-item digests) and `complete` (embed the
 * desktop-produced signatures). Mirror of `csc/sign-session.ts`, minus the
 * CSC OAuth/SAD round-trip: there is no cloud credential, so the chosen leaf
 * cert chain + hardware tier travel on the session itself.
 *
 * `itemsJson` and `certChainJson` are parsed through their Zod schemas on every
 * read so callers work with typed values.
 */

export type IcpSignSessionRow = {
  id: string;
  recipientId: number;
  envelopeId: string;
  signingTime: Date;
  items: TIcpSignSessionItems;
  certChain: TIcpCertChain;
  certType: TIcpCertType;
  createdAt: Date;
};

type UpsertIcpSignSessionInput = {
  recipientId: number;
  envelopeId: string;
  signingTime: Date;
  items: TIcpSignSessionItems;
  certChain: TIcpCertChain;
  certType: TIcpCertType;
};

/**
 * Create or refresh the per-recipient session at prep time. The recipient has
 * at most one in-flight session (`@@unique([recipientId])`); re-clicking Sign
 * overwrites the prior items/chain so a fresh capture starts clean.
 */
export const upsertIcpSignSession = async (input: UpsertIcpSignSessionInput): Promise<IcpSignSessionRow> => {
  const { recipientId, envelopeId, signingTime, items, certChain, certType } = input;

  const row = await prisma.icpSignSession.upsert({
    where: { recipientId },
    create: {
      recipientId,
      envelopeId,
      signingTime,
      itemsJson: items,
      certChainJson: certChain,
      certType,
    },
    update: {
      envelopeId,
      signingTime,
      itemsJson: items,
      certChainJson: certChain,
      certType,
    },
  });

  return toIcpSignSessionRow(row);
};

/** Fetch a session by id. Returns `null` when absent (caller must handle). */
export const loadIcpSignSession = async (sessionId: string): Promise<IcpSignSessionRow | null> => {
  const row = await prisma.icpSignSession.findUnique({ where: { id: sessionId } });

  return row ? toIcpSignSessionRow(row) : null;
};

/**
 * Atomically delete the session and return its parsed contents, so the
 * `complete` success path still has the data for post-sign side effects.
 * Throws `NOT_FOUND` when already consumed (a raced double-complete).
 */
export const consumeIcpSignSession = async (
  sessionId: string,
  tx?: Prisma.TransactionClient,
): Promise<IcpSignSessionRow> => {
  const client = tx ?? prisma;

  try {
    const row = await client.icpSignSession.delete({ where: { id: sessionId } });

    return toIcpSignSessionRow(row);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: `ICP sign session "${sessionId}" already consumed or never existed.`,
      });
    }

    throw err;
  }
};

const toIcpSignSessionRow = (row: {
  id: string;
  recipientId: number;
  envelopeId: string;
  signingTime: Date;
  itemsJson: Prisma.JsonValue;
  certChainJson: Prisma.JsonValue;
  certType: string;
  createdAt: Date;
}): IcpSignSessionRow => ({
  id: row.id,
  recipientId: row.recipientId,
  envelopeId: row.envelopeId,
  signingTime: row.signingTime,
  items: ZIcpSignSessionItemsSchema.parse(row.itemsJson),
  certChain: ZIcpCertChainSchema.parse(row.certChainJson),
  certType: ZIcpCertTypeSchema.parse(row.certType),
  createdAt: row.createdAt,
});
