import { Injectable } from '@angular/core';

import { ParticipantBalance } from '../models/balance.model';
import { Expense } from '../models/expense.model';
import { SplitGroup } from '../models/group.model';
import { Settlement } from '../models/settlement.model';

@Injectable({
  providedIn: 'root',
})
export class SettlementService {

  /**
   * Calcule le montant payé, dû et le solde
   * de chaque participant du groupe.
   */
  calculateBalances(group: SplitGroup): ParticipantBalance[] {
    const balances = new Map<string, ParticipantBalance>();

    for (const participant of group.participants) {
      balances.set(participant.id, {
        participantId: participant.id,
        participantName: participant.name,
        paid: 0,
        owed: 0,
        balance: 0,
      });
    }

    for (const expense of group.expenses) {
      this.validateExpense(expense, balances);

      const payerBalance = balances.get(expense.paidBy)!;

      payerBalance.paid += expense.amount;

      const beneficiaryIds = [
        ...new Set(expense.participantIds),
      ].sort();

      const baseShare = Math.floor(
        expense.amount / beneficiaryIds.length,
      );

      const remainder =
        expense.amount % beneficiaryIds.length;

      beneficiaryIds.forEach((participantId, index) => {
        const participantBalance = balances.get(participantId)!;

        /**
         * Exemple :
         *
         * 10 000 / 3
         *
         * 3334
         * 3333
         * 3333
         *
         * Total = 10 000
         */
        const share =
          baseShare + (index < remainder ? 1 : 0);

        participantBalance.owed += share;
      });
    }

    return [...balances.values()].map((item) => ({
      ...item,
      balance: item.paid - item.owed,
    }));
  }

  /**
   * Transforme les soldes en remboursements.
   *
   * Un solde positif doit recevoir.
   * Un solde négatif doit payer.
   */
  calculateSettlements(
    balances: ParticipantBalance[],
  ): Settlement[] {
    const totalBalance = balances.reduce(
      (total, item) => total + item.balance,
      0,
    );

    if (totalBalance !== 0) {
      throw new Error(
        `Les soldes sont incohérents : somme = ${totalBalance} FCFA.`,
      );
    }

    const creditors = balances
      .filter((item) => item.balance > 0)
      .map((item) => ({
        participantId: item.participantId,
        participantName: item.participantName,
        remaining: item.balance,
      }))
      .sort(
        (a, b) =>
          b.remaining - a.remaining ||
          a.participantId.localeCompare(b.participantId),
      );

    const debtors = balances
      .filter((item) => item.balance < 0)
      .map((item) => ({
        participantId: item.participantId,
        participantName: item.participantName,
        remaining: Math.abs(item.balance),
      }))
      .sort(
        (a, b) =>
          b.remaining - a.remaining ||
          a.participantId.localeCompare(b.participantId),
      );

    const settlements: Settlement[] = [];

    let debtorIndex = 0;
    let creditorIndex = 0;

    while (
      debtorIndex < debtors.length &&
      creditorIndex < creditors.length
    ) {
      const debtor = debtors[debtorIndex];
      const creditor = creditors[creditorIndex];

      const amount = Math.min(
        debtor.remaining,
        creditor.remaining,
      );

      settlements.push({
        fromParticipantId: debtor.participantId,
        fromParticipantName: debtor.participantName,

        toParticipantId: creditor.participantId,
        toParticipantName: creditor.participantName,

        amount,
      });

      debtor.remaining -= amount;
      creditor.remaining -= amount;

      if (debtor.remaining === 0) {
        debtorIndex++;
      }

      if (creditor.remaining === 0) {
        creditorIndex++;
      }
    }

    return settlements;
  }

  private validateExpense(
    expense: Expense,
    balances: Map<string, ParticipantBalance>,
  ): void {
    if (
      !Number.isInteger(expense.amount) ||
      expense.amount <= 0
    ) {
      throw new Error(
        `Montant invalide pour la dépense "${expense.title}".`,
      );
    }

    if (!balances.has(expense.paidBy)) {
      throw new Error(
        `Le payeur de la dépense "${expense.title}" n'existe pas dans le groupe.`,
      );
    }

    if (expense.participantIds.length === 0) {
      throw new Error(
        `La dépense "${expense.title}" ne contient aucun bénéficiaire.`,
      );
    }

    const uniqueParticipants = new Set(
      expense.participantIds,
    );

    if (
      uniqueParticipants.size !==
      expense.participantIds.length
    ) {
      throw new Error(
        `La dépense "${expense.title}" contient des participants en double.`,
      );
    }

    for (const participantId of uniqueParticipants) {
      if (!balances.has(participantId)) {
        throw new Error(
          `Un participant de la dépense "${expense.title}" n'existe pas dans le groupe.`,
        );
      }
    }
  }
}