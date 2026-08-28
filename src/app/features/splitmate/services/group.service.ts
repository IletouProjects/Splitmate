import {
  computed,
  inject,
  Injectable,
  signal,
} from '@angular/core';

import { StorageService } from '../../../core/storage/storage.service';

import { SUPPORTED_CURRENCIES } from '../models/currency.model';
import { Expense } from '../models/expense.model';
import { SplitGroup } from '../models/group.model';
import { Participant } from '../models/participant.model';

const STORAGE_KEY = 'splitmate.active-group';

type ExpenseInput = Omit<
  Expense,
  'id' | 'createdAt'
>;

export interface CurrencyTotal {
  currency: string;
  amount: number;
}

@Injectable({
  providedIn: 'root',
})
export class GroupService {
  private readonly storage =
    inject(StorageService);

  /**
   * Chargement du groupe éventuellement déjà
   * enregistré dans localStorage.
   */
  private readonly storedGroup =
    this.storage.load<SplitGroup>(
      STORAGE_KEY
    );

  /**
   * Migration automatique des anciennes données.
   *
   * Avant l'ajout du multi-devise :
   * - les participants n'avaient pas de currency
   * - les dépenses n'avaient pas de currency
   *
   * On utilise XOF comme devise par défaut
   * pour conserver les anciennes données.
   */
  private readonly initialGroup =
    this.normalizeGroup(
      this.storedGroup
    );

  private readonly groupState =
    signal<SplitGroup | null>(
      this.initialGroup
    );

  /**
   * Groupe actuellement actif.
   */
  readonly group =
    this.groupState.asReadonly();

  /**
   * Indique si un groupe existe.
   */
  readonly hasGroup =
    computed(
      () =>
        this.groupState() !== null
    );

  /**
   * Liste des participants.
   */
  readonly participants =
    computed(
      () =>
        this.groupState()
          ?.participants ?? []
    );

  /**
   * Liste des dépenses.
   */
  readonly expenses =
    computed(
      () =>
        this.groupState()
          ?.expenses ?? []
    );

  /**
   * IMPORTANT :
   * avec plusieurs devises,
   * on ne doit plus additionner toutes
   * les dépenses dans un seul total.
   *
   * Exemple incorrect :
   * 50 000 XOF + 100 EUR.
   *
   * On calcule donc un total indépendant
   * pour chaque devise.
   */
  readonly totalsByCurrency =
    computed<CurrencyTotal[]>(
      () => {
        const totals =
          new Map<string, number>();

        for (
          const expense
          of this.expenses()
        ) {
          const current =
            totals.get(
              expense.currency
            ) ?? 0;

          totals.set(
            expense.currency,
            current +
              expense.amount
          );
        }

        return Array
          .from(
            totals.entries()
          )
          .map(
            ([currency, amount]) => ({
              currency,
              amount,
            })
          )
          .sort(
            (a, b) =>
              a.currency.localeCompare(
                b.currency
              )
          );
      }
    );

  constructor() {
    /**
     * Si une ancienne structure a été migrée,
     * on sauvegarde immédiatement la version
     * normalisée dans localStorage.
     */
    if (
      this.initialGroup &&
      this.storedGroup
    ) {
      this.storage.save(
        STORAGE_KEY,
        this.initialGroup
      );
    }
  }

  /**
   * Crée un nouveau groupe.
   */
  createGroup(
    name: string
  ): SplitGroup {
    const normalizedName =
      name.trim();

    if (!normalizedName) {
      throw new Error(
        'Le nom du groupe est obligatoire.'
      );
    }

    const group: SplitGroup = {
      id: crypto.randomUUID(),
      name: normalizedName,
      participants: [],
      expenses: [],
      createdAt:
        new Date().toISOString(),
    };

    this.groupState.set(group);

    this.storage.save(
      STORAGE_KEY,
      group
    );

    return group;
  }

