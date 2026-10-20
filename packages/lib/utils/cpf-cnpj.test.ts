import { describe, expect, it } from 'vitest';

import { formatCpfCnpj, isValidCpfCnpj, normalizeCpfCnpj, ZCpfCnpjSchema } from './cpf-cnpj';

describe('normalizeCpfCnpj', () => {
  it('strips the mask and uppercases letters', () => {
    expect(normalizeCpfCnpj('529.982.247-25')).toBe('52998224725');
    expect(normalizeCpfCnpj('11.222.333/0001-81')).toBe('11222333000181');
    expect(normalizeCpfCnpj('12.abc.345/01de-35')).toBe('12ABC34501DE35');
  });
});

describe('isValidCpfCnpj', () => {
  it('accepts valid CPFs', () => {
    expect(isValidCpfCnpj('52998224725')).toBe(true);
    expect(isValidCpfCnpj('529.982.247-25')).toBe(true);
  });

  it('rejects CPFs with a wrong check digit or repeated digits', () => {
    expect(isValidCpfCnpj('52998224724')).toBe(false);
    expect(isValidCpfCnpj('11111111111')).toBe(false);
  });

  it('accepts valid numeric CNPJs', () => {
    expect(isValidCpfCnpj('11222333000181')).toBe(true);
    expect(isValidCpfCnpj('11.222.333/0001-81')).toBe(true);
  });

  it('accepts valid alphanumeric CNPJs', () => {
    expect(isValidCpfCnpj('12.ABC.345/01DE-35')).toBe(true);
  });

  it('rejects CNPJs with a wrong check digit or repeated digits', () => {
    expect(isValidCpfCnpj('11222333000182')).toBe(false);
    expect(isValidCpfCnpj('12ABC34501DE36')).toBe(false);
    expect(isValidCpfCnpj('00000000000000')).toBe(false);
  });

  it('rejects anything that is neither 11 nor 14 characters', () => {
    expect(isValidCpfCnpj('')).toBe(false);
    expect(isValidCpfCnpj('123')).toBe(false);
    expect(isValidCpfCnpj('5299822472512')).toBe(false);
  });
});

describe('ZCpfCnpjSchema', () => {
  it('returns the normalized value', () => {
    expect(ZCpfCnpjSchema.parse('11.222.333/0001-81')).toBe('11222333000181');
  });

  it('explains the problem in Portuguese', () => {
    const result = ZCpfCnpjSchema.safeParse('123');

    expect(result.success).toBe(false);
    expect(result.error?.issues[0].message).toBe('Informe um CPF ou CNPJ válido.');
  });
});

describe('formatCpfCnpj', () => {
  it('applies the CPF and CNPJ masks', () => {
    expect(formatCpfCnpj('52998224725')).toBe('529.982.247-25');
    expect(formatCpfCnpj('11222333000181')).toBe('11.222.333/0001-81');
    expect(formatCpfCnpj('12ABC34501DE35')).toBe('12.ABC.345/01DE-35');
  });

  it('leaves values of any other length as they are', () => {
    expect(formatCpfCnpj('123')).toBe('123');
  });
});
