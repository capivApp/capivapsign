import { describe, expect, it } from 'vitest';

import { APP_I18N_OPTIONS, ZSupportedLanguageCodeSchema } from '../constants/locales';
import { getRequestLanguage } from './i18n';
import { generateDefaultOrganisationSettings } from './organisations';

describe('default language', () => {
  it('is Brazilian Portuguese while English stays the catalog source', () => {
    expect(APP_I18N_OPTIONS.defaultLang).toBe('pt-BR');
    expect(APP_I18N_OPTIONS.defaultLocale).toBe('pt-BR');
    expect(APP_I18N_OPTIONS.sourceLang).toBe('en');
  });

  it('falls back to pt-BR when a stored language is missing or unknown', () => {
    expect(ZSupportedLanguageCodeSchema.parse(undefined)).toBe('pt-BR');
    expect(ZSupportedLanguageCodeSchema.parse('xx')).toBe('pt-BR');
    expect(ZSupportedLanguageCodeSchema.parse('en')).toBe('en');
  });

  it('starts new organisations with pt-BR documents', () => {
    expect(generateDefaultOrganisationSettings().documentLanguage).toBe('pt-BR');
  });
});

describe('getRequestLanguage', () => {
  it('uses pt-BR when the visitor has not picked a language', () => {
    expect(getRequestLanguage(undefined)).toBe('pt-BR');
    expect(getRequestLanguage(null)).toBe('pt-BR');
  });

  it('ignores an unsupported language cookie', () => {
    expect(getRequestLanguage('xx')).toBe('pt-BR');
  });

  it('keeps the language the visitor picked', () => {
    expect(getRequestLanguage('en')).toBe('en');
    expect(getRequestLanguage('es')).toBe('es');
  });
});
