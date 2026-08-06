import { env } from '../utils/env';

/**
 * Product identity, in one place.
 *
 * Anything a signer or an integrator can read — the product name, the social
 * handle stamped into share cards, the marketing site behind the email footer —
 * belongs here rather than inlined at a call site, so a rename is a single edit
 * instead of a repo-wide grep. Each value is env-overridable so a self-hosted
 * deployment can present its own identity without a rebuild.
 */
export const BRAND_NAME = () => env('NEXT_PUBLIC_BRAND_NAME') ?? 'CapivaSign';

/** Marketing site. Used by the email footer and "powered by" links. */
export const BRAND_URL = () => env('NEXT_PUBLIC_BRAND_URL') ?? 'https://capivapp.com.br';

/**
 * Social handle embedded in share intents and `twitter:site`. Includes the `@`.
 * Set to an empty string to drop the mention entirely.
 */
export const BRAND_SOCIAL_HANDLE = () => env('NEXT_PUBLIC_BRAND_SOCIAL_HANDLE') ?? '@capivapp';
