import { TestBed } from '@angular/core/testing';

import { StorageService } from '../../../core/storage/storage.service';

import { GroupService } from './group.service';
import { SettlementService } from './settlement.service';

describe('SplitMate multidevise - intégration métier', () => {
  let groupService: GroupService;
  let settlementService: SettlementService;

  beforeEach(() => {
    localStorage.clear();

    TestBed.configureTestingModule({
      providers: [
        GroupService,
        SettlementService,
        StorageService,
      ],
    });

    groupService =
      TestBed.inject(GroupService);

    settlementService =
      TestBed.inject(SettlementService);
  });

  it('crée un groupe sans lui imposer de devise', () => {
    const group =
      groupService.createGroup(
        'Voyage Europe',
      );

    expect(group.name).toBe(
      'Voyage Europe',
    );

    expect(
      (group as any).currency,
    ).toBeUndefined();
  });

  it('permet à un participant d’utiliser EUR comme devise préférée', () => {
    groupService.createGroup(
      'Voyage Europe',
    );

    const participant =
      groupService.addParticipant(
        'Alice',
        'EUR',
      );

    expect(
      participant.currency,
    ).toBe('EUR');
  });

  it('permet à un participant d’utiliser USD comme devise préférée', () => {
    groupService.createGroup(
      'Roadtrip USA',
    );

    const participant =
      groupService.addParticipant(
        'Bob',
        'USD',
      );

    expect(
      participant.currency,
    ).toBe('USD');
  });

  it('permet à un participant d’utiliser XOF comme devise préférée', () => {
    groupService.createGroup(
      'Week-end Lomé',
    );

    const participant =
      groupService.addParticipant(
        'Alice',
        'XOF',
      );

    expect(
      participant.currency,
    ).toBe('XOF');
  });

  it('permet plusieurs devises dans un même groupe', () => {
    groupService.createGroup(
      'Voyage international',
    );

    const alice =
      groupService.addParticipant(
        'Alice',
        'EUR',
      );

    const bob =
      groupService.addParticipant(
        'Bob',
        'USD',
      );

    const charlie =
      groupService.addParticipant(
        'Charlie',
        'XOF',
      );

    const diane =
      groupService.addParticipant(
        'Diane',
        'CAD',
      );

    expect(
      alice.currency,
    ).toBe('EUR');

    expect(
      bob.currency,
    ).toBe('USD');

    expect(
      charlie.currency,
    ).toBe('XOF');

    expect(
      diane.currency,
    ).toBe('CAD');

    expect(
      groupService.participants(),
    ).toHaveLength(4);
  });

  it('persiste les devises des participants dans localStorage', () => {
    groupService.createGroup(
      'Voyage Europe',
    );

    groupService.addParticipant(
      'Alice',
      'EUR',
    );

    groupService.addParticipant(
      'Bob',
      'CAD',
    );

    const stored =
      localStorage.getItem(
        'splitmate.active-group',
      );

    expect(stored).not.toBeNull();

    const parsed =
      JSON.parse(stored!);

    expect(
      parsed.participants[0].currency,
    ).toBe('EUR');

    expect(
      parsed.participants[1].currency,
    ).toBe('CAD');
  });

  it('conserve un montant EUR en unité mineure', () => {
    groupService.createGroup(
      'Voyage Europe',
    );

    const alice =
      groupService.addParticipant(
        'Alice',
        'EUR',
      );

    const bob =
      groupService.addParticipant(
        'Bob',
        'CAD',
      );

    const expense =
      groupService.addExpense({
        title: 'Restaurant',

        // 12,50 € = 1 250 centimes
        amount: 1250,

        currency: 'EUR',

        paidBy: alice.id,

        participantIds: [
          alice.id,
          bob.id,
        ],
      });

    expect(
      expense.amount,
    ).toBe(1250);

    expect(
      expense.currency,
    ).toBe('EUR');

    expect(
      groupService
        .totalsByCurrency(),
    ).toEqual([
      {
        currency: 'EUR',
        amount: 1250,
      },
    ]);
  });

  it('conserve un montant XOF sans sous-unité décimale', () => {
    groupService.createGroup(
      'Week-end Lomé',
    );

    const alice =
      groupService.addParticipant(
        'Alice',
        'XOF',
      );

    const bob =
      groupService.addParticipant(
        'Bob',
        'EUR',
      );

    const expense =
      groupService.addExpense({
        title: 'Taxi',

        amount: 12500,

        currency: 'XOF',

        paidBy: alice.id,

        participantIds: [
          alice.id,
          bob.id,
        ],
      });

    expect(
      expense.amount,
    ).toBe(12500);

    expect(
      expense.currency,
    ).toBe('XOF');
  });

  it('sépare les totaux lorsque plusieurs devises sont utilisées', () => {
    groupService.createGroup(
      'Voyage international',
    );

    const alice =
      groupService.addParticipant(
        'Alice',
        'EUR',
      );

    const bob =
      groupService.addParticipant(
        'Bob',
        'XOF',
      );

    groupService.addExpense({
      title: 'Restaurant',
      amount: 2500,
      currency: 'EUR',
      paidBy: alice.id,
      participantIds: [
        alice.id,
        bob.id,
      ],
    });

    groupService.addExpense({
      title: 'Taxi',
      amount: 15000,
      currency: 'XOF',
      paidBy: bob.id,
      participantIds: [
        alice.id,
        bob.id,
      ],
    });

    expect(
      groupService
        .totalsByCurrency(),
    ).toEqual([
      {
        currency: 'EUR',
        amount: 2500,
      },
      {
        currency: 'XOF',
        amount: 15000,
      },
    ]);
  });

  it('calcule des soldes à somme nulle en EUR', () => {
    groupService.createGroup(
      'Voyage Europe',
    );

    const a =
      groupService.addParticipant(
        'Alice',
        'EUR',
      );

    const b =
      groupService.addParticipant(
        'Bob',
        'CAD',
      );

    const c =
      groupService.addParticipant(
        'Charlie',
        'USD',
      );

    const d =
      groupService.addParticipant(
        'Diane',
        'GBP',
      );

    groupService.addExpense({
      title: 'Hôtel',

      // 600,00 € en centimes
      amount: 60000,

      currency: 'EUR',

      paidBy: a.id,

      participantIds: [
        a.id,
        b.id,
        c.id,
        d.id,
      ],
    });

    const balances =
      settlementService
        .calculateBalances(
          groupService.group()!,
        );

    const eurBalances =
      balances.filter(
        item =>
          item.currency === 'EUR',
      );

    expect(
      eurBalances.reduce(
        (sum, item) =>
          sum + item.balance,
        0,
      ),
    ).toBe(0);

    expect(
      eurBalances.every(
        item =>
          item.currency === 'EUR',
      ),
    ).toBe(true);
  });

  it('répartit exactement 10,00 € entre trois participants', () => {
    groupService.createGroup(
      'Test arrondi',
    );

    const a =
      groupService.addParticipant(
        'Alice',
        'EUR',
      );

    const b =
      groupService.addParticipant(
        'Bob',
        'USD',
      );

    const c =
      groupService.addParticipant(
        'Charlie',
        'CAD',
      );

    groupService.addExpense({
      title: 'Test',

      // 10,00 €
      amount: 1000,

      currency: 'EUR',

      paidBy: a.id,

      participantIds: [
        a.id,
        b.id,
        c.id,
      ],
    });

    const balances =
      settlementService
        .calculateBalances(
          groupService.group()!,
        );

    expect(
      balances.reduce(
        (sum, item) =>
          sum + item.owed,
        0,
      ),
    ).toBe(1000);

    expect(
      balances.reduce(
        (sum, item) =>
          sum + item.balance,
        0,
      ),
    ).toBe(0);
  });

  it('génère des remboursements dont le total correspond à la dette', () => {
    groupService.createGroup(
      'Voyage Europe',
    );

    const a =
      groupService.addParticipant(
        'Alice',
        'EUR',
      );

    const b =
      groupService.addParticipant(
        'Bob',
        'CAD',
      );

    const c =
      groupService.addParticipant(
        'Charlie',
        'USD',
      );

    groupService.addExpense({
      title: 'Hôtel',

      amount: 9000,

      currency: 'EUR',

      paidBy: a.id,

      participantIds: [
        a.id,
        b.id,
        c.id,
      ],
    });

    const balances =
      settlementService
        .calculateBalances(
          groupService.group()!,
        );

    const settlements =
      settlementService
        .calculateSettlements(
          balances,
        );

    const debt =
      balances
        .filter(
          item =>
            item.balance < 0,
        )
        .reduce(
          (sum, item) =>
            sum +
            Math.abs(
              item.balance,
            ),
          0,
        );

    expect(
      settlements.reduce(
        (sum, item) =>
          sum + item.amount,
        0,
      ),
    ).toBe(debt);

    expect(
      settlements.every(
        item =>
          item.currency === 'EUR',
      ),
    ).toBe(true);
  });

  it('génère indépendamment les remboursements EUR et XOF', () => {
    groupService.createGroup(
      'Voyage multidevise',
    );

    const alice =
      groupService.addParticipant(
        'Alice',
        'EUR',
      );

    const bob =
      groupService.addParticipant(
        'Bob',
        'XOF',
      );

    groupService.addExpense({
      title: 'Restaurant',
      amount: 4000,
      currency: 'EUR',
      paidBy: alice.id,
      participantIds: [
        alice.id,
        bob.id,
      ],
    });

    groupService.addExpense({
      title: 'Taxi',
      amount: 10000,
      currency: 'XOF',
      paidBy: bob.id,
      participantIds: [
        alice.id,
        bob.id,
      ],
    });

    const balances =
      settlementService
        .calculateBalances(
          groupService.group()!,
        );

    const settlements =
      settlementService
        .calculateSettlements(
          balances,
        );

    expect(
      settlements.some(
        item =>
          item.currency === 'EUR',
      ),
    ).toBe(true);

    expect(
      settlements.some(
        item =>
          item.currency === 'XOF',
      ),
    ).toBe(true);
  });

  it('refuse un participant en doublon', () => {
    groupService.createGroup(
      'Voyage Europe',
    );

    groupService.addParticipant(
      'Alice',
      'EUR',
    );

    expect(() =>
      groupService.addParticipant(
        ' alice ',
        'USD',
      ),
    ).toThrow(
      'Ce participant existe déjà.',
    );
  });

  it('refuse une dépense de montant nul', () => {
    groupService.createGroup(
      'Voyage Europe',
    );

    const alice =
      groupService.addParticipant(
        'Alice',
        'EUR',
      );

    expect(() =>
      groupService.addExpense({
        title:
          'Dépense invalide',

        amount: 0,

        currency: 'EUR',

        paidBy:
          alice.id,

        participantIds: [
          alice.id,
        ],
      }),
    ).toThrow(
      'Le montant doit être un entier positif.',
    );
  });

  it('refuse une dépense sans bénéficiaire', () => {
    groupService.createGroup(
      'Voyage Europe',
    );

    const alice =
      groupService.addParticipant(
        'Alice',
        'EUR',
      );

    expect(() =>
      groupService.addExpense({
        title:
          'Dépense invalide',

        amount: 1000,

        currency: 'EUR',

        paidBy:
          alice.id,

        participantIds: [],
      }),
    ).toThrow(
      'La dépense doit avoir au moins un bénéficiaire.',
    );
  });

  it('refuse une devise inconnue', () => {
    groupService.createGroup(
      'Test devise',
    );

    expect(() =>
      groupService.addParticipant(
        'Alice',
        'ABC',
      ),
    ).toThrow(
      'La devise ABC n’est pas prise en charge.',
    );
  });

  it('réinitialise complètement un groupe multidevise', () => {
    groupService.createGroup(
      'Voyage Europe',
    );

    groupService.addParticipant(
      'Alice',
      'EUR',
    );

    groupService.addParticipant(
      'Bob',
      'CAD',
    );

    groupService.resetGroup();

    expect(
      groupService.group(),
    ).toBeNull();

    expect(
      groupService.hasGroup(),
    ).toBe(false);

    expect(
      localStorage.getItem(
        'splitmate.active-group',
      ),
    ).toBeNull();
  });
});