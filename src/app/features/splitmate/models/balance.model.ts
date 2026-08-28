export interface ParticipantBalance {
  participantId: string;
  participantName: string;
  currency: string;
  paid: number;
  owed: number;
  balance: number;
}