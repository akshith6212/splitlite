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

// ─── Users ────────────────────────────────────────────────────────────────────

export const usersApi = {
  /** Fetches current user profile; auto-provisions it on first login. */
  getMe: (): Promise<User> =>
    get<{ user: User }>('/users/me').then((r) => r.user),

  updateMe: (input: { name?: string; avatarUrl?: string }): Promise<User> =>
    put<{ user: User }>('/users/me', input).then((r) => r.user),
};

// ─── Groups ───────────────────────────────────────────────────────────────────

export const groupsApi = {
  list: (): Promise<Group[]> =>
    get<{ groups: Group[] }>('/groups').then((r) => r.groups),

  get: (groupId: string): Promise<Group> =>
    get<{ group: Group }>(`/groups/${groupId}`).then((r) => r.group),

  create: (input: CreateGroupInput): Promise<Group> =>
    post<{ group: Group }>('/groups', input).then((r) => r.group),

  update: (groupId: string, input: UpdateGroupInput): Promise<Group> =>
    put<{ group: Group }>(`/groups/${groupId}`, input).then((r) => r.group),

  delete: (groupId: string): Promise<void> => del<void>(`/groups/${groupId}`),

  addMember: (groupId: string, userIdOrEmail: string): Promise<GroupMember> =>
    post<{ member: GroupMember }>(`/groups/${groupId}/members`, { userId: userIdOrEmail }).then(
      (r) => r.member
    ),

  removeMember: (groupId: string, userId: string): Promise<void> =>
    del<void>(`/groups/${groupId}/members/${userId}`),

  getMembers: (groupId: string): Promise<GroupMember[]> =>
    get<{ members: GroupMember[] }>(`/groups/${groupId}/members`).then((r) => r.members),
};

// ─── Transactions ─────────────────────────────────────────────────────────────

export const transactionsApi = {
  list: (groupId: string): Promise<Transaction[]> =>
    get<{ transactions: Transaction[] }>(`/groups/${groupId}/transactions`).then(
      (r) => r.transactions
    ),

  get: (groupId: string, txnId: string): Promise<Transaction> =>
    get<{ transaction: Transaction }>(`/groups/${groupId}/transactions/${txnId}`).then(
      (r) => r.transaction
    ),

  create: (groupId: string, input: CreateTransactionInput): Promise<Transaction> =>
    post<{ transaction: Transaction }>(`/groups/${groupId}/transactions`, input).then(
      (r) => r.transaction
    ),

  update: (groupId: string, txnId: string, input: UpdateTransactionInput): Promise<Transaction> =>
    put<{ transaction: Transaction }>(`/groups/${groupId}/transactions/${txnId}`, input).then(
      (r) => r.transaction
    ),

  delete: (groupId: string, txnId: string): Promise<void> =>
    del<void>(`/groups/${groupId}/transactions/${txnId}`),
};

// ─── Settlements ──────────────────────────────────────────────────────────────

export const settlementsApi = {
  list: (groupId: string, status?: SettlementStatus): Promise<Settlement[]> => {
    const query = status ? `?status=${status}` : '';
    return get<{ settlements: Settlement[] }>(`/groups/${groupId}/settlements${query}`).then(
      (r) => r.settlements
    );
  },

  get: (groupId: string, settlementId: string): Promise<Settlement> =>
    get<{ settlement: Settlement }>(`/groups/${groupId}/settlements/${settlementId}`).then(
      (r) => r.settlement
    ),

  markAsPaid: (groupId: string, settlementId: string): Promise<Settlement> =>
    post<{ settlement: Settlement }>(`/groups/${groupId}/settlements/${settlementId}/pay`, {}).then(
      (r) => r.settlement
    ),
};