  /**
   * Ajoute un participant au groupe.
   *
   * Chaque participant dispose maintenant
   * d'une devise préférée.
   */
  addParticipant(
    name: string,
    currency: string
  ): Participant {
    const group =
      this.requireGroup();

    const normalizedName =
      name.trim();

    const normalizedCurrency =
      currency
        .trim()
        .toUpperCase();

    if (!normalizedName) {
      throw new Error(
        'Le nom du participant est obligatoire.'
      );
    }

    this.validateCurrency(
      normalizedCurrency
    );

    const duplicate =
      group.participants.some(
        participant =>
          participant.name
            .trim()
            .toLowerCase() ===
          normalizedName
            .toLowerCase()
      );

    if (duplicate) {
      throw new Error(
        'Ce participant existe déjà.'
      );
    }

    const participant: Participant = {
      id: crypto.randomUUID(),
      name: normalizedName,
      currency:
        normalizedCurrency,
    };

    this.updateGroup({
      ...group,

      participants: [
        ...group.participants,
        participant,
      ],
    });

    return participant;
  }

  /**
   * Supprime un participant.
   *
   * Un participant utilisé dans une dépense
   * ne peut pas être supprimé.
   */
  removeParticipant(
    participantId: string
  ): void {
    const group =
      this.requireGroup();

    const participant =
      group.participants.find(
        item =>
          item.id === participantId
      );

    if (!participant) {
      throw new Error(
        'Participant introuvable.'
      );
    }

    const participantUsed =
      group.expenses.some(
        expense =>
          expense.paidBy ===
            participantId ||
          expense.participantIds.includes(
            participantId
          )
      );

    if (participantUsed) {
      throw new Error(
        'Impossible de supprimer ce participant car il est lié à une dépense.'
      );
    }

    this.updateGroup({
      ...group,

      participants:
        group.participants.filter(
          item =>
            item.id !==
            participantId
        ),
    });
  }

  /**
   * Ajoute une nouvelle dépense.
   */
  addExpense(
    input: ExpenseInput
  ): Expense {
    const group =
      this.requireGroup();

    const normalizedInput: ExpenseInput =
      {
        ...input,

        title:
          input.title.trim(),

        currency:
          input.currency
            .trim()
            .toUpperCase(),

        participantIds: [
          ...input.participantIds,
        ],
      };

    this.validateExpense(
      normalizedInput,
      group
    );

    const expense: Expense = {
      ...normalizedInput,

      id: crypto.randomUUID(),

      createdAt:
        new Date().toISOString(),
    };

    this.updateGroup({
      ...group,

      expenses: [
        ...group.expenses,
        expense,
      ],
    });

    return expense;
  }

  /**
   * Modifie une dépense existante.
   *
   * L'id et createdAt sont conservés.
   */
  updateExpense(
    expenseId: string,
    changes: ExpenseInput
  ): Expense {
    const group =
      this.requireGroup();

    const existingExpense =
      group.expenses.find(
        expense =>
          expense.id === expenseId
      );

    if (!existingExpense) {
      throw new Error(
        'Dépense introuvable.'
      );
    }

    const normalizedChanges: ExpenseInput =
      {
        ...changes,

        title:
          changes.title.trim(),

        currency:
          changes.currency
            .trim()
            .toUpperCase(),

        participantIds: [
          ...changes.participantIds,
        ],
      };

    this.validateExpense(
      normalizedChanges,
      group
    );

    const updatedExpense: Expense = {
      ...normalizedChanges,

      id: existingExpense.id,

      createdAt:
        existingExpense.createdAt,
    };

    this.updateGroup({
      ...group,

      expenses:
        group.expenses.map(
          expense =>
            expense.id ===
            expenseId
              ? updatedExpense
              : expense
        ),
    });

    return updatedExpense;
  }

  /**
   * Supprime une dépense.
   */
  removeExpense(
    expenseId: string
  ): void {
    const group =
      this.requireGroup();

    const expenseExists =
      group.expenses.some(
        expense =>
          expense.id ===
          expenseId
      );

    if (!expenseExists) {
      throw new Error(
        'Dépense introuvable.'
      );
    }

    this.updateGroup({
      ...group,

      expenses:
        group.expenses.filter(
          expense =>
            expense.id !==
            expenseId
        ),
    });
  }

  /**
   * Supprime complètement le groupe courant
   * ainsi que les données localStorage.
   */
  resetGroup(): void {
    this.groupState.set(null);

    this.storage.remove(
      STORAGE_KEY
    );
  }

