import { z } from 'zod';

const CPF_WEIGHTS = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2];
const CNPJ_WEIGHTS = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

/** Removes the mask; letters are kept (uppercased) for alphanumeric CNPJs. */
export const normalizeCpfCnpj = (value: string) => value.replace(/[^0-9a-z]/gi, '').toUpperCase();

// Receita Federal's rule, valid for numeric and alphanumeric CNPJs alike: each
// character is worth its ASCII code minus 48 ("0" = 0, "A" = 17).
const toValues = (value: string) => [...value].map((char) => char.charCodeAt(0) - 48);

const getCheckDigit = (values: number[], weights: number[]) => {
  const offset = weights.length - values.length;
  const remainder = values.reduce((sum, value, index) => sum + value * weights[index + offset], 0) % 11;

  return remainder < 2 ? 0 : 11 - remainder;
};

const hasValidCheckDigits = (value: string, weights: number[]) => {
  const body = toValues(value.slice(0, -2));
  const first = getCheckDigit(body, weights);
  const second = getCheckDigit([...body, first], weights);

  return value.endsWith(`${first}${second}`);
};

const isRepeatedDigit = (value: string) => /^(\d)\1+$/.test(value);

const VALIDATOR_BY_LENGTH: Record<number, (value: string) => boolean> = {
  11: (value) => /^\d{11}$/.test(value) && hasValidCheckDigits(value, CPF_WEIGHTS),
  14: (value) => /^[0-9A-Z]{12}\d{2}$/.test(value) && hasValidCheckDigits(value, CNPJ_WEIGHTS),
};

export const isValidCpfCnpj = (value: string) => {
  const normalized = normalizeCpfCnpj(value);
  const validate = VALIDATOR_BY_LENGTH[normalized.length];

  return Boolean(validate) && !isRepeatedDigit(normalized) && validate(normalized);
};

export const ZCpfCnpjSchema = z
  .string()
  .refine(isValidCpfCnpj, 'Informe um CPF ou CNPJ válido.')
  .transform(normalizeCpfCnpj);
