export interface Settlement {
  fromParticipantId: string;
  fromParticipantName: string;

  toParticipantId: string;
  toParticipantName: string;

  amount: number;
}