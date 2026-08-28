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
  CURRENCIES,
  CurrencyCode,
  getCurrency,
} from '../../models/currency.model';
import { Expense } from '../../models/expense.model';
import { GroupService } from '../../services/group.service';
import { SettlementService } from '../../services/settlement.service';

@Component({
  selector: 'app-splitmate-dashboard',
  standalone: true,
  imports: [ReactiveFormsModule],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.scss',
})
export class Dashboard {
  private readonly fb = inject(FormBuilder);
  private readonly groupService = inject(GroupService);
  private readonly settlementService = inject(SettlementService);

  readonly currencies = CURRENCIES;

  readonly group = this.groupService.group;
  readonly participants = this.groupService.participants;
  readonly expenses = this.groupService.expenses;
  readonly totalExpenses = this.groupService.totalExpenses;

  readonly editingExpenseId = signal<string | null>(null);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');
  readonly showResetConfirmation = signal(false);

  readonly balances = computed(() => {
    const group = this.group();

    return group
      ? this.settlementService.calculateBalances(group)
      : [];
  });

  readonly settlements = computed(() =>
    this.settlementService.calculateSettlements(
      this.balances(),
    ),
  );

  readonly groupForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
    currency: this.fb.nonNullable.control<CurrencyCode>('EUR'),
  });

  readonly participantForm = this.fb.nonNullable.group({
    name: ['', Validators.required],
  });

  readonly expenseForm = this.fb.nonNullable.group({
    title: ['', Validators.required],
    amount: [
      0,
      [
        Validators.required,
        Validators.min(0.01),
      ],
    ],
    paidBy: ['', Validators.required],
    participantIds: this.fb.nonNullable.control<string[]>([]),
  });

  createGroup(): void {
    this.clearMessages();

    if (this.groupForm.invalid) {
      this.groupForm.markAllAsTouched();
      this.errorMessage.set(
        'Veuillez renseigner un nom de groupe.',
      );
      return;
    }

    try {
      const value = this.groupForm.getRawValue();

      this.groupService.createGroup(
        value.name,
        value.currency,
      );

      this.groupForm.reset({
        name: '',
        currency: 'EUR',
      });

      this.successMessage.set(
        'Votre groupe est prêt.',
      );
    } catch (error) {
      this.handleError(error);
    }
  }

  addParticipant(): void {
    this.clearMessages();

    if (this.participantForm.invalid) {
      this.errorMessage.set(
        'Veuillez renseigner le nom du participant.',
      );
      return;
    }

    try {
      const participant =
        this.groupService.addParticipant(
          this.participantForm.controls.name.value,
        );

      this.participantForm.reset();

      if (!this.expenseForm.controls.paidBy.value) {
        this.expenseForm.controls.paidBy.setValue(
          participant.id,
        );
      }

      this.successMessage.set(
        `${participant.name} a rejoint le groupe.`,
      );
    } catch (error) {
      this.handleError(error);
    }
  }

  removeParticipant(participantId: string): void {
    this.clearMessages();

    try {
      this.groupService.removeParticipant(
        participantId,
      );

      const selected =
        this.expenseForm.controls.participantIds.value;

      this.expenseForm.controls.participantIds.setValue(
        selected.filter(
          (id) => id !== participantId,
        ),
      );

      if (
        this.expenseForm.controls.paidBy.value ===
        participantId
      ) {
        this.expenseForm.controls.paidBy.setValue('');
      }
    } catch (error) {
      this.handleError(error);
    }
  }

  toggleBeneficiary(
    participantId: string,
    checked: boolean,
  ): void {
    const current =
      this.expenseForm.controls.participantIds.value;

    this.expenseForm.controls.participantIds.setValue(
      checked
        ? [...new Set([...current, participantId])]
        : current.filter(
            (id) => id !== participantId,
          ),
    );
  }

  isBeneficiarySelected(
    participantId: string,
  ): boolean {
    return this.expenseForm.controls.participantIds.value.includes(
      participantId,
    );
  }

  selectAllBeneficiaries(): void {
    this.expenseForm.controls.participantIds.setValue(
      this.participants().map(
        (participant) => participant.id,
      ),
    );
  }

  clearBeneficiaries(): void {
    this.expenseForm.controls.participantIds.setValue(
      [],
    );
  }

  submitExpense(): void {
    this.clearMessages();

    if (this.expenseForm.invalid) {
      this.expenseForm.markAllAsTouched();
      this.errorMessage.set(
        'Complétez correctement la dépense.',
      );
      return;
    }

    const group = this.group();

    if (!group) {
      this.errorMessage.set(
        'Aucun groupe actif.',
      );
      return;
    }

    const value = this.expenseForm.getRawValue();

    if (value.participantIds.length === 0) {
      this.errorMessage.set(
        'Sélectionnez au moins un bénéficiaire.',
      );
      return;
    }

    try {
      const expense = {
        title: value.title,
        amount: this.toMinorUnits(
          value.amount,
          group.currency,
        ),
        paidBy: value.paidBy,
        participantIds: value.participantIds,
      };

      const editingId =
        this.editingExpenseId();

      if (editingId) {
        this.groupService.updateExpense(
          editingId,
          expense,
        );

        this.successMessage.set(
          'Dépense mise à jour.',
        );
      } else {
        this.groupService.addExpense(expense);

        this.successMessage.set(
          'Dépense ajoutée.',
        );
      }

      this.cancelExpenseEdit();
    } catch (error) {
      this.handleError(error);
    }
  }

  editExpense(expense: Expense): void {
    const group = this.group();

    if (!group) {
      return;
    }

    this.clearMessages();
    this.editingExpenseId.set(expense.id);

    this.expenseForm.setValue({
      title: expense.title,
      amount: this.fromMinorUnits(
        expense.amount,
        group.currency,
      ),
      paidBy: expense.paidBy,
      participantIds: [
        ...expense.participantIds,
      ],
    });
  }

  cancelExpenseEdit(): void {
    this.editingExpenseId.set(null);

    this.expenseForm.reset({
      title: '',
      amount: 0,
      paidBy:
        this.participants()[0]?.id ?? '',
      participantIds: [],
    });
  }

  removeExpense(expenseId: string): void {
    this.clearMessages();

    try {
      this.groupService.removeExpense(expenseId);

      if (
        this.editingExpenseId() === expenseId
      ) {
        this.cancelExpenseEdit();
      }

      this.successMessage.set(
        'Dépense supprimée.',
      );
    } catch (error) {
      this.handleError(error);
    }
  }

  requestReset(): void {
    this.showResetConfirmation.set(true);
  }

  cancelReset(): void {
    this.showResetConfirmation.set(false);
  }

  confirmReset(): void {
    this.groupService.resetGroup();

    this.groupForm.reset({
      name: '',
      currency: 'EUR',
    });

    this.participantForm.reset();

    this.expenseForm.reset({
      title: '',
      amount: 0,
      paidBy: '',
      participantIds: [],
    });

    this.editingExpenseId.set(null);
    this.showResetConfirmation.set(false);
    this.clearMessages();
  }

  participantName(
    participantId: string,
  ): string {
    return (
      this.participants().find(
        (participant) =>
          participant.id === participantId,
      )?.name ?? 'Participant inconnu'
    );
  }

  formatMoney(amountInMinorUnits: number): string {
    const group = this.group();

    if (!group) {
      return '';
    }

    const currency = getCurrency(
      group.currency,
    );

    return new Intl.NumberFormat(
      currency.locale,
      {
        style: 'currency',
        currency: currency.code,
        minimumFractionDigits:
          currency.minorUnitFactor === 1 ? 0 : 2,
        maximumFractionDigits:
          currency.minorUnitFactor === 1 ? 0 : 2,
      },
    ).format(
      amountInMinorUnits /
        currency.minorUnitFactor,
    );
  }

  currencyLabel(): string {
    const group = this.group();

    return group
      ? getCurrency(group.currency).label
      : '';
  }

  currencySymbol(): string {
    const group = this.group();

    return group
      ? getCurrency(group.currency).symbol
      : '';
  }

  amountStep(): string {
    const group = this.group();

    if (!group) {
      return '0.01';
    }

    return getCurrency(group.currency)
      .minorUnitFactor === 1
      ? '1'
      : '0.01';
  }

  private toMinorUnits(
    amount: number,
    currencyCode: CurrencyCode,
  ): number {
    const factor =
      getCurrency(currencyCode).minorUnitFactor;

    return Math.round(amount * factor);
  }

  private fromMinorUnits(
    amount: number,
    currencyCode: CurrencyCode,
  ): number {
    const factor =
      getCurrency(currencyCode).minorUnitFactor;

    return amount / factor;
  }

  private clearMessages(): void {
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  private handleError(error: unknown): void {
    this.errorMessage.set(
      error instanceof Error
        ? error.message
        : 'Une erreur inattendue est survenue.',
    );
  }
}
