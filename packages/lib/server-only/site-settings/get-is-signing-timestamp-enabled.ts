import { getSiteSettings } from './get-site-settings';
import { SITE_SETTINGS_SIGNING_TIMESTAMP_ID } from './schemas/signing-timestamp';

/**
 * Whether signatures should embed a trusted timestamp (PAdES B-T per recipient +
 * the B-LTA archival `/DocTimeStamp`).
 *
 * Defaults to `true` when the admin setting has never been saved, so existing
 * instances keep the full timestamped flow. An admin can turn it off (no TSA
 * available / desired), producing certificate-only B-B signatures.
 */
export const getIsSigningTimestampEnabled = async (): Promise<boolean> => {
  const settings = await getSiteSettings().catch(() => []);

  const setting = settings.find((item) => item.id === SITE_SETTINGS_SIGNING_TIMESTAMP_ID);

  return setting ? setting.enabled : true;
};
