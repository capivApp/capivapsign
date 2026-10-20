import { z } from 'zod';

export const SUPPORTED_LANGUAGE_CODES = ['de', 'en', 'fr', 'es', 'it', 'nl', 'pl', 'pt-BR', 'ja', 'ko', 'zh'] as const;

export type SupportedLanguageCodes = (typeof SUPPORTED_LANGUAGE_CODES)[number];

export const APP_I18N_OPTIONS = {
  supportedLangs: SUPPORTED_LANGUAGE_CODES,
  // Language the message ids are written in (Lingui catalogs). Not the default.
  sourceLang: 'en',
  defaultLang: 'pt-BR',
  defaultLocale: 'pt-BR',
} as const;

export const ZSupportedLanguageCodeSchema = z.enum(SUPPORTED_LANGUAGE_CODES).catch(APP_I18N_OPTIONS.defaultLang);

export const isValidLanguageCode = (code: unknown): code is SupportedLanguageCodes =>
  SUPPORTED_LANGUAGE_CODES.includes(code as SupportedLanguageCodes);