  /**
   * Vérifie qu'une dépense respecte
   * toutes les règles métier.
   */
  private validateExpense(
    expense: ExpenseInput,
    group: SplitGroup
  ): void {
    if (!expense.title.trim()) {
      throw new Error(
        'Le titre de la dépense est obligatoire.'
      );
    }

    if (
      !Number.isInteger(
        expense.amount
      ) ||
      expense.amount <= 0
    ) {
      throw new Error(
        'Le montant doit être un entier positif.'
      );
    }

    this.validateCurrency(
      expense.currency
    );

    /**
     * Vérification du payeur.
     */
    const payerExists =
      group.participants.some(
        participant =>
          participant.id ===
          expense.paidBy
      );

    if (!payerExists) {
      throw new Error(
        'Le payeur de la dépense est invalide.'
      );
    }

    /**
     * La dépense doit concerner
     * au moins une personne.
     */
    if (
      !expense.participantIds.length
    ) {
      throw new Error(
        'La dépense doit avoir au moins un bénéficiaire.'
      );
    }

    /**
     * Vérification des doublons.
     */
    const uniqueParticipants =
      new Set(
        expense.participantIds
      );

    if (
      uniqueParticipants.size !==
      expense.participantIds.length
    ) {
      throw new Error(
        'Les bénéficiaires contiennent des doublons.'
      );
    }

    /**
     * Tous les bénéficiaires doivent
     * appartenir au groupe.
     */
    for (
      const participantId
      of expense.participantIds
    ) {
      const participantExists =
        group.participants.some(
          participant =>
            participant.id ===
            participantId
        );

      if (!participantExists) {
        throw new Error(
          'Un bénéficiaire de la dépense est invalide.'
        );
      }
    }
  }

  /**
   * Vérifie qu'une devise fait partie
   * des devises supportées.
   */
  private validateCurrency(
    currency: string
  ): void {
    const normalizedCurrency =
      currency
        ?.trim()
        .toUpperCase();

    if (!normalizedCurrency) {
      throw new Error(
        'La devise est obligatoire.'
      );
    }

    const currencyExists =
      SUPPORTED_CURRENCIES.some(
        item =>
          item.code ===
          normalizedCurrency
      );

    if (!currencyExists) {
      throw new Error(
        `La devise ${normalizedCurrency} n’est pas prise en charge.`
      );
    }
  }

  /**
   * Retourne le groupe courant.
   *
   * Évite de dupliquer cette vérification
   * dans toutes les méthodes.
   */
  private requireGroup():
    SplitGroup {
    const group =
      this.groupState();

    if (!group) {
      throw new Error(
        'Aucun groupe actif.'
      );
    }

    return group;
  }

  /**
   * Met à jour l'état Angular
   * et localStorage simultanément.
   */
  private updateGroup(
    group: SplitGroup
  ): void {
    this.groupState.set(group);

    this.storage.save(
      STORAGE_KEY,
      group
    );
  }

  /**
   * Migration des anciennes données.
   *
   * Les données enregistrées avant
   * l'ajout de la fonctionnalité multi-devise
   * n'ont pas de champ currency.
   *
   * Elles sont automatiquement migrées
   * vers XOF.
   */
  private normalizeGroup(
    group: SplitGroup | null
  ): SplitGroup | null {
    if (!group) {
      return null;
    }

    const participants =
      group.participants.map(
        participant => ({
          ...participant,

          currency:
            participant.currency
              ?.trim()
              .toUpperCase() ||
            'XOF',
        })
      );

    const expenses =
      group.expenses.map(
        expense => {
          /**
           * Si l'ancienne dépense n'avait
           * pas de devise, on essaie d'abord
           * d'utiliser celle du payeur.
           */
          const payer =
            participants.find(
              participant =>
                participant.id ===
                expense.paidBy
            );

          const currency =
            expense.currency
              ?.trim()
              .toUpperCase() ||
            payer?.currency ||
            'XOF';

          return {
            ...expense,
            currency,

            participantIds: [
              ...expense.participantIds,
            ],
          };
        }
      );

    return {
      ...group,
      participants,
      expenses,
    };
  }
}