/**
 * Formatting shared by the bill (Asaas description, PDF statement) and the
 * billing screens.
 */

const brlFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

// Intl puts a no-break space after "R$"; a plain one keeps PDFs and the Asaas
// description predictable.
export const formatBrl = (cents: number) => brlFormatter.format(cents / 100).replace(/\s/g, ' ');

const quantityFormatter = new Intl.NumberFormat('pt-BR');

export const formatQuantity = (quantity: number) => quantityFormatter.format(quantity);

export const formatPeriod = (period: string) => period.split('-').reverse().join('/');
