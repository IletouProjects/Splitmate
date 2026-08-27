export interface Expense {
  id: string;
  title: string;

  /**
   * Montant entier en FCFA.
   * Pas de décimales dans le MVP.
   */
  amount: number;

  /**
   * Identifiant de la personne ayant payé.
   */
  paidBy: string;

  /**
   * Participants concernés par la dépense.
   */
  participantIds: string[];

  /**
   * Date ISO pour faciliter la sérialisation localStorage.
   */
  createdAt: string;
}