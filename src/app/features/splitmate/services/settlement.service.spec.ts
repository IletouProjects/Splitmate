import { TestBed } from '@angular/core/testing';

import { ParticipantBalance } from '../models/balance.model';
import { SplitGroup } from '../models/group.model';

import { SettlementService } from './settlement.service';

describe('SettlementService', () => {
  let service: SettlementService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SettlementService],
    });

    service = TestBed.inject(SettlementService);
  });

  const createGroup = (
    overrides: Partial<SplitGroup> = {},
  ): SplitGroup => ({
    id: 'group-1',

    name: 'Voyage test',

    createdAt:
      '2026-08-27T18:00:00.000Z',

    participants: [
      {
        id: 'a',
        name: 'Charbel',
        currency: 'XOF',
      },
      {
        id: 'b',
        name: 'Joel',
        currency: 'CAD',
      },
      {
        id: 'c',
        name: 'Leonel',
        currency: 'EUR',
      },
      {
        id: 'd',
        name: 'Aristide',
        currency: 'USD',
      },
    ],

    expenses: [],

    ...overrides,
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('calcule correctement les soldes dans la devise de la dépense', () => {
    const group = createGroup({
      expenses: [
        {
          id: 'expense-1',

          title: 'Hôtel',

          // 60 000 unités XOF
          amount: 60000,

          currency: 'XOF',

          paidBy: 'a',

          participantIds: [
            'a',
            'b',
            'c',
            'd',
          ],

          createdAt:
            '2026-08-27T18:05:00.000Z',
        },
      ],
    });

    const balances =
      service.calculateBalances(group);

    const charbelBalance =
      balances.find(
        item =>
          item.participantId === 'a' &&
          item.currency === 'XOF',
      );

    expect(
      charbelBalance?.balance,
    ).toBe(45000);

    expect(
      charbelBalance?.currency,
    ).toBe('XOF');

    expect(
      balances.reduce(
        (sum, item) =>
          sum + item.balance,
        0,
      ),
    ).toBe(0);
  });

  it('répartit exactement une somme non divisible', () => {
    const group = createGroup({
      participants: [
        {
          id: 'a',
          name: 'A',
          currency: 'XOF',
        },
        {
          id: 'b',
          name: 'B',
          currency: 'EUR',
        },
        {
          id: 'c',
          name: 'C',
          currency: 'CAD',
        },
      ],

      expenses: [
        {
          id: 'expense-1',

          title: 'Test',

          amount: 10000,

          currency: 'XOF',

          paidBy: 'a',

          participantIds: [
            'a',
            'b',
            'c',
          ],

          createdAt:
            '2026-08-27T18:10:00.000Z',
        },
      ],
    });

    const balances =
      service.calculateBalances(group);

    const totalOwed =
      balances.reduce(
        (sum, item) =>
          sum + item.owed,
        0,
      );

    expect(totalOwed).toBe(10000);

    expect(
      balances.reduce(
        (sum, item) =>
          sum + item.balance,
        0,
      ),
    ).toBe(0);

    expect(
      balances.every(
        item =>
          item.currency === 'XOF',
      ),
    ).toBe(true);
  });

  it('génère des remboursements cohérents dans une même devise', () => {
    const balances: ParticipantBalance[] = [
      {
        participantId: 'a',
        participantName: 'Charbel',

        currency: 'XOF',

        paid: 0,
        owed: 0,
        balance: 35000,
      },
      {
        participantId: 'b',
        participantName: 'Joel',

        currency: 'XOF',

        paid: 0,
        owed: 0,
        balance: 5000,
      },
      {
        participantId: 'c',
        participantName: 'Leonel',

        currency: 'XOF',

        paid: 0,
        owed: 0,
        balance: -15000,
      },
      {
        participantId: 'd',
        participantName: 'Aristide',

        currency: 'XOF',

        paid: 0,
        owed: 0,
        balance: -25000,
      },
    ];

    const settlements =
      service.calculateSettlements(
        balances,
      );

    expect(
      settlements.reduce(
        (sum, item) =>
          sum + item.amount,
        0,
      ),
    ).toBe(40000);

    expect(
      settlements.every(
        item =>
          item.currency === 'XOF',
      ),
    ).toBe(true);
  });

  it('sépare les remboursements selon les devises', () => {
    const balances: ParticipantBalance[] = [
      {
        participantId: 'a',
        participantName: 'Charbel',

        currency: 'XOF',

        paid: 0,
        owed: 0,
        balance: 30000,
      },
      {
        participantId: 'b',
        participantName: 'Joel',

        currency: 'XOF',

        paid: 0,
        owed: 0,
        balance: -30000,
      },

      {
        participantId: 'c',
        participantName: 'Leonel',

        currency: 'EUR',

        paid: 0,
        owed: 0,
        balance: 5000,
      },
      {
        participantId: 'd',
        participantName: 'Aristide',

        currency: 'EUR',

        paid: 0,
        owed: 0,
        balance: -5000,
      },
    ];

    const settlements =
      service.calculateSettlements(
        balances,
      );

    expect(settlements).toHaveLength(2);

    const xofSettlement =
      settlements.find(
        item =>
          item.currency === 'XOF',
      );

    expect(xofSettlement).toEqual({
      fromParticipantId: 'b',
      fromParticipantName: 'Joel',

      toParticipantId: 'a',
      toParticipantName: 'Charbel',

      amount: 30000,

      currency: 'XOF',
    });

    const eurSettlement =
      settlements.find(
        item =>
          item.currency === 'EUR',
      );

    expect(eurSettlement).toEqual({
      fromParticipantId: 'd',
      fromParticipantName: 'Aristide',

      toParticipantId: 'c',
      toParticipantName: 'Leonel',

      amount: 5000,

      currency: 'EUR',
    });
  });

  it('refuse des soldes incohérents dans une devise', () => {
    const balances: ParticipantBalance[] = [
      {
        participantId: 'a',
        participantName: 'A',

        currency: 'XOF',

        paid: 0,
        owed: 0,
        balance: 10000,
      },
      {
        participantId: 'b',
        participantName: 'B',

        currency: 'XOF',

        paid: 0,
        owed: 0,
        balance: -9000,
      },
    ];

    expect(() =>
      service.calculateSettlements(
        balances,
      ),
    ).toThrow(
      'Les soldes XOF ne sont pas équilibrés.',
    );
  });

  it('refuse une dépense sans bénéficiaire', () => {
    const group = createGroup({
      expenses: [
        {
          id: 'expense-1',

          title: 'Taxi',

          amount: 5000,

          currency: 'XOF',

          paidBy: 'a',

          participantIds: [],

          createdAt:
            '2026-08-27T18:10:00.000Z',
        },
      ],
    });

    expect(() =>
      service.calculateBalances(group),
    ).toThrow(
      'La dépense doit avoir au moins un bénéficiaire.',
    );
  });

  it('refuse un montant nul', () => {
    const group = createGroup({
      expenses: [
        {
          id: 'expense-1',

          title: 'Taxi',

          amount: 0,

          currency: 'XOF',

          paidBy: 'a',

          participantIds: [
            'a',
            'b',
          ],

          createdAt:
            '2026-08-27T18:10:00.000Z',
        },
      ],
    });

    expect(() =>
      service.calculateBalances(group),
    ).toThrow(
      'Le montant doit être un entier positif.',
    );
  });

  it('refuse un payeur inexistant', () => {
    const group = createGroup({
      expenses: [
        {
          id: 'expense-1',

          title: 'Taxi',

          amount: 5000,

          currency: 'XOF',

          paidBy: 'inconnu',

          participantIds: [
            'a',
            'b',
          ],

          createdAt:
            '2026-08-27T18:10:00.000Z',
        },
      ],
    });

    expect(() =>
      service.calculateBalances(group),
    ).toThrow(
      'Le payeur de la dépense est invalide.',
    );
  });

  it('refuse les bénéficiaires en doublon', () => {
    const group = createGroup({
      expenses: [
        {
          id: 'expense-1',

          title: 'Restaurant',

          amount: 30000,

          currency: 'XOF',

          paidBy: 'a',

          participantIds: [
            'a',
            'b',
            'b',
          ],

          createdAt:
            '2026-08-27T18:10:00.000Z',
        },
      ],
    });

    expect(() =>
      service.calculateBalances(group),
    ).toThrow(
      'Les bénéficiaires contiennent des doublons.',
    );
  });
});