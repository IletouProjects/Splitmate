import { Injectable } from '@angular/core';

import { ParticipantBalance } from '../models/balance.model';
import { Expense } from '../models/expense.model';
import { SplitGroup } from '../models/group.model';
import { Settlement } from '../models/settlement.model';

@Injectable({
  providedIn: 'root',
})
export class SettlementService {

  calculateBalances(group: SplitGroup): ParticipantBalance[] {
    const balances = new Map<string, ParticipantBalance>();

    for (const expense of group.expenses) {
      this.validateExpense(expense, group);

      const beneficiaryIds = [...new Set(expense.participantIds)].sort();

      const baseShare = Math.floor(
        expense.amount / beneficiaryIds.length
      );

      const remainder =
        expense.amount % beneficiaryIds.length;

      /*
       * Le payeur est crédité du montant total
       * dans la devise de la dépense.
       */
      const payer = group.participants.find(
        participant => participant.id === expense.paidBy
      )!;

      const payerBalance = this.getOrCreateBalance(
        balances,
        payer.id,
        payer.name,
        expense.currency
      );

      payerBalance.paid += expense.amount;

      /*
       * Répartition exacte entre les bénéficiaires.
       *
       * Exemple :
       * 10 000 / 3
       * = 3334 + 3333 + 3333
       */
      beneficiaryIds.forEach((participantId, index) => {
        const participant = group.participants.find(
          item => item.id === participantId
        )!;

        const participantBalance =
          this.getOrCreateBalance(
            balances,
            participant.id,
            participant.name,
            expense.currency
          );

        const share =
          baseShare + (index < remainder ? 1 : 0);

        participantBalance.owed += share;
      });
    }

    const result = Array.from(balances.values()).map(
      balance => ({
        ...balance,
        balance: balance.paid - balance.owed,
      })
    );

    this.validateBalances(result);

    return result;
  }

  calculateSettlements(
    balances: ParticipantBalance[]
  ): Settlement[] {

    const settlements: Settlement[] = [];

    /*
     * On traite chaque devise séparément.
     */
    const currencies = [
      ...new Set(
        balances.map(balance => balance.currency)
      ),
    ];

    for (const currency of currencies) {

      const currencyBalances =
        balances.filter(
          balance => balance.currency === currency
        );

      const total = currencyBalances.reduce(
        (sum, item) => sum + item.balance,
        0
      );

      if (total !== 0) {
        throw new Error(
          `Les soldes ${currency} ne sont pas équilibrés.`
        );
      }

      const creditors = currencyBalances
        .filter(item => item.balance > 0)
        .map(item => ({
          ...item,
          remaining: item.balance,
        }))
        .sort(
          (a, b) =>
            b.remaining - a.remaining ||
            a.participantId.localeCompare(
              b.participantId
            )
        );

      const debtors = currencyBalances
        .filter(item => item.balance < 0)
        .map(item => ({
          ...item,
          remaining: Math.abs(item.balance),
        }))
        .sort(
          (a, b) =>
            b.remaining - a.remaining ||
            a.participantId.localeCompare(
              b.participantId
            )
        );

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
          creditor.remaining
        );

        settlements.push({
          fromParticipantId: debtor.participantId,
          fromParticipantName:
            debtor.participantName,

          toParticipantId:
            creditor.participantId,
          toParticipantName:
            creditor.participantName,

          amount,
          currency,
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
    }

    return settlements;
  }

  private getOrCreateBalance(
    balances: Map<string, ParticipantBalance>,
    participantId: string,
    participantName: string,
    currency: string
  ): ParticipantBalance {

    const key =
      `${participantId}-${currency}`;

    let balance = balances.get(key);

    if (!balance) {
      balance = {
        participantId,
        participantName,
        currency,
        paid: 0,
        owed: 0,
        balance: 0,
      };

      balances.set(key, balance);
    }

    return balance;
  }

  private validateExpense(
    expense: Expense,
    group: SplitGroup
  ): void {

    if (
      !Number.isInteger(expense.amount) ||
      expense.amount <= 0
    ) {
      throw new Error(
        'Le montant doit être un entier positif.'
      );
    }

    if (!expense.currency?.trim()) {
      throw new Error(
        'La devise de la dépense est obligatoire.'
      );
    }

    const payerExists =
      group.participants.some(
        participant =>
          participant.id === expense.paidBy
      );

    if (!payerExists) {
      throw new Error(
        'Le payeur de la dépense est invalide.'
      );
    }

    if (!expense.participantIds.length) {
      throw new Error(
        'La dépense doit avoir au moins un bénéficiaire.'
      );
    }

    const uniqueBeneficiaries =
      new Set(expense.participantIds);

    if (
      uniqueBeneficiaries.size !==
      expense.participantIds.length
    ) {
      throw new Error(
        'Les bénéficiaires contiennent des doublons.'
      );
    }

    for (const participantId of expense.participantIds) {
      const exists =
        group.participants.some(
          participant =>
            participant.id === participantId
        );

      if (!exists) {
        throw new Error(
          'Un bénéficiaire de la dépense est invalide.'
        );
      }
    }
  }

  private validateBalances(
    balances: ParticipantBalance[]
  ): void {

    const currencies = [
      ...new Set(
        balances.map(balance => balance.currency)
      ),
    ];

    for (const currency of currencies) {

      const total = balances
        .filter(
          balance =>
            balance.currency === currency
        )
        .reduce(
          (sum, balance) =>
            sum + balance.balance,
          0
        );

      if (total !== 0) {
        throw new Error(
          `La somme des soldes ${currency} doit être égale à zéro.`
        );
      }
    }
  }
}