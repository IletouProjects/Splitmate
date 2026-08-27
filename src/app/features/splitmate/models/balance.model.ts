export interface ParticipantBalance {
  participantId: string;
  participantName: string;

  /**
   * Total avancé par le participant.
   */
  paid: number;

  /**
   * Part réelle du participant dans les dépenses.
   */
  owed: number;

  /**
   * paid - owed
   *
   * > 0 : doit recevoir
   * < 0 : doit rembourser
   * = 0 : équilibré
   */
  balance: number;
}