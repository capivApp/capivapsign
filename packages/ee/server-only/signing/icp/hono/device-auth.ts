import type { MiddlewareHandler } from 'hono';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { hashString } from '@documenso/lib/server-only/auth/hash';
import { prisma } from '@documenso/prisma';

import type { HonoIcpEnv } from './context';

/**
 * Device-token guard for the ICP desktop API.
 *
 * The desktop pairs once and stores a device token in the OS keyring; it sends
 * it as `Authorization: Bearer <token>`. Only the SHA-512 hash is persisted on
 * `DesktopSession` (same scheme as `ApiToken`), so we hash the presented token
 * and look the row up by `tokenHash`, rejecting revoked or expired sessions.
 * On success the resolved `userId` is exposed as `desktopUserId`.
 */
/**
 * Optional device-token attachment for the capability-based flow.
 *
 * The standalone agent (CMD / deep-link) authorises with the recipient token
 * (`prepare`) and the session id (`complete`) — both unguessable, single-use
 * capabilities with the same trust as the signing link itself. A paired desktop
 * MAY additionally present a device token; when it does and it is valid, we
 * attach `desktopUserId`. An absent token is fine; an invalid one is rejected so
 * a stale/forged token can't masquerade as paired.
 */
export const attachDesktopSessionIfPresent: MiddlewareHandler<HonoIcpEnv> = async (c, next) => {
  const header = c.req.header('authorization') ?? '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';

  if (token) {
    const session = await prisma.desktopSession.findUnique({ where: { tokenHash: hashString(token) } });

    if (!session || session.revokedAt !== null) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, { message: 'Device token is invalid or revoked.' });
    }
    if (session.expiresAt !== null && session.expiresAt.getTime() <= Date.now()) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, { message: 'Device token expired.' });
    }

    await prisma.desktopSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });
    c.set('desktopUserId', session.userId);
  }

  await next();
};

export const requireDesktopSession: MiddlewareHandler<HonoIcpEnv> = async (c, next) => {
  const header = c.req.header('authorization') ?? '';
  const token = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';

  if (!token) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, { message: 'Missing device token.' });
  }

  const session = await prisma.desktopSession.findUnique({ where: { tokenHash: hashString(token) } });

  if (!session || session.revokedAt !== null) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, { message: 'Device token is invalid or revoked.' });
  }

  if (session.expiresAt !== null && session.expiresAt.getTime() <= Date.now()) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, { message: 'Device token expired.' });
  }

  await prisma.desktopSession.update({ where: { id: session.id }, data: { lastSeenAt: new Date() } });

  c.set('desktopUserId', session.userId);

  await next();
};
