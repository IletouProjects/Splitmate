import { CurrencyCode } from './currency.model';
import { Expense } from './expense.model';
import { Participant } from './participant.model';

export interface SplitGroup {
  id: string;
  name: string;
  currency: CurrencyCode;
  participants: Participant[];
  expenses: Expense[];
  createdAt: string;
}
