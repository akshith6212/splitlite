import { getAccessToken, refreshTokens } from './auth';

const API_URL = process.env.EXPO_PUBLIC_API_URL || '';

// ─── TypeScript Types ─────────────────────────────────────────────────────────

export type GroupMemberRole = 'ADMIN' | 'MEMBER';
export type SplitType = 'EQUAL' | 'EXACT' | 'PERCENTAGE' | 'SHARES';
export type SettlementStatus = 'PENDING' | 'PAID';

export interface User {
  userId: string;
  email: string;
  name: string;
  avatarUrl?: string;
  createdAt: string;
}

export interface Group {
  groupId: string;
  name: string;
  currency: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  description?: string;
}

export interface GroupMember {
  groupId: string;
  userId: string;
  role: GroupMemberRole;
  joinedAt: string;
  name?: string;
  email?: string;
}

export interface Transaction {
  txnId: string;
  groupId: string;
  description: string;
  amount: number;
  currency: string;
  paidBy: string;
  splitType: SplitType;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  notes?: string;
}

export interface SplitInput {
  userId: string;
  amount?: number;
  percentage?: number;
  shares?: number;
}

export interface Split {
  txnId: string;
  userId: string;
  groupId: string;
  owedAmount: number;
  settled: boolean;
  settledAt?: string;
}

export interface Settlement {
  settlementId: string;
  groupId: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  currency: string;
  status: SettlementStatus;
  calculatedAt: string;
  paidAt?: string;
  paidBy?: string;
}

export interface CreateGroupInput {
  name: string;
  currency: string;
  description?: string;
}

export interface UpdateGroupInput {
  name?: string;
  currency?: string;
  description?: string;
}

export interface CreateTransactionInput {
  description: string;
  amount: number;
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

// ─── API Error ────────────────────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ─── HTTP Client ──────────────────────────────────────────────────────────────

async function request<T>(
  path: string,
  options: RequestInit = {},
  retried = false
): Promise<T> {
  const token = await getAccessToken();

  console.log(`Making API request to ${path} with token:`, token ? '***' : 'null');

  if (!token) {
    throw new ApiError(401, 'Not authenticated');
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
  });

  // Handle 401 - try token refresh once
  if (response.status === 401 && !retried) {
    const refreshed = await refreshTokens();
    if (refreshed) {
      return request<T>(path, options, true);
    }
    throw new ApiError(401, 'Session expired. Please sign in again.');
  }

  if (!response.ok) {
    let errorBody: { message?: string; code?: string } = {};
    try {
      errorBody = await response.json();
    } catch {
      // ignore parse error
    }
    throw new ApiError(
      response.status,
      errorBody.message || `Request failed with status ${response.status}`,
      errorBody.code
    );
  }

  // Handle 204 No Content
  if (response.status === 204) {
    return undefined as unknown as T;
  }

  return response.json() as Promise<T>;
}

function get<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'GET' });
}

function post<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

function put<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

function del<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'DELETE' });
}

// ─── Groups ───────────────────────────────────────────────────────────────────

export const groupsApi = {
  list: (): Promise<Group[]> => get<Group[]>('/groups'),

  get: (groupId: string): Promise<Group> => get<Group>(`/groups/${groupId}`),

  create: (input: CreateGroupInput): Promise<Group> => post<Group>('/groups', input),

  update: (groupId: string, input: UpdateGroupInput): Promise<Group> =>
    put<Group>(`/groups/${groupId}`, input),

  delete: (groupId: string): Promise<void> => del<void>(`/groups/${groupId}`),

  addMember: (groupId: string, userIdOrEmail: string): Promise<GroupMember> =>
    post<GroupMember>(`/groups/${groupId}/members`, { userId: userIdOrEmail }),

  removeMember: (groupId: string, userId: string): Promise<void> =>
    del<void>(`/groups/${groupId}/members/${userId}`),

  getMembers: (groupId: string): Promise<GroupMember[]> =>
    get<GroupMember[]>(`/groups/${groupId}/members`),
};

// ─── Transactions ─────────────────────────────────────────────────────────────

export const transactionsApi = {
  list: (groupId: string): Promise<Transaction[]> =>
    get<Transaction[]>(`/groups/${groupId}/transactions`),

  get: (groupId: string, txnId: string): Promise<Transaction> =>
    get<Transaction>(`/groups/${groupId}/transactions/${txnId}`),

  create: (groupId: string, input: CreateTransactionInput): Promise<Transaction> =>
    post<Transaction>(`/groups/${groupId}/transactions`, input),

  update: (groupId: string, txnId: string, input: UpdateTransactionInput): Promise<Transaction> =>
    put<Transaction>(`/groups/${groupId}/transactions/${txnId}`, input),

  delete: (groupId: string, txnId: string): Promise<void> =>
    del<void>(`/groups/${groupId}/transactions/${txnId}`),
};

// ─── Settlements ──────────────────────────────────────────────────────────────

export const settlementsApi = {
  list: (groupId: string, status?: SettlementStatus): Promise<Settlement[]> => {
    const query = status ? `?status=${status}` : '';
    return get<Settlement[]>(`/groups/${groupId}/settlements${query}`);
  },

  get: (groupId: string, settlementId: string): Promise<Settlement> =>
    get<Settlement>(`/groups/${groupId}/settlements/${settlementId}`),

  markAsPaid: (groupId: string, settlementId: string): Promise<Settlement> =>
    post<Settlement>(`/groups/${groupId}/settlements/${settlementId}/pay`, {}),
};
