export type SettlementStatus = 'PENDING' | 'PAID';

export interface Settlement {
  settlementId: string;
  groupId: string;
  fromUserId: string; // the debtor (owes money)
  toUserId: string; // the creditor (is owed money)
  amount: number; // cents
  currency: string;
  status: SettlementStatus;
  calculatedAt: string; // ISO 8601
  paidAt?: string;
  paidBy?: string; // userId who marked it paid
}
