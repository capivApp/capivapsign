import type { TLicenseResponse } from '../../types/license';
import { env } from '../../utils/env';

/**
 * Where a licence claim comes from.
 *
 * The upstream project had exactly one answer — POST the key to a vendor-run
 * licence server — which is wrong for an instance whose operator *is* the
 * vendor: it makes every start-up depend on a third party, and leaves the
 * `billing` flag ungrantable, so turning Stripe on marks the instance
 * "unauthorized" forever.
 *
 * So the source is a strategy, chosen by `NEXT_PRIVATE_LICENSE_MODE`:
 *
 *   self   — the operator asserts their own instance's entitlements (default).
 *            No network call, no external dependency at boot.
 *   server — POST the key to `NEXT_PRIVATE_LICENSE_SERVER_URL`, for when a
 *            licence server is actually being run.
 *   none   — no licence at all; every gated feature stays closed.
 */
export type TLicenseMode = 'self' | 'server' | 'none';

export type LicenseSource = {
  /** Mode that produced this source, for logging. */
  readonly mode: TLicenseMode;

  /** Resolve the current claim, or null when no licence applies. */
  fetch(): Promise<TLicenseResponse | null>;
};

export const LICENSE_KEY = () => env('NEXT_PRIVATE_LICENSE_KEY');

const LICENSE_SERVER_URL = () => env('NEXT_PRIVATE_LICENSE_SERVER_URL');

/**
 * Every entitlement this codebase knows how to gate. `self` mode grants the
 * full set: the operator runs the instance, so there is nobody to withhold
 * features from.
 */
const ALL_FLAGS = {
  emailDomains: true,
  embedAuthoring: true,
  embedAuthoringWhiteLabel: true,
  cfr21: true,
  hipaa: true,
  authenticationPortal: true,
  billing: true,
  instanceCscSigning: true,
  cscQesSigning: true,
} as const;

/** Renewed far enough out that a self-hosted instance never expires on its own. */
const SELF_ISSUED_PERIOD_YEARS = 100;

const selfIssuedSource = (): LicenseSource => ({
  mode: 'self',
  // Resolved locally, so there is nothing to await — but the strategy contract
  // is async because the remote source needs it.
  fetch: () => {
    const periodEnd = new Date();
    periodEnd.setFullYear(periodEnd.getFullYear() + SELF_ISSUED_PERIOD_YEARS);

    return Promise.resolve({
      success: true,
      data: {
        status: 'ACTIVE' as const,
        createdAt: new Date(),
        name: 'CapivaSign (self-hosted)',
        periodEnd,
        cancelAtPeriodEnd: false,
        licenseKey: LICENSE_KEY() ?? 'self-hosted',
        flags: { ...ALL_FLAGS },
      },
    });
  },
});

const remoteSource = (): LicenseSource => ({
  mode: 'server',
  fetch: async () => {
    const key = LICENSE_KEY();
    const serverUrl = LICENSE_SERVER_URL();

    if (!key || !serverUrl) {
      return null;
    }

    const response = await fetch(new URL('api/license', serverUrl).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ license: key }),
    });

    if (!response.ok) {
      throw new Error(`License server returned ${response.status}: ${response.statusText}`);
    }

    // Parsed by the caller against ZLicenseResponseSchema.
    return (await response.json()) as TLicenseResponse;
  },
});

const noneSource = (): LicenseSource => ({
  mode: 'none',
  fetch: () => Promise.resolve(null),
});

const LICENSE_SOURCES: Record<TLicenseMode, () => LicenseSource> = {
  self: selfIssuedSource,
  server: remoteSource,
  none: noneSource,
};

/**
 * Resolve the configured mode. Anything unrecognised falls back to `self`
 * rather than throwing: a typo in an env var must not stop the app booting,
 * and `self` is the safe default for a self-operated instance.
 */
export const resolveLicenseMode = (): TLicenseMode => {
  const configured = env('NEXT_PRIVATE_LICENSE_MODE');

  if (configured && configured in LICENSE_SOURCES) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    return configured as TLicenseMode;
  }

  if (configured) {
    console.warn(`[License] Unknown NEXT_PRIVATE_LICENSE_MODE "${configured}"; falling back to "self".`);
  }

  return 'self';
};

export const createLicenseSource = (): LicenseSource => LICENSE_SOURCES[resolveLicenseMode()]();
