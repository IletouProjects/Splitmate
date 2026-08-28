export interface CurrencyOption {
  code: string;
  label: string;
  decimals: number;
}

export const SUPPORTED_CURRENCIES: CurrencyOption[] = [
  {
    code: 'XOF',
    label: 'Franc CFA BCEAO',
    decimals: 0,
  },
  {
    code: 'XAF',
    label: 'Franc CFA CEMAC',
    decimals: 0,
  },
  {
    code: 'EUR',
    label: 'Euro',
    decimals: 2,
  },
  {
    code: 'USD',
    label: 'Dollar américain',
    decimals: 2,
  },
  {
    code: 'CAD',
    label: 'Dollar canadien',
    decimals: 2,
  },
  {
    code: 'GBP',
    label: 'Livre sterling',
    decimals: 2,
  },
  {
    code: 'NGN',
    label: 'Naira nigérian',
    decimals: 2,
  },
  {
    code: 'GHS',
    label: 'Cedi ghanéen',
    decimals: 2,
  },
  {
    code: 'MAD',
    label: 'Dirham marocain',
    decimals: 2,
  },
];