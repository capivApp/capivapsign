import { z } from 'zod';

/**
 * Per-page position overrides for the verification mark, keyed by
 * {@link pageStampOverrideKey} (`"{envelopeItemId}:{page}"`) → top-left
 * percentages. A page with an entry is placed there (CUSTOM); pages without one
 * fall back to `pageStampPosition`. Lets the sender drag the mark per page.
 *
 * NOTE: this lives in its own module (not `document-meta.ts`) because the
 * generated Prisma zod `DocumentMetaSchema` imports `ZPageStampOverridesSchema`
 * for the `@zod.custom.use` annotation. `document-meta.ts` imports that same
 * generated schema, so co-locating them would create a circular import that
 * evaluates `DocumentMetaSchema` as `undefined` at module init.
 */
export const ZPageStampOverridesSchema = z.record(
  z.string(),
  z.object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100) }),
);

export type TPageStampOverrides = z.infer<typeof ZPageStampOverridesSchema>;

export const pageStampOverrideKey = (envelopeItemId: string, page: number): string => `${envelopeItemId}:${page}`;
