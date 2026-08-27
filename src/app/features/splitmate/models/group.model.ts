import { Expense } from './expense.model';
import { Participant } from './participant.model';

export interface SplitGroup {
  id: string;
  name: string;
  participants: Participant[];
  expenses: Expense[];
  createdAt: string;
}