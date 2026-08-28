import {
  computed,
  inject,
  Injectable,
  signal,
} from '@angular/core';

import { StorageService } from '../../../core/storage/storage.service';
import { CurrencyCode } from '../models/currency.model';
import { Expense } from '../models/expense.model';
import { SplitGroup } from '../models/group.model';
import { Participant } from '../models/participant.model';

const STORAGE_KEY = 'splitmate.active-group';

type ExpenseInput = Omit<Expense, 'id' | 'createdAt'>;

@Injectable({
  providedIn: 'root',
})
export class GroupService {
  private readonly storage = inject(StorageService);

  private readonly groupState = signal<SplitGroup | null>(
    this.loadStoredGroup(),
  );

  readonly group = this.groupState.asReadonly();
  readonly participants = computed(
    () => this.groupState()?.participants ?? [],
  );
  readonly expenses = computed(
    () => this.groupState()?.expenses ?? [],
  );
  readonly hasGroup = computed(
    () => this.groupState() !== null,
  );
  readonly totalExpenses = computed(() =>
    this.expenses().reduce(
      (total, expense) => total + expense.amount,
      0,
    ),
  );

  createGroup(name: string, currency: CurrencyCode): SplitGroup {
    const cleanName = name.trim();

    if (!cleanName) {
      throw new Error('Le nom du groupe est obligatoire.');
    }

    const group: SplitGroup = {
      id: crypto.randomUUID(),
      name: cleanName,
      currency,
      participants: [],
      expenses: [],
      createdAt: new Date().toISOString(),
    };

    this.updateGroup(group);
    return group;
  }

  addParticipant(name: string): Participant {
    const group = this.requireGroup();
    const cleanName = name.trim();

    if (!cleanName) {
      throw new Error('Le nom du participant est obligatoire.');
    }

    const duplicateExists = group.participants.some(
      (participant) =>
        participant.name.trim().toLowerCase() ===
        cleanName.toLowerCase(),
    );

    if (duplicateExists) {
      throw new Error('Un participant avec ce nom existe déjà.');
    }

    const participant: Participant = {
      id: crypto.randomUUID(),
      name: cleanName,
    };

    this.updateGroup({
      ...group,
      participants: [...group.participants, participant],
    });

    return participant;
  }

  removeParticipant(participantId: string): void {
    const group = this.requireGroup();

    if (!group.participants.some((p) => p.id === participantId)) {
      throw new Error('Participant introuvable.');
    }

    const participantUsedInExpense = group.expenses.some(
      (expense) =>
        expense.paidBy === participantId ||
        expense.participantIds.includes(participantId),
    );

    if (participantUsedInExpense) {
      throw new Error(
        'Impossible de supprimer un participant associé à une dépense.',
      );
    }

    this.updateGroup({
      ...group,
      participants: group.participants.filter(
        (participant) => participant.id !== participantId,
      ),
    });
  }

  addExpense(expense: ExpenseInput): Expense {
    const group = this.requireGroup();
    this.validateExpense(group, expense);

    const newExpense: Expense = {
      ...expense,
      title: expense.title.trim(),
      participantIds: [...expense.participantIds],
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    };

    this.updateGroup({
      ...group,
      expenses: [...group.expenses, newExpense],
    });

    return newExpense;
  }

  updateExpense(
    expenseId: string,
    changes: ExpenseInput,
  ): Expense {
    const group = this.requireGroup();

    const existingExpense = group.expenses.find(
      (expense) => expense.id === expenseId,
    );

    if (!existingExpense) {
      throw new Error('Dépense introuvable.');
    }

    this.validateExpense(group, changes);

    const updatedExpense: Expense = {
      ...existingExpense,
      ...changes,
      title: changes.title.trim(),
      participantIds: [...changes.participantIds],
      id: existingExpense.id,
      createdAt: existingExpense.createdAt,
    };

    this.updateGroup({
      ...group,
      expenses: group.expenses.map((expense) =>
        expense.id === expenseId ? updatedExpense : expense,
      ),
    });

    return updatedExpense;
  }

  removeExpense(expenseId: string): void {
    const group = this.requireGroup();

    if (!group.expenses.some((expense) => expense.id === expenseId)) {
      throw new Error('Dépense introuvable.');
    }

    this.updateGroup({
      ...group,
      expenses: group.expenses.filter(
        (expense) => expense.id !== expenseId,
      ),
    });
  }

  resetGroup(): void {
    this.groupState.set(null);
    this.storage.remove(STORAGE_KEY);
  }

  private validateExpense(
    group: SplitGroup,
    expense: ExpenseInput,
  ): void {
    if (!expense.title.trim()) {
      throw new Error('Le titre de la dépense est obligatoire.');
    }

    if (!Number.isInteger(expense.amount) || expense.amount <= 0) {
      throw new Error('Le montant doit être positif.');
    }

    const participantIds = new Set(
      group.participants.map((participant) => participant.id),
    );

    if (!participantIds.has(expense.paidBy)) {
      throw new Error('Le payeur ne fait pas partie du groupe.');
    }

    if (expense.participantIds.length === 0) {
      throw new Error('Sélectionnez au moins un bénéficiaire.');
    }

    const uniqueBeneficiaries = new Set(expense.participantIds);

    if (uniqueBeneficiaries.size !== expense.participantIds.length) {
      throw new Error(
        'Un bénéficiaire ne peut apparaître plusieurs fois.',
      );
    }

    for (const participantId of uniqueBeneficiaries) {
      if (!participantIds.has(participantId)) {
        throw new Error(
          'Un bénéficiaire ne fait pas partie du groupe.',
        );
      }
    }
  }

  private loadStoredGroup(): SplitGroup | null {
    const stored = this.storage.load<SplitGroup>(STORAGE_KEY);

    if (!stored) {
      return null;
    }

    // Migration légère des données créées avant l'ajout du choix de devise.
    if (!stored.currency) {
      const migrated: SplitGroup = {
        ...stored,
        currency: 'XOF',
      };

      this.storage.save(STORAGE_KEY, migrated);
      return migrated;
    }

    return stored;
  }

  private requireGroup(): SplitGroup {
    const group = this.groupState();

    if (!group) {
      throw new Error('Aucun groupe actif.');
    }

    return group;
  }

  private updateGroup(group: SplitGroup): void {
    this.groupState.set(group);
    this.storage.save(STORAGE_KEY, group);
  }
}
