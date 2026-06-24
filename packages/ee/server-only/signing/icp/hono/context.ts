import type { logger } from '@documenso/lib/utils/logger';

/**
 * ICP subapp Hono context. Mirrors the subset of the remix host's `HonoEnv`
 * the ICP handlers read, plus `desktopUserId` set by the device-token guard.
 * Duplicated (rather than imported from `apps/remix`) to keep the
 * `packages/ee` -> `apps/remix` dep direction unidirectional.
 */
export type HonoIcpEnv = {
  Variables: {
    logger: typeof logger;
    desktopUserId: number;
  };
};
