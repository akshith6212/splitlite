export interface Split {
  txnId: string;
  userId: string;
  groupId: string;
  owedAmount: number; // what this user owes for this transaction (cents)
  settled: boolean;
  settledAt?: string; // ISO 8601
}
