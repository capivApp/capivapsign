/**
 * Format a Stripe minor-unit amount as money in its own currency.
 *
 * Stripe reports the currency per price, so it has to drive the symbol:
 * hardcoding one turns a BRL plan into "$50 BRL" on the pricing page — wrong
 * symbol, wrong reading order, and duplicated currency code.
 *
 * Trailing ".00" is dropped so round plan prices read as "R$ 50" rather than
 * "R$ 50,00", matching how plans are normally advertised.
 */
export const formatStripePrice = (amountInMinorUnits: number, currency: string, locale = 'pt-BR') => {
  const formatted = new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amountInMinorUnits / 100);

  // Strip a zero fractional part, whichever separator this locale uses.
  return formatted.replace(/[.,]00\b/, '');
};
