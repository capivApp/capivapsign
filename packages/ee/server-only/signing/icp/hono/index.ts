import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

import type { HonoIcpEnv } from './context';
import { icpSignRoutes } from './sign-routes';

/**
 * `@documenso/ee` ICP-Brasil subapp. Mount under `/api/icp` in the remix host
 * (alongside the CSC subapp). The desktop agent calls these endpoints to drive
 * the prepare/complete signing flow with the recipient's A1/A3 certificate.
 *
 * Routes throw `AppError`; `.onError` normalises them into REST responses
 * (mirrors the CSC subapp).
 */
export const icp = new Hono<HonoIcpEnv>().route('/sign', icpSignRoutes);

icp.onError((err, c) => {
  const logger = c.get('logger');

  if (err instanceof HTTPException) {
    return c.json({ code: AppErrorCode.UNKNOWN_ERROR, message: err.message, statusCode: err.status }, err.status);
  }

  if (err instanceof AppError) {
    const { status, body } = AppError.toRestAPIError(err);

    logger.error({ event: 'icp.error', code: err.code, message: err.message });

    return c.json(body, status as ContentfulStatusCode);
  }

  logger.error({ event: 'icp.unknown_error', error: err });

  return c.json({ code: AppErrorCode.UNKNOWN_ERROR, message: 'Internal Server Error', statusCode: 500 }, 500);
});

export type IcpAppType = typeof icp;
