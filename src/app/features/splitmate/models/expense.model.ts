export interface Expense {
  id: string;
  title: string;

  /**
   * Montant stocké dans la plus petite unité monétaire.
   *
   * Exemples :
   * - XOF : 12 500 FCFA -> 12 500
   * - EUR : 12,50 € -> 1 250 centimes
   * - USD : 12,50 $ -> 1 250 cents
   *
   * Cela évite les erreurs d'arrondi des nombres décimaux.
   */
  amount: number;

  paidBy: string;
  participantIds: string[];
  createdAt: string;
}
