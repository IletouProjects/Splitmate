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
      providers: [GroupService, SettlementService, StorageService],
    });

    groupService = TestBed.inject(GroupService);
    settlementService = TestBed.inject(SettlementService);
  });

  it('crée un groupe en EUR', () => {
    const group = groupService.createGroup('Voyage Europe', 'EUR');
    expect(group.currency).toBe('EUR');
  });

  it('crée un groupe en USD', () => {
    expect(groupService.createGroup('Roadtrip USA', 'USD').currency).toBe('USD');
  });

  it('crée un groupe en XOF', () => {
    expect(groupService.createGroup('Week-end Lomé', 'XOF').currency).toBe('XOF');
  });

  it('crée un groupe en GBP', () => {
    expect(groupService.createGroup('London trip', 'GBP').currency).toBe('GBP');
  });

  it('crée un groupe en CAD', () => {
    expect(groupService.createGroup('Montréal', 'CAD').currency).toBe('CAD');
  });

  it('persiste la devise du groupe dans localStorage', () => {
    groupService.createGroup('Voyage Europe', 'EUR');
    const stored = localStorage.getItem('splitmate.active-group');

    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!).currency).toBe('EUR');
  });

  it('conserve un montant EUR en centimes', () => {
    groupService.createGroup('Voyage Europe', 'EUR');
    const alice = groupService.addParticipant('Alice');
    const bob = groupService.addParticipant('Bob');

    const expense = groupService.addExpense({
      title: 'Restaurant',
      amount: 1250,
      paidBy: alice.id,
      participantIds: [alice.id, bob.id],
    });

    expect(expense.amount).toBe(1250);
    expect(groupService.totalExpenses()).toBe(1250);
  });

  it('conserve un montant XOF sans sous-unité décimale', () => {
    groupService.createGroup('Week-end Lomé', 'XOF');
    const alice = groupService.addParticipant('Alice');
    const bob = groupService.addParticipant('Bob');

    const expense = groupService.addExpense({
      title: 'Taxi',
      amount: 12500,
      paidBy: alice.id,
      participantIds: [alice.id, bob.id],
    });

    expect(expense.amount).toBe(12500);
  });

  it('calcule des soldes à somme nulle en EUR', () => {
    groupService.createGroup('Voyage Europe', 'EUR');
    const a = groupService.addParticipant('Alice');
    const b = groupService.addParticipant('Bob');
    const c = groupService.addParticipant('Charlie');
    const d = groupService.addParticipant('Diane');

    groupService.addExpense({
      title: 'Hôtel',
      amount: 60000,
      paidBy: a.id,
      participantIds: [a.id, b.id, c.id, d.id],
    });

    const balances = settlementService.calculateBalances(groupService.group()!);
    expect(balances.reduce((sum, item) => sum + item.balance, 0)).toBe(0);
  });

  it('répartit exactement 10,00 € entre trois participants', () => {
    groupService.createGroup('Test arrondi', 'EUR');
    const a = groupService.addParticipant('Alice');
    const b = groupService.addParticipant('Bob');
    const c = groupService.addParticipant('Charlie');

    groupService.addExpense({
      title: 'Test',
      amount: 1000,
      paidBy: a.id,
      participantIds: [a.id, b.id, c.id],
    });

    const balances = settlementService.calculateBalances(groupService.group()!);

    expect(balances.reduce((sum, item) => sum + item.owed, 0)).toBe(1000);
    expect(balances.reduce((sum, item) => sum + item.balance, 0)).toBe(0);
  });

  it('génère des remboursements dont le total correspond à la dette', () => {
    groupService.createGroup('Voyage Europe', 'EUR');
    const a = groupService.addParticipant('Alice');
    const b = groupService.addParticipant('Bob');
    const c = groupService.addParticipant('Charlie');

    groupService.addExpense({
      title: 'Hôtel',
      amount: 9000,
      paidBy: a.id,
      participantIds: [a.id, b.id, c.id],
    });

    const balances = settlementService.calculateBalances(groupService.group()!);
    const settlements = settlementService.calculateSettlements(balances);

    const debt = balances
      .filter((item) => item.balance < 0)
      .reduce((sum, item) => sum + Math.abs(item.balance), 0);

    expect(settlements.reduce((sum, item) => sum + item.amount, 0)).toBe(debt);
  });

  it('refuse un participant en doublon', () => {
    groupService.createGroup('Voyage Europe', 'EUR');
    groupService.addParticipant('Alice');

    expect(() => groupService.addParticipant(' alice ')).toThrow(
      'Un participant avec ce nom existe déjà.',
    );
  });

  it('refuse une dépense de montant nul', () => {
    groupService.createGroup('Voyage Europe', 'EUR');
    const alice = groupService.addParticipant('Alice');

    expect(() =>
      groupService.addExpense({
        title: 'Dépense invalide',
        amount: 0,
        paidBy: alice.id,
        participantIds: [alice.id],
      }),
    ).toThrow('Le montant doit être positif.');
  });

  it('refuse une dépense sans bénéficiaire', () => {
    groupService.createGroup('Voyage Europe', 'EUR');
    const alice = groupService.addParticipant('Alice');

    expect(() =>
      groupService.addExpense({
        title: 'Dépense invalide',
        amount: 1000,
        paidBy: alice.id,
        participantIds: [],
      }),
    ).toThrow('Sélectionnez au moins un bénéficiaire.');
  });

  it('réinitialise complètement un groupe multidevise', () => {
    groupService.createGroup('Voyage Europe', 'EUR');
    groupService.resetGroup();

    expect(groupService.group()).toBeNull();
    expect(localStorage.getItem('splitmate.active-group')).toBeNull();
  });
});
