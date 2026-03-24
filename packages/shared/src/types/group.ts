export type GroupMemberRole = 'ADMIN' | 'MEMBER';

export interface Group {
  groupId: string;
  name: string;
  currency: string; // ISO 4217 default currency for the group
  createdBy: string; // userId
  createdAt: string; // ISO 8601
  updatedAt: string;
  description?: string;
}

export interface GroupMember {
  groupId: string;
  userId: string;
  role: GroupMemberRole;
  joinedAt: string; // ISO 8601
  name?: string;
  email?: string;
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
