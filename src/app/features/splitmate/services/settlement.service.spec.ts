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
    currency: 'EUR',
    createdAt:
      '2026-08-27T18:00:00.000Z',
    participants: [
      { id: 'a', name: 'Charbel' },
      { id: 'b', name: 'Joel' },
      { id: 'c', name: 'Leonel' },
      { id: 'd', name: 'Aristide' },
    ],
    expenses: [],
    ...overrides,
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('calcule correctement les soldes', () => {
    const group = createGroup({
      expenses: [
        {
          id: 'expense-1',
          title: 'Hôtel',
          // 600,00 € en centimes
          amount: 60000,
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

    expect(
      balances.find(
        (item) =>
          item.participantId === 'a',
      )?.balance,
    ).toBe(45000);

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
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
        { id: 'c', name: 'C' },
      ],
      expenses: [
        {
          id: 'expense-1',
          title: 'Test',
          amount: 10000,
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
  });

  it('génère des remboursements cohérents', () => {
    const balances: ParticipantBalance[] = [
      {
        participantId: 'a',
        participantName: 'Charbel',
        paid: 0,
        owed: 0,
        balance: 35000,
      },
      {
        participantId: 'b',
        participantName: 'Joel',
        paid: 0,
        owed: 0,
        balance: 5000,
      },
      {
        participantId: 'c',
        participantName: 'Leonel',
        paid: 0,
        owed: 0,
        balance: -15000,
      },
      {
        participantId: 'd',
        participantName: 'Aristide',
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
  });

  it('refuse des soldes incohérents', () => {
    const balances: ParticipantBalance[] = [
      {
        participantId: 'a',
        participantName: 'A',
        paid: 0,
        owed: 0,
        balance: 10000,
      },
      {
        participantId: 'b',
        participantName: 'B',
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
      'Les soldes sont incohérents',
    );
  });
});
