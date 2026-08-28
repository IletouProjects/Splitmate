import { TestBed } from '@angular/core/testing';

import { StorageService } from '../../../core/storage/storage.service';
import { GroupService } from './group.service';

describe('GroupService', () => {
  let service: GroupService;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        GroupService,
        StorageService,
      ],
    });

    service = TestBed.inject(GroupService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('crée un groupe et le persiste', () => {
    const group = service.createGroup(
      'Voyage Abidjan',
    );

    expect(group.name).toBe(
      'Voyage Abidjan',
    );

    expect(group.participants).toEqual([]);
    expect(group.expenses).toEqual([]);
    expect(service.hasGroup()).toBe(true);

    const stored = localStorage.getItem(
      'splitmate.active-group',
    );

    expect(stored).not.toBeNull();

    const parsed = JSON.parse(stored!);

    expect(parsed.name).toBe(
      'Voyage Abidjan',
    );

    // Le groupe n'a volontairement
    // aucune devise propre.
    expect(parsed.currency).toBeUndefined();
  });

  it('refuse un nom de groupe vide', () => {
    expect(() =>
      service.createGroup('   '),
    ).toThrow(
      'Le nom du groupe est obligatoire.',
    );
  });

  it('ajoute un participant avec sa devise', () => {
    service.createGroup(
      'Voyage Abidjan',
    );

    const participant =
      service.addParticipant(
        'Charbel',
        'XOF',
      );

    expect(participant.name).toBe(
      'Charbel',
    );

    expect(participant.currency).toBe(
      'XOF',
    );

    expect(
      service.participants(),
    ).toHaveLength(1);
  });

  it('normalise la devise du participant en majuscules', () => {
    service.createGroup(
      'Voyage Abidjan',
    );

    const participant =
      service.addParticipant(
        'Joel',
        'cad',
      );

    expect(participant.currency).toBe(
      'CAD',
    );
  });

  it('refuse un participant en doublon', () => {
    service.createGroup(
      'Voyage Abidjan',
    );

    service.addParticipant(
      'Charbel',
      'XOF',
    );

    expect(() =>
      service.addParticipant(
        ' charbel ',
        'EUR',
      ),
    ).toThrow(
      'Ce participant existe déjà.',
    );
  });

  it('refuse une devise non prise en charge pour un participant', () => {
    service.createGroup(
      'Voyage Abidjan',
    );

    expect(() =>
      service.addParticipant(
        'Charbel',
        'ABC',
      ),
    ).toThrow(
      'La devise ABC n’est pas prise en charge.',
    );
  });

  it('ajoute une dépense avec sa propre devise', () => {
    service.createGroup(
      'Voyage Abidjan',
    );

    const charbel =
      service.addParticipant(
        'Charbel',
        'XOF',
      );

    const joel =
      service.addParticipant(
        'Joel',
        'CAD',
      );

    const expense =
      service.addExpense({
        title: 'Hôtel',
        amount: 60000,
        currency: 'XOF',
        paidBy: charbel.id,
        participantIds: [
          charbel.id,
          joel.id,
        ],
      });

    expect(expense.title).toBe(
      'Hôtel',
    );

    expect(expense.amount).toBe(
      60000,
    );

    expect(expense.currency).toBe(
      'XOF',
    );

    expect(
      service.expenses(),
    ).toHaveLength(1);
  });

  it('calcule les totaux séparément par devise', () => {
    service.createGroup(
      'Voyage Abidjan',
    );

    const charbel =
      service.addParticipant(
        'Charbel',
        'XOF',
      );

    const joel =
      service.addParticipant(
        'Joel',
        'EUR',
      );

    service.addExpense({
      title: 'Hôtel',
      amount: 60000,
      currency: 'XOF',
      paidBy: charbel.id,
      participantIds: [
        charbel.id,
        joel.id,
      ],
    });

    service.addExpense({
      title: 'Restaurant',
      amount: 120,
      currency: 'EUR',
      paidBy: joel.id,
      participantIds: [
        charbel.id,
        joel.id,
      ],
    });

    expect(
      service.totalsByCurrency(),
    ).toEqual([
      {
        currency: 'EUR',
        amount: 120,
      },
      {
        currency: 'XOF',
        amount: 60000,
      },
    ]);
  });

  it('refuse une dépense sans devise valide', () => {
    service.createGroup(
      'Voyage Abidjan',
    );

    const charbel =
      service.addParticipant(
        'Charbel',
        'XOF',
      );

    expect(() =>
      service.addExpense({
        title: 'Hôtel',
        amount: 60000,
        currency: 'ABC',
        paidBy: charbel.id,
        participantIds: [
          charbel.id,
        ],
      }),
    ).toThrow(
      'La devise ABC n’est pas prise en charge.',
    );
  });

  it('empêche la suppression d’un participant lié à une dépense', () => {
    service.createGroup(
      'Voyage Abidjan',
    );

    const charbel =
      service.addParticipant(
        'Charbel',
        'XOF',
      );

    const joel =
      service.addParticipant(
        'Joel',
        'CAD',
      );

    service.addExpense({
      title: 'Hôtel',
      amount: 60000,
      currency: 'XOF',
      paidBy: charbel.id,
      participantIds: [
        charbel.id,
        joel.id,
      ],
    });

    expect(() =>
      service.removeParticipant(
        joel.id,
      ),
    ).toThrow(
      'Impossible de supprimer ce participant car il est lié à une dépense.',
    );
  });

  it('supprime un participant qui n’est lié à aucune dépense', () => {
    service.createGroup(
      'Voyage Abidjan',
    );

    const charbel =
      service.addParticipant(
        'Charbel',
        'XOF',
      );

    service.removeParticipant(
      charbel.id,
    );

    expect(
      service.participants(),
    ).toHaveLength(0);
  });

  it('modifie une dépense en conservant son id et sa date de création', () => {
    service.createGroup(
      'Voyage Abidjan',
    );

    const charbel =
      service.addParticipant(
        'Charbel',
        'XOF',
      );

    const joel =
      service.addParticipant(
        'Joel',
        'EUR',
      );

    const expense =
      service.addExpense({
        title: 'Hôtel',
        amount: 60000,
        currency: 'XOF',
        paidBy: charbel.id,
        participantIds: [
          charbel.id,
          joel.id,
        ],
      });

    const updated =
      service.updateExpense(
        expense.id,
        {
          title: 'Restaurant',
          amount: 100,
          currency: 'EUR',
          paidBy: joel.id,
          participantIds: [
            charbel.id,
            joel.id,
          ],
        },
      );

    expect(updated.id).toBe(
      expense.id,
    );

    expect(updated.createdAt).toBe(
      expense.createdAt,
    );

    expect(updated.title).toBe(
      'Restaurant',
    );

    expect(updated.amount).toBe(
      100,
    );

    expect(updated.currency).toBe(
      'EUR',
    );
  });

  it('supprime une dépense', () => {
    service.createGroup(
      'Voyage Abidjan',
    );

    const charbel =
      service.addParticipant(
        'Charbel',
        'XOF',
      );

    const expense =
      service.addExpense({
        title: 'Taxi',
        amount: 5000,
        currency: 'XOF',
        paidBy: charbel.id,
        participantIds: [
          charbel.id,
        ],
      });

    service.removeExpense(
      expense.id,
    );

    expect(
      service.expenses(),
    ).toHaveLength(0);
  });

  it('réinitialise le groupe', () => {
    service.createGroup(
      'Voyage Abidjan',
    );

    service.resetGroup();

    expect(
      service.group(),
    ).toBeNull();

    expect(
      service.hasGroup(),
    ).toBe(false);

    expect(
      localStorage.getItem(
        'splitmate.active-group',
      ),
    ).toBeNull();
  });

  it('migre les anciens participants sans devise vers XOF', () => {
    localStorage.setItem(
      'splitmate.active-group',
      JSON.stringify({
        id: 'group-1',
        name: 'Ancien groupe',

        participants: [
          {
            id: 'participant-1',
            name: 'Charbel',
          },
        ],

        expenses: [],

        createdAt:
          '2026-08-27T18:00:00.000Z',
      }),
    );

    TestBed.resetTestingModule();

    TestBed.configureTestingModule({
      providers: [
        GroupService,
        StorageService,
      ],
    });

    const migrated =
      TestBed.inject(GroupService);

    expect(
      migrated
        .group()
        ?.participants[0]
        .currency,
    ).toBe('XOF');
  });

  it('migre une ancienne dépense sans devise vers la devise du payeur', () => {
    localStorage.setItem(
      'splitmate.active-group',
      JSON.stringify({
        id: 'group-1',
        name: 'Ancien groupe',

        participants: [
          {
            id: 'participant-1',
            name: 'Charbel',
            currency: 'EUR',
          },
          {
            id: 'participant-2',
            name: 'Joel',
            currency: 'CAD',
          },
        ],

        expenses: [
          {
            id: 'expense-1',
            title: 'Hôtel',
            amount: 100,
            paidBy:
              'participant-1',
            participantIds: [
              'participant-1',
              'participant-2',
            ],
            createdAt:
              '2026-08-27T18:00:00.000Z',
          },
        ],

        createdAt:
          '2026-08-27T18:00:00.000Z',
      }),
    );

    TestBed.resetTestingModule();

    TestBed.configureTestingModule({
      providers: [
        GroupService,
        StorageService,
      ],
    });

    const migrated =
      TestBed.inject(GroupService);

    expect(
      migrated
        .group()
        ?.expenses[0]
        .currency,
    ).toBe('EUR');
  });
});