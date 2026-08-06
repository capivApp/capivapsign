import fs from 'node:fs/promises';
import path from 'node:path';

import { prisma } from '@documenso/prisma';

import { IS_BILLING_ENABLED } from '../../constants/app';
import type { TLicenseClaim } from '../../types/license';
import {
  LICENSE_FILE_NAME,
  type TCachedLicense,
  type TLicenseResponse,
  ZCachedLicenseSchema,
  ZLicenseResponseSchema,
} from '../../types/license';
import { SUBSCRIPTION_CLAIM_FEATURE_FLAGS } from '../../types/subscription';
import { createLicenseSource, LICENSE_KEY } from './license-source';

declare global {
  // eslint-disable-next-line no-var
  var __capivasign_license_client__: LicenseClient | undefined;
}

export class LicenseClient {
  /**
   * We cache the license in memory incase there is permission issues with
   * retrieving the license from the local file system.
   */
  private cachedLicense: TCachedLicense | null = null;

  private constructor() {}

  /**
   * Start the license client.
   *
   * This will ping the license server with the configured license key and store
   * the response locally in a JSON file.
   *
   * Uses globalThis to store the singleton instance so that it's shared across
   * different bundles (e.g. Hono and Remix) at runtime.
   */
  public static async start(): Promise<void> {
    if (globalThis.__capivasign_license_client__) {
      return;
    }

    const instance = new LicenseClient();

    globalThis.__capivasign_license_client__ = instance;

    try {
      await instance.initialize();
    } catch (err) {
      // Do nothing.
      console.error('[License] Failed to verify license:', err);
    }
  }

  /**
   * Get the current license client instance.
   *
   * Returns the shared instance from globalThis, ensuring both Hono and Remix
   * bundles access the same instance.
   */
  public static getInstance(): LicenseClient | null {
    return globalThis.__capivasign_license_client__ ?? null;
  }

  public async getCachedLicense(): Promise<TCachedLicense | null> {
    if (this.cachedLicense) {
      return this.cachedLicense;
    }

    const localLicenseFile = await this.loadFromFile();

    return localLicenseFile;
  }

  /**
   * Force resync the license from the license server.
   *
   * This will re-ping the license server and update the cached license file.
   */
  public async resync(): Promise<void> {
    await this.initialize();
  }

  private async initialize(): Promise<void> {
    const source = createLicenseSource();

    console.log(`[License] Resolving license (mode: ${source.mode})...`);

    const cachedLicense = await this.loadFromFile();

    if (cachedLicense) {
      this.cachedLicense = cachedLicense;
    }

    let response: TLicenseResponse | null = null;

    try {
      const raw = await source.fetch();

      response = raw === null ? null : ZLicenseResponseSchema.parse(raw);
    } catch (err) {
      // Source unreachable or malformed — keep running on the cached claim
      // rather than degrading a working instance.
      console.warn('[License] Could not resolve license, using cached license.');
      console.error(err);
      return;
    }

    const allowedFlags = response?.data?.flags || {};

    // Check for unauthorized flag usage
    const unauthorizedFlagUsage = await this.checkUnauthorizedFlagUsage(allowedFlags);

    if (unauthorizedFlagUsage) {
      console.warn('[License] Found unauthorized flag usage.');
    }

    let status: TCachedLicense['derivedStatus'] = 'NOT_FOUND';

    if (response?.data?.status) {
      status = response.data.status;
    }

    if (unauthorizedFlagUsage) {
      status = 'UNAUTHORIZED';
    }

    const data: TCachedLicense = {
      lastChecked: new Date().toISOString(),
      license: response?.data || null,
      requestedLicenseKey: LICENSE_KEY(),
      unauthorizedFlagUsage,
      derivedStatus: status,
    };

    this.cachedLicense = data;
    await this.saveToFile(data);

    console.log('[License] License check completed successfully.');
    console.log(`[License] Unauthorized Flag Usage: ${unauthorizedFlagUsage ? 'Yes' : 'No'}`);
    console.log(`[License] Derived Status: ${status}`);
    console.log(`[License] Status: ${response?.data?.status}`);
    console.log(`[License] Flags: ${JSON.stringify(allowedFlags)}`);
  }

  private async saveToFile(data: TCachedLicense): Promise<void> {
    const licenseFilePath = path.join(process.cwd(), LICENSE_FILE_NAME);

    try {
      await fs.writeFile(licenseFilePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      console.error('[License] Failed to save license file:', error);
    }
  }

  private async loadFromFile(): Promise<TCachedLicense | null> {
    const licenseFilePath = path.join(process.cwd(), LICENSE_FILE_NAME);

    try {
      const fileContents = await fs.readFile(licenseFilePath, 'utf-8');

      return ZCachedLicenseSchema.parse(JSON.parse(fileContents));
    } catch {
      return null;
    }
  }

  /**
   * Check if any organisation claims are using flags that are not permitted by the current license.
   */
  private async checkUnauthorizedFlagUsage(licenseFlags: Partial<TLicenseClaim>): Promise<boolean> {
    // Get flags that are NOT permitted by the license by subtracting the allowed flags from the license flags.
    const disallowedFlags = Object.values(SUBSCRIPTION_CLAIM_FEATURE_FLAGS).filter(
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      (flag) => flag.isEnterprise && !licenseFlags[flag.key as keyof TLicenseClaim],
    );

    let unauthorizedFlagUsage = false;

    if (IS_BILLING_ENABLED() && !licenseFlags.billing) {
      unauthorizedFlagUsage = true;
    }

    try {
      const organisationWithUnauthorizedFlags = await prisma.organisationClaim.findFirst({
        where: {
          OR: disallowedFlags.map((flag) => ({
            flags: {
              path: [flag.key],
              equals: true,
            },
          })),
        },
        select: {
          id: true,
          organisation: {
            select: {
              id: true,
            },
          },
          flags: true,
        },
      });

      if (organisationWithUnauthorizedFlags) {
        unauthorizedFlagUsage = true;
      }
    } catch (error) {
      console.error('[License] Failed to check unauthorized flag usage:', error);
    }

    return unauthorizedFlagUsage;
  }
}
