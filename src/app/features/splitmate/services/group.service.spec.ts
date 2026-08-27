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

  it('crée un groupe et le persiste dans localStorage', () => {
    const group = service.createGroup('Voyage Abidjan');

    expect(group.name).toBe('Voyage Abidjan');
    expect(service.hasGroup()).toBe(true);
    expect(service.group()?.name).toBe('Voyage Abidjan');

    const stored = localStorage.getItem('splitmate.active-group');
    expect(stored).not.toBeNull();
  });

  it('refuse un nom de groupe vide', () => {
    expect(() => service.createGroup('   ')).toThrow(
      'Le nom du groupe est obligatoire.',
    );
  });

  it('ajoute un participant au groupe', () => {
    service.createGroup('Voyage Abidjan');

    const participant = service.addParticipant('Charbel');

    expect(participant.name).toBe('Charbel');
    expect(service.participants()).toHaveLength(1);
    expect(service.participants()[0].id).toBe(participant.id);
  });

  it('refuse un participant avec un nom déjà utilisé', () => {
    service.createGroup('Voyage Abidjan');
    service.addParticipant('Charbel');

    expect(() => service.addParticipant(' charbel ')).toThrow(
      'Un participant avec ce nom existe déjà.',
    );
  });

  it('supprime un participant non lié à une dépense', () => {
    service.createGroup('Voyage Abidjan');

    const participant = service.addParticipant('Charbel');

    service.removeParticipant(participant.id);

    expect(service.participants()).toHaveLength(0);
  });

  it('ajoute une dépense valide et met à jour le total', () => {
    service.createGroup('Voyage Abidjan');

    const charbel = service.addParticipant('Charbel');
    const joel = service.addParticipant('Joel');

    const expense = service.addExpense({
      title: 'Hôtel',
      amount: 60000,
      paidBy: charbel.id,
      participantIds: [
        charbel.id,
        joel.id,
      ],
    });

    expect(expense.title).toBe('Hôtel');
    expect(expense.amount).toBe(60000);
    expect(service.expenses()).toHaveLength(1);
    expect(service.totalExpenses()).toBe(60000);
  });

  it('refuse une dépense avec un montant invalide', () => {
    service.createGroup('Voyage Abidjan');

    const charbel = service.addParticipant('Charbel');

    expect(() =>
      service.addExpense({
        title: 'Taxi',
        amount: 0,
        paidBy: charbel.id,
        participantIds: [charbel.id],
      }),
    ).toThrow(
      'Le montant doit être un entier positif.',
    );
  });

  it('refuse une dépense sans bénéficiaire', () => {
    service.createGroup('Voyage Abidjan');

    const charbel = service.addParticipant('Charbel');

    expect(() =>
      service.addExpense({
        title: 'Taxi',
        amount: 5000,
        paidBy: charbel.id,
        participantIds: [],
      }),
    ).toThrow(
      'Sélectionnez au moins un bénéficiaire.',
    );
  });

  it('empêche la suppression d’un participant lié à une dépense', () => {
    service.createGroup('Voyage Abidjan');

    const charbel = service.addParticipant('Charbel');
    const joel = service.addParticipant('Joel');

    service.addExpense({
      title: 'Hôtel',
      amount: 60000,
      paidBy: charbel.id,
      participantIds: [
        charbel.id,
        joel.id,
      ],
    });

    expect(() =>
      service.removeParticipant(joel.id),
    ).toThrow(
      'Impossible de supprimer un participant associé à une dépense.',
    );
  });

  it('modifie une dépense en conservant son id et sa date de création', () => {
    service.createGroup('Voyage Abidjan');

    const charbel = service.addParticipant('Charbel');
    const joel = service.addParticipant('Joel');

    const original = service.addExpense({
      title: 'Hôtel',
      amount: 60000,
      paidBy: charbel.id,
      participantIds: [
        charbel.id,
        joel.id,
      ],
    });

    const updated = service.updateExpense(
      original.id,
      {
        title: 'Hôtel - 2 nuits',
        amount: 70000,
        paidBy: charbel.id,
        participantIds: [
          charbel.id,
          joel.id,
        ],
      },
    );

    expect(updated.id).toBe(original.id);
    expect(updated.createdAt).toBe(
      original.createdAt,
    );
    expect(updated.title).toBe(
      'Hôtel - 2 nuits',
    );
    expect(service.totalExpenses()).toBe(
      70000,
    );
  });

  it('supprime une dépense', () => {
    service.createGroup('Voyage Abidjan');

    const charbel = service.addParticipant('Charbel');

    const expense = service.addExpense({
      title: 'Taxi',
      amount: 5000,
      paidBy: charbel.id,
      participantIds: [charbel.id],
    });

    service.removeExpense(expense.id);

    expect(service.expenses()).toHaveLength(0);
    expect(service.totalExpenses()).toBe(0);
  });

  it('réinitialise le groupe et supprime la persistance locale', () => {
    service.createGroup('Voyage Abidjan');

    expect(
      localStorage.getItem('splitmate.active-group'),
    ).not.toBeNull();

    service.resetGroup();

    expect(service.group()).toBeNull();
    expect(service.hasGroup()).toBe(false);
    expect(
      localStorage.getItem('splitmate.active-group'),
    ).toBeNull();
  });

  it('charge un groupe existant depuis localStorage', () => {
    const storedGroup = {
      id: 'group-1',
      name: 'Voyage Lomé',
      participants: [
        {
          id: 'p1',
          name: 'Charbel',
        },
      ],
      expenses: [],
      createdAt: '2026-08-27T18:00:00.000Z',
    };

    localStorage.setItem(
      'splitmate.active-group',
      JSON.stringify(storedGroup),
    );

    TestBed.resetTestingModule();

    TestBed.configureTestingModule({
      providers: [
        GroupService,
        StorageService,
      ],
    });

    const reloadedService =
      TestBed.inject(GroupService);

    expect(reloadedService.group()?.name).toBe(
      'Voyage Lomé',
    );
    expect(
      reloadedService.participants(),
    ).toHaveLength(1);
  });
});
