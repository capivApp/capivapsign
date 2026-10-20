import type { I18n, MessageDescriptor } from '@lingui/core';
import { i18n } from '@lingui/core';
import type { MacroMessageDescriptor } from '@lingui/core/macro';

import type { SupportedLanguageCodes } from '../constants/locales';
import { APP_I18N_OPTIONS, isValidLanguageCode } from '../constants/locales';
import { env } from './env';

export async function getTranslations(locale: string) {
  const extension = env('NODE_ENV') === 'development' ? 'po' : 'mjs';

  const { messages } = await import(`../translations/${locale}/web.${extension}`);

  return messages;
}

export async function dynamicActivate(locale: string) {
  const messages = await getTranslations(locale);

  i18n.loadAndActivate({ locale, messages });
}

const parseLanguageFromLocale = (locale: string): SupportedLanguageCodes | null => {
  const normalized = locale.trim().toLowerCase();
  const [language] = normalized.split('-');

  // Match the full locale first (e.g. "pt-BR"), then fall back to the language
  // subtag (e.g. "en-US" -> "en"). Comparing on the language subtag alone broke
  // region-qualified supported codes: "pt-BR" was stripped to "pt", which is NOT
  // in supportedLangs, so Brazilian browsers silently fell back to English.
  const foundSupportedLanguage = APP_I18N_OPTIONS.supportedLangs.find((lang): lang is SupportedLanguageCodes => {
    const [supportedLanguage] = lang.toLowerCase().split('-');

    return lang.toLowerCase() === normalized || supportedLanguage === language;
  });

  return foundSupportedLanguage ?? null;
};

/**
 * Extracts the language from the `accept-language` header.
 */
export const extractLocaleDataFromHeaders = (
  headers: Headers,
): { lang: SupportedLanguageCodes | null; locales: string[] } => {
  const headerLocales = (headers.get('accept-language') ?? '').split(',');

  const language = parseLanguageFromLocale(headerLocales[0]);

  return {
    lang: language,
    locales: [headerLocales[0]],
  };
};

/**
 * The language a page is rendered in: the one the visitor picked in the
 * language switcher (cookie), otherwise the app default. The browser's
 * `accept-language` is ignored on purpose so everyone starts in pt-BR.
 */
export const getRequestLanguage = (cookieLanguage: unknown): SupportedLanguageCodes =>
  isValidLanguageCode(cookieLanguage) ? cookieLanguage : APP_I18N_OPTIONS.defaultLang;

export const parseMessageDescriptor = (_: I18n['_'], value: string | MessageDescriptor) => {
  return typeof value === 'string' ? value : _(value);
};

export const parseMessageDescriptorMacro = (
  t: (descriptor: MacroMessageDescriptor) => string,
  value: string | MessageDescriptor,
) => {
  return typeof value === 'string' ? value : t(value);
};
