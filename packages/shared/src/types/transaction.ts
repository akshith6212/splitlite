export type SplitType = 'EQUAL' | 'EXACT' | 'PERCENTAGE' | 'SHARES';

export interface Transaction {
  txnId: string;
  groupId: string;
  description: string;
  amount: number; // stored in smallest currency unit (cents)
  currency: string; // ISO 4217, e.g. "USD"
  paidBy: string; // userId
  splitType: SplitType;
  createdAt: string; // ISO 8601
  updatedAt: string;
  createdBy: string; // userId
  notes?: string;
}

export interface SplitInput {
  userId: string;
  amount?: number; // for EXACT splits (cents)
  percentage?: number; // for PERCENTAGE splits (0–100)
  shares?: number; // for SHARES splits
}

export interface CreateTransactionInput {
  description: string;
  amount: number; // cents
  currency: string;
  paidBy: string;
  splitType: SplitType;
  splits: SplitInput[];
  notes?: string;
}

export interface UpdateTransactionInput {
  description?: string;
  amount?: number;
  paidBy?: string;
  splitType?: SplitType;
  splits?: SplitInput[];
  notes?: string;
}
