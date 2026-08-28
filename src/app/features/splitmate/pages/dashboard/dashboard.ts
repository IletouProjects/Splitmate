import {
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';

import {
  FormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';

import {
  SUPPORTED_CURRENCIES,
} from '../../models/currency.model';

import { Expense } from '../../models/expense.model';

import { GroupService } from '../../services/group.service';
import { SettlementService } from '../../services/settlement.service';


@Component({
  selector: 'app-splitmate-dashboard',
  standalone: true,
  imports: [
    ReactiveFormsModule,
  ],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private readonly fb =
    inject(FormBuilder);

  private readonly groupService =
    inject(GroupService);

  private readonly settlementService =
    inject(SettlementService);

  /*
   * Données principales
   */
  readonly group =
    this.groupService.group;

  readonly participants =
    this.groupService.participants;

  readonly expenses =
    this.groupService.expenses;

  readonly totalsByCurrency =
    this.groupService.totalsByCurrency;

  readonly currencies =
    SUPPORTED_CURRENCIES;

  /*
   * États de l'interface
   */
  readonly editingExpenseId =
    signal<string | null>(null);

  readonly errorMessage =
    signal<string | null>(null);

  readonly successMessage =
    signal<string | null>(null);

  /*
   * Calcul des soldes.
   *
   * Chaque devise est traitée
   * indépendamment.
   */
  readonly balances =
    computed(() => {
      const group =
        this.group();

      if (!group) {
        return [];
      }

      return this.settlementService
        .calculateBalances(group);
    });

  /*
   * Calcul du plan de remboursement.
   */
  readonly settlements =
    computed(() => {
      return this.settlementService
        .calculateSettlements(
          this.balances()
        );
    });

  /*
   * Formulaire groupe.
   *
   * Le groupe n'a volontairement
   * aucune devise.
   */
  readonly groupForm =
    this.fb.nonNullable.group({
      name: [
        '',
        Validators.required,
      ],
    });

  /*
   * Chaque participant possède
   * sa devise préférée.
   */
  readonly participantForm =
    this.fb.nonNullable.group({
      name: [
        '',
        Validators.required,
      ],

      currency: [
        'XOF',
        Validators.required,
      ],
    });

  /*
   * Une dépense possède également
   * sa propre devise.
   */
  readonly expenseForm =
    this.fb.nonNullable.group({
      title: [
        '',
        Validators.required,
      ],

      amount: [
        0,
        [
          Validators.required,
          Validators.min(0.01),
        ],
      ],

      currency: [
        'XOF',
        Validators.required,
      ],

      paidBy: [
        '',
        Validators.required,
      ],

      participantIds:
        this.fb.nonNullable.control<
          string[]
        >([]),
    });

  /*
   * Création du groupe
   */
  createGroup(): void {
    this.clearMessages();

    try {
      const {
        name,
      } =
        this.groupForm
          .getRawValue();

      this.groupService
        .createGroup(name);

      this.groupForm.reset({
        name: '',
      });

      this.showSuccess(
        'Groupe créé avec succès.'
      );
    } catch (error) {
      this.handleError(error);
    }
  }

  /*
   * Ajout d'un participant
   */
  addParticipant(): void {
    this.clearMessages();

    try {
      const {
        name,
        currency,
      } =
        this.participantForm
          .getRawValue();

      const participant =
        this.groupService
          .addParticipant(
            name,
            currency
          );

      /*
       * Si c'est le premier participant,
       * il devient automatiquement
       * le payeur proposé.
       */
      if (
        !this.expenseForm
          .controls
          .paidBy
          .value
      ) {
        this.expenseForm
          .patchValue({
            paidBy:
              participant.id,

            currency:
              participant.currency,
          });
      }

      this.participantForm
        .reset({
          name: '',
          currency: 'XOF',
        });

      this.showSuccess(
        'Participant ajouté.'
      );
    } catch (error) {
      this.handleError(error);
    }
  }

  /*
   * Suppression participant
   */
  removeParticipant(
    participantId: string
  ): void {
    this.clearMessages();

    try {
      this.groupService
        .removeParticipant(
          participantId
        );

      this.showSuccess(
        'Participant supprimé.'
      );
    } catch (error) {
      this.handleError(error);
    }
  }

  /*
   * Quand le payeur change,
   * on pré-sélectionne automatiquement
   * sa devise préférée.
   *
   * L'utilisateur peut toujours changer
   * ensuite la devise de la dépense.
   */
  onPayerChange(
    participantId: string
  ): void {
    const participant =
      this.participants()
        .find(
          item =>
            item.id ===
            participantId
        );

    if (!participant) {
      return;
    }

    this.expenseForm
      .patchValue({
        paidBy:
          participant.id,

        currency:
          participant.currency,
      });
  }

  /*
   * Sélection / désélection
   * d'un bénéficiaire.
   */
  toggleParticipant(
    participantId: string
  ): void {
    const control =
      this.expenseForm.controls
        .participantIds;

    const current =
      control.value;

    if (
      current.includes(
        participantId
      )
    ) {
      control.setValue(
        current.filter(
          id =>
            id !==
            participantId
        )
      );

      return;
    }

    control.setValue([
      ...current,
      participantId,
    ]);
  }

  /*
   * Vérifie si un participant
   * est sélectionné.
   */
  isParticipantSelected(
    participantId: string
  ): boolean {
    return this.expenseForm
      .controls
      .participantIds
      .value
      .includes(
        participantId
      );
  }

  /*
   * Sélectionne tous les membres.
   */
  selectAllParticipants(): void {
    this.expenseForm
      .controls
      .participantIds
      .setValue(
        this.participants()
          .map(
            participant =>
              participant.id
          )
      );
  }

  /*
   * Désélectionne tous les membres.
   */
  clearParticipants(): void {
    this.expenseForm
      .controls
      .participantIds
      .setValue([]);
  }

  /*
   * Ajout ou modification
   * d'une dépense.
   */
  submitExpense(): void {
    this.clearMessages();

    try {
      const value =
        this.expenseForm
          .getRawValue();

      if (
        !value.participantIds.length
      ) {
        throw new Error(
          'Sélectionnez au moins un participant.'
        );
      }

      /*
       * Conversion vers unité mineure.
       *
       * XOF :
       * 60000 -> 60000
       *
       * EUR :
       * 600 -> 60000 centimes
       */
      const amount =
        this.toMinorUnits(
          Number(
            value.amount
          ),
          value.currency
        );

      const expense = {
        title:
          value.title,

        amount,

        currency:
          value.currency,

        paidBy:
          value.paidBy,

        participantIds: [
          ...value.participantIds,
        ],
      };

      const editingId =
        this.editingExpenseId();

      if (editingId) {
        this.groupService
          .updateExpense(
            editingId,
            expense
          );

        this.showSuccess(
          'Dépense modifiée.'
        );
      } else {
        this.groupService
          .addExpense(
            expense
          );

        this.showSuccess(
          'Dépense ajoutée.'
        );
      }

      this.resetExpenseForm();
    } catch (error) {
      this.handleError(error);
    }
  }

  /*
   * Passage en mode édition.
   */
  editExpense(
    expense: Expense
  ): void {
    this.clearMessages();

    this.editingExpenseId
      .set(
        expense.id
      );

    this.expenseForm
      .setValue({
        title:
          expense.title,

        amount:
          this.fromMinorUnits(
            expense.amount,
            expense.currency
          ),

        currency:
          expense.currency,

        paidBy:
          expense.paidBy,

        participantIds: [
          ...expense.participantIds,
        ],
      });
  }

  /*
   * Annule l'édition.
   */
  cancelEdit(): void {
    this.editingExpenseId
      .set(null);

    this.resetExpenseForm();
  }

  /*
   * Suppression dépense
   */
  removeExpense(
    expenseId: string
  ): void {
    this.clearMessages();

    try {
      this.groupService
        .removeExpense(
          expenseId
        );

      if (
        this.editingExpenseId() ===
        expenseId
      ) {
        this.resetExpenseForm();
      }

      this.showSuccess(
        'Dépense supprimée.'
      );
    } catch (error) {
      this.handleError(error);
    }
  }

  /*
   * Réinitialise tout le groupe.
   */
  resetGroup(): void {
    this.clearMessages();

    try {
      this.groupService
        .resetGroup();

      this.editingExpenseId
        .set(null);

      this.groupForm.reset({
        name: '',
      });

      this.participantForm
        .reset({
          name: '',
          currency: 'XOF',
        });

      this.resetExpenseForm();

      this.showSuccess(
        'Groupe réinitialisé.'
      );
    } catch (error) {
      this.handleError(error);
    }
  }

  /*
   * Nom d'un participant depuis son id.
   */
  participantName(
    participantId: string
  ): string {
    return (
      this.participants()
        .find(
          participant =>
            participant.id ===
            participantId
        )
        ?.name ??
      'Inconnu'
    );
  }

  /*
   * Nom lisible d'une devise.
   */
  currencyLabel(
    currency: string
  ): string {
    return (
      this.currencies.find(
        item =>
          item.code ===
          currency
      )?.label ??
      currency
    );
  }

  /*
   * Nombre de décimales
   * d'une devise.
   */
  currencyDecimals(
    currency: string
  ): number {
    return (
      this.currencies.find(
        item =>
          item.code ===
          currency
      )?.decimals ??
      2
    );
  }

  /*
   * Format monétaire.
   *
   * Les montants stockés sont
   * exprimés en unités mineures.
   */
  formatMoney(
    amount: number,
    currency: string
  ): string {
    const decimals =
      this.currencyDecimals(
        currency
      );

    const divisor =
      10 ** decimals;

    const majorAmount =
      amount / divisor;

    return new Intl.NumberFormat(
      'fr-FR',
      {
        style: 'currency',
        currency,
        minimumFractionDigits:
          decimals,
        maximumFractionDigits:
          decimals,
      }
    ).format(
      majorAmount
    );
  }

  /*
   * Transforme un montant utilisateur
   * vers l'unité mineure.
   */
  private toMinorUnits(
    amount: number,
    currency: string
  ): number {
    const decimals =
      this.currencyDecimals(
        currency
      );

    return Math.round(
      amount *
      10 ** decimals
    );
  }

  /*
   * Transforme l'unité mineure
   * vers la valeur affichée
   * dans le formulaire.
   */
  private fromMinorUnits(
    amount: number,
    currency: string
  ): number {
    const decimals =
      this.currencyDecimals(
        currency
      );

    return (
      amount /
      10 ** decimals
    );
  }

  private resetExpenseForm(): void {
    this.editingExpenseId
      .set(null);

    const firstParticipant =
      this.participants()[0];

    this.expenseForm
      .reset({
        title: '',
        amount: 0,

        currency:
          firstParticipant
            ?.currency ??
          'XOF',

        paidBy:
          firstParticipant
            ?.id ??
          '',

        participantIds: [],
      });
  }

  private clearMessages(): void {
    this.errorMessage
      .set(null);

    this.successMessage
      .set(null);
  }

  private showSuccess(
    message: string
  ): void {
    this.successMessage
      .set(message);
  }

  private handleError(
    error: unknown
  ): void {
    if (
      error instanceof Error
    ) {
      this.errorMessage
        .set(
          error.message
        );

      return;
    }

    this.errorMessage
      .set(
        'Une erreur est survenue.'
      );
  }
}