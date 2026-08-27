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

  readonly group = this.groupService.group;
  readonly participants = this.groupService.participants;
  readonly expenses = this.groupService.expenses;
  readonly totalExpenses = this.groupService.totalExpenses;

  readonly editingExpenseId = signal<string | null>(null);
  readonly errorMessage = signal('');
  readonly successMessage = signal('');

  readonly balances = computed(() => {
    const group = this.group();

    if (!group) {
      return [];
    }

    return this.settlementService.calculateBalances(group);
  });

  readonly settlements = computed(() =>
    this.settlementService.calculateSettlements(
      this.balances(),
    ),
  );

  readonly groupForm = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
  });

  readonly participantForm = this.fb.nonNullable.group({
    name: ['', [Validators.required]],
  });

  readonly expenseForm = this.fb.nonNullable.group({
    title: ['', [Validators.required]],
    amount: [
      0,
      [
        Validators.required,
        Validators.min(1),
      ],
    ],
    paidBy: ['', [Validators.required]],
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
      this.groupService.createGroup(
        this.groupForm.controls.name.value,
      );

      this.groupForm.reset();
      this.successMessage.set(
        'Groupe créé avec succès.',
      );
    } catch (error) {
      this.handleError(error);
    }
  }

  addParticipant(): void {
    this.clearMessages();

    if (this.participantForm.invalid) {
      this.participantForm.markAllAsTouched();
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

      if (
        !this.expenseForm.controls.paidBy.value
      ) {
        this.expenseForm.controls.paidBy.setValue(
          participant.id,
        );
      }

      this.successMessage.set(
        `${participant.name} a été ajouté au groupe.`,
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

      this.removeBeneficiaryFromExpenseForm(
        participantId,
      );

      if (
        this.expenseForm.controls.paidBy.value ===
        participantId
      ) {
        this.expenseForm.controls.paidBy.setValue(
          '',
        );
      }

      this.successMessage.set(
        'Participant supprimé.',
      );
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

    const next = checked
      ? [...new Set([...current, participantId])]
      : current.filter(
          (id) => id !== participantId,
        );

    this.expenseForm.controls.participantIds.setValue(
      next,
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
        'Veuillez compléter correctement la dépense.',
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
        amount: Number(value.amount),
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
          'Dépense modifiée.',
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
    this.clearMessages();

    this.editingExpenseId.set(expense.id);

    this.expenseForm.setValue({
      title: expense.title,
      amount: expense.amount,
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

  resetGroup(): void {
    this.groupService.resetGroup();

    this.groupForm.reset();
    this.participantForm.reset();
    this.expenseForm.reset({
      title: '',
      amount: 0,
      paidBy: '',
      participantIds: [],
    });

    this.editingExpenseId.set(null);
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

  formatFcfa(amount: number): string {
    return `${new Intl.NumberFormat(
      'fr-FR',
    ).format(amount)} FCFA`;
  }

  private removeBeneficiaryFromExpenseForm(
    participantId: string,
  ): void {
    const current =
      this.expenseForm.controls.participantIds.value;

    this.expenseForm.controls.participantIds.setValue(
      current.filter(
        (id) => id !== participantId,
      ),
    );
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
