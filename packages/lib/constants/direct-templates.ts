// Put into a separate file due to Playwright not compiling due to the macro in the templates.ts file.
export const DIRECT_TEMPLATE_RECIPIENT_EMAIL = 'direct.link@capivapp.com.br';

/**
 * Pre-rebrand sentinel. Direct-link recipients created before the rename still
 * carry it, so the migration `..._rebrand_direct_template_recipient` rewrites
 * them; this stays exported so any remaining row can still be recognised.
 */
export const LEGACY_DIRECT_TEMPLATE_RECIPIENT_EMAIL = 'direct.link@documenso.com';
export const DIRECT_TEMPLATE_RECIPIENT_NAME = 'Direct link recipient';
