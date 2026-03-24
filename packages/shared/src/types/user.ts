export interface User {
  userId: string;
  email: string;
  name: string;
  avatarUrl?: string;
  createdAt: string; // ISO 8601
}

export interface UpdateUserInput {
  name?: string;
  avatarUrl?: string;
}
