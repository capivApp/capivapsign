import { AppError, AppErrorCode } from '../../errors/app-error';
import type { LicenseFlag, TCachedLicense } from '../../types/license';
import { LicenseClient } from './license-client';
import { LICENSE_KEY, resolveLicenseMode } from './license-source';

type AssertLicensedForOptions = {
  /**
   * Override the AppError code thrown when the assertion fails.
   *
   * Defaults to `AppErrorCode.FORBIDDEN`. Callers that need a more specific
   * surface — for example the CSC transport throwing `CSC_UNLICENSED` at
   * transport-create time — pass their own code here.
   */
  errorCode?: string;

  /**
   * Override the AppError message thrown when the assertion fails.
   */
  message?: string;
};

/**
 * Assert the configured licence grants `flag`. Reads the {@link LicenseClient}
 * cache; never re-resolves the licence itself.
 *
 * Behaviour depends on the licence mode (see {@link resolveLicenseMode}):
 *
 * - `none` → throws. Licensing explicitly switched off.
 * - `server` with no `NEXT_PRIVATE_LICENSE_KEY` → throws. A remote licence was
 *   asked for but nothing identifies this instance, so there is no claim to
 *   honour.
 * - Otherwise, claim unverifiable (no client, null cache, read throws,
 *   `license: null`) → passes. Mirrors how org-claim gates keep running on
 *   last known state when the licence source is unreachable; operators
 *   shouldn't be locked out by transient infra.
 * - Claim loaded and denies the flag (bad standing or flag falsy) → throws.
 */
export const assertLicensedFor = async (flag: LicenseFlag, options?: AssertLicensedForOptions): Promise<void> => {
  const denied = (): AppError =>
    new AppError(options?.errorCode ?? AppErrorCode.FORBIDDEN, {
      message: options?.message ?? `License does not include the "${flag}" feature.`,
    });

  const mode = resolveLicenseMode();

  // Licensing deliberately disabled — nothing is granted.
  if (mode === 'none') {
    throw denied();
  }

  // Remote licensing without a key = no licensing intent. Fail closed so an
  // unidentified instance cannot reach gated features just because the licence
  // cache happens to be empty. `self` mode needs no key: the operator's own
  // declaration is the grant.
  if (mode === 'server' && !LICENSE_KEY()) {
    throw denied();
  }

  let cached: TCachedLicense | null = null;

  const licenseClient = LicenseClient.getInstance();

  if (licenseClient) {
    cached = await licenseClient?.getCachedLicense().catch(() => null);
  }

  // Licence key is configured but we have no positively-verified claim to
  // check. Fail-open — see block comment for the full set of conditions and
  // rationale.
  if (!cached?.license) {
    return;
  }

  const inGoodStanding = cached.derivedStatus === 'ACTIVE' || cached.derivedStatus === 'PAST_DUE';

  const flagGranted = Boolean(cached.license.flags[flag]);

  if (!inGoodStanding || !flagGranted) {
    throw denied();
  }
};
