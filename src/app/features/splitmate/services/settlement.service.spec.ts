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
    createdAt: '2026-08-27T18:00:00.000Z',
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

  it('calcule correctement les soldes pour une dépense simple', () => {
    const group = createGroup({
      expenses: [
        {
          id: 'expense-1',
          title: 'Hôtel',
          amount: 60000,
          paidBy: 'a',
          participantIds: ['a', 'b', 'c', 'd'],
          createdAt: '2026-08-27T18:05:00.000Z',
        },
      ],
    });

    const balances = service.calculateBalances(group);

    expect(balances).toEqual([
      {
        participantId: 'a',
        participantName: 'Charbel',
        paid: 60000,
        owed: 15000,
        balance: 45000,
      },
      {
        participantId: 'b',
        participantName: 'Joel',
        paid: 0,
        owed: 15000,
        balance: -15000,
      },
      {
        participantId: 'c',
        participantName: 'Leonel',
        paid: 0,
        owed: 15000,
        balance: -15000,
      },
      {
        participantId: 'd',
        participantName: 'Aristide',
        paid: 0,
        owed: 15000,
        balance: -15000,
      },
    ]);
  });

  it('conserve une somme des soldes égale à zéro', () => {
    const group = createGroup({
      expenses: [
        {
          id: 'expense-1',
          title: 'Hôtel',
          amount: 60000,
          paidBy: 'a',
          participantIds: ['a', 'b', 'c', 'd'],
          createdAt: '2026-08-27T18:05:00.000Z',
        },
        {
          id: 'expense-2',
          title: 'Restaurant',
          amount: 30000,
          paidBy: 'b',
          participantIds: ['a', 'b', 'd'],
          createdAt: '2026-08-27T19:00:00.000Z',
        },
      ],
    });

    const balances = service.calculateBalances(group);
    const total = balances.reduce(
      (sum, participant) => sum + participant.balance,
      0,
    );

    expect(total).toBe(0);
  });

  it('répartit correctement un montant non divisible sans perdre de FCFA', () => {
    const group = createGroup({
      participants: [
        { id: 'a', name: 'Charbel' },
        { id: 'b', name: 'Joel' },
        { id: 'c', name: 'Leonel' },
      ],
      expenses: [
        {
          id: 'expense-1',
          title: 'Taxi',
          amount: 10000,
          paidBy: 'a',
          participantIds: ['a', 'b', 'c'],
          createdAt: '2026-08-27T18:10:00.000Z',
        },
      ],
    });

    const balances = service.calculateBalances(group);
    const totalOwed = balances.reduce(
      (sum, participant) => sum + participant.owed,
      0,
    );

    expect(totalOwed).toBe(10000);
    expect(balances.find((item) => item.participantId === 'a')?.owed).toBe(3334);
    expect(balances.find((item) => item.participantId === 'b')?.owed).toBe(3333);
    expect(balances.find((item) => item.participantId === 'c')?.owed).toBe(3333);
  });

  it('génère un plan de remboursement cohérent', () => {
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

    const settlements = service.calculateSettlements(balances);

    expect(settlements).toEqual([
      {
        fromParticipantId: 'd',
        fromParticipantName: 'Aristide',
        toParticipantId: 'a',
        toParticipantName: 'Charbel',
        amount: 25000,
      },
      {
        fromParticipantId: 'c',
        fromParticipantName: 'Leonel',
        toParticipantId: 'a',
        toParticipantName: 'Charbel',
        amount: 10000,
      },
      {
        fromParticipantId: 'c',
        fromParticipantName: 'Leonel',
        toParticipantId: 'b',
        toParticipantName: 'Joel',
        amount: 5000,
      },
    ]);

    const totalSettled = settlements.reduce(
      (sum, settlement) => sum + settlement.amount,
      0,
    );

    expect(totalSettled).toBe(40000);
  });

  it('retourne aucun remboursement quand tous les soldes sont nuls', () => {
    const balances: ParticipantBalance[] = [
      {
        participantId: 'a',
        participantName: 'Charbel',
        paid: 10000,
        owed: 10000,
        balance: 0,
      },
      {
        participantId: 'b',
        participantName: 'Joel',
        paid: 5000,
        owed: 5000,
        balance: 0,
      },
    ];

    expect(service.calculateSettlements(balances)).toEqual([]);
  });

  it('refuse un montant nul ou négatif', () => {
    const group = createGroup({
      expenses: [
        {
          id: 'expense-1',
          title: 'Dépense invalide',
          amount: 0,
          paidBy: 'a',
          participantIds: ['a', 'b'],
          createdAt: '2026-08-27T18:15:00.000Z',
        },
      ],
    });

    expect(() => service.calculateBalances(group)).toThrow('Montant invalide');
  });

  it('refuse un montant non entier pour le MVP FCFA', () => {
    const group = createGroup({
      expenses: [
        {
          id: 'expense-1',
          title: 'Dépense décimale',
          amount: 1000.5,
          paidBy: 'a',
          participantIds: ['a', 'b'],
          createdAt: '2026-08-27T18:15:00.000Z',
        },
      ],
    });

    expect(() => service.calculateBalances(group)).toThrow('Montant invalide');
  });

  it("refuse un payeur qui n'existe pas dans le groupe", () => {
    const group = createGroup({
      expenses: [
        {
          id: 'expense-1',
          title: 'Taxi',
          amount: 5000,
          paidBy: 'inconnu',
          participantIds: ['a', 'b'],
          createdAt: '2026-08-27T18:20:00.000Z',
        },
      ],
    });

    expect(() => service.calculateBalances(group)).toThrow(
      "n'existe pas dans le groupe",
    );
  });

  it('refuse une dépense sans bénéficiaire', () => {
    const group = createGroup({
      expenses: [
        {
          id: 'expense-1',
          title: 'Taxi',
          amount: 5000,
          paidBy: 'a',
          participantIds: [],
          createdAt: '2026-08-27T18:20:00.000Z',
        },
      ],
    });

    expect(() => service.calculateBalances(group)).toThrow('aucun bénéficiaire');
  });

  it('refuse les bénéficiaires en double', () => {
    const group = createGroup({
      expenses: [
        {
          id: 'expense-1',
          title: 'Restaurant',
          amount: 9000,
          paidBy: 'a',
          participantIds: ['a', 'b', 'b'],
          createdAt: '2026-08-27T18:30:00.000Z',
        },
      ],
    });

    expect(() => service.calculateBalances(group)).toThrow(
      'participants en double',
    );
  });

  it("refuse un bénéficiaire qui n'existe pas dans le groupe", () => {
    const group = createGroup({
      expenses: [
        {
          id: 'expense-1',
          title: 'Restaurant',
          amount: 9000,
          paidBy: 'a',
          participantIds: ['a', 'inconnu'],
          createdAt: '2026-08-27T18:30:00.000Z',
        },
      ],
    });

    expect(() => service.calculateBalances(group)).toThrow(
      "n'existe pas dans le groupe",
    );
  });

  it('refuse de calculer des remboursements à partir de soldes incohérents', () => {
    const balances: ParticipantBalance[] = [
      {
        participantId: 'a',
        participantName: 'Charbel',
        paid: 0,
        owed: 0,
        balance: 10000,
      },
      {
        participantId: 'b',
        participantName: 'Joel',
        paid: 0,
        owed: 0,
        balance: -9000,
      },
    ];

    expect(() => service.calculateSettlements(balances)).toThrow(
      'Les soldes sont incohérents',
    );
  });
});
