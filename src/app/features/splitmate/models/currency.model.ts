export type CurrencyCode = 'XOF' | 'EUR' | 'USD' | 'GBP' | 'CAD';

export interface CurrencyOption {
  code: CurrencyCode;
  label: string;
  symbol: string;
  locale: string;
  minorUnitFactor: number;
}

export const CURRENCIES: readonly CurrencyOption[] = [
  {
    code: 'XOF',
    label: 'Franc CFA',
    symbol: 'FCFA',
    locale: 'fr-FR',
    minorUnitFactor: 1,
  },
  {
    code: 'EUR',
    label: 'Euro',
    symbol: '€',
    locale: 'fr-FR',
    minorUnitFactor: 100,
  },
  {
    code: 'USD',
    label: 'Dollar US',
    symbol: '$',
    locale: 'en-US',
    minorUnitFactor: 100,
  },
  {
    code: 'GBP',
    label: 'Livre sterling',
    symbol: '£',
    locale: 'en-GB',
    minorUnitFactor: 100,
  },
  {
    code: 'CAD',
    label: 'Dollar canadien',
    symbol: '$CA',
    locale: 'fr-CA',
    minorUnitFactor: 100,
  },
] as const;

export function getCurrency(code: CurrencyCode): CurrencyOption {
  const currency = CURRENCIES.find((item) => item.code === code);

  if (!currency) {
    throw new Error(`Devise non prise en charge : ${code}.`);
  }

  return currency;
}
