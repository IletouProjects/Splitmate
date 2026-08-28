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

  it('crée un groupe avec sa devise et le persiste', () => {
    const group = service.createGroup(
      'Voyage Abidjan',
      'EUR',
    );

    expect(group.name).toBe('Voyage Abidjan');
    expect(group.currency).toBe('EUR');
    expect(service.hasGroup()).toBe(true);

    const stored = localStorage.getItem(
      'splitmate.active-group',
    );

    expect(stored).not.toBeNull();
    expect(JSON.parse(stored!).currency).toBe('EUR');
  });

  it('refuse un nom de groupe vide', () => {
    expect(() =>
      service.createGroup('   ', 'EUR'),
    ).toThrow(
      'Le nom du groupe est obligatoire.',
    );
  });

  it('ajoute un participant au groupe', () => {
    service.createGroup(
      'Voyage Abidjan',
      'EUR',
    );

    const participant =
      service.addParticipant('Charbel');

    expect(participant.name).toBe('Charbel');
    expect(service.participants()).toHaveLength(1);
  });

  it('refuse un participant en doublon', () => {
    service.createGroup(
      'Voyage Abidjan',
      'EUR',
    );

    service.addParticipant('Charbel');

    expect(() =>
      service.addParticipant(' charbel '),
    ).toThrow(
      'Un participant avec ce nom existe déjà.',
    );
  });

  it('ajoute une dépense exprimée en unité mineure', () => {
    service.createGroup(
      'Voyage Abidjan',
      'EUR',
    );

    const charbel =
      service.addParticipant('Charbel');

    const joel =
      service.addParticipant('Joel');

    const expense = service.addExpense({
      title: 'Hôtel',
      // 600,00 € = 60 000 centimes
      amount: 60000,
      paidBy: charbel.id,
      participantIds: [
        charbel.id,
        joel.id,
      ],
    });

    expect(expense.amount).toBe(60000);
    expect(service.totalExpenses()).toBe(60000);
  });

  it('empêche la suppression d’un participant lié à une dépense', () => {
    service.createGroup(
      'Voyage Abidjan',
      'EUR',
    );

    const charbel =
      service.addParticipant('Charbel');

    const joel =
      service.addParticipant('Joel');

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

  it('réinitialise le groupe', () => {
    service.createGroup(
      'Voyage Abidjan',
      'USD',
    );

    service.resetGroup();

    expect(service.group()).toBeNull();
    expect(service.hasGroup()).toBe(false);
    expect(
      localStorage.getItem(
        'splitmate.active-group',
      ),
    ).toBeNull();
  });

  it('migre un ancien groupe sans devise vers XOF', () => {
    localStorage.setItem(
      'splitmate.active-group',
      JSON.stringify({
        id: 'group-1',
        name: 'Ancien groupe',
        participants: [],
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
      migrated.group()?.currency,
    ).toBe('XOF');
  });
});
