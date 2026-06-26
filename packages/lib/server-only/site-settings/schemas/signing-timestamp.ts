import { z } from 'zod';

import { ZSiteSettingsBaseSchema } from './_base';

export const SITE_SETTINGS_SIGNING_TIMESTAMP_ID = 'signing.timestamp';

/**
 * Controls whether a trusted timestamp is embedded into signatures.
 *
 * `enabled` (the default when the row is absent) keeps the full PAdES flow: a
 * B-T signature timestamp per recipient + the B-LTA archival `/DocTimeStamp`.
 * Disabling it produces a plain B-B signature (certificate only, no timestamp)
 * — useful when no RFC 3161 / ICP-Brasil TSA is available, so the document is
 * still signed without depending on (or paying for) a timestamp authority.
 */
export const ZSiteSettingsSigningTimestampSchema = ZSiteSettingsBaseSchema.extend({
  id: z.literal(SITE_SETTINGS_SIGNING_TIMESTAMP_ID),
  data: z.object({}).passthrough().optional().default({}),
});

export type TSiteSettingsSigningTimestampSchema = z.infer<typeof ZSiteSettingsSigningTimestampSchema>;
