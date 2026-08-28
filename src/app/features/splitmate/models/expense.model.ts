export interface Expense {
  id: string;
  title: string;
  amount: number;
  currency: string;
  paidBy: string;
  participantIds: string[];
  createdAt: string;
}