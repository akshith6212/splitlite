/**
 * Centralized DynamoDB key builders for the SplitLite single-table design.
 * All Lambdas must use these functions — never construct PK/SK strings inline.
 *
 * Table access patterns:
 *   Transaction  PK=GROUP#groupId   SK=TXN#timestamp#txnId
 *   Split        PK=TXN#txnId       SK=SPLIT#userId
 *   Settlement   PK=GROUP#groupId   SK=SETTLE#timestamp#settlementId
 *   Group        PK=GROUP#groupId   SK=METADATA
 *   GroupMember  PK=GROUP#groupId   SK=MEMBER#userId
 *   User         PK=USER#userId     SK=PROFILE
 *   UserGroup    PK=USER#userId     SK=GROUP#groupId
 */

export const Keys = {
  transaction: (groupId: string, timestamp: string, txnId: string) => ({
    PK: `GROUP#${groupId}`,
    SK: `TXN#${timestamp}#${txnId}`,
  }),

  split: (txnId: string, userId: string) => ({
    PK: `TXN#${txnId}`,
    SK: `SPLIT#${userId}`,
  }),

  settlement: (groupId: string, timestamp: string, settlementId: string) => ({
    PK: `GROUP#${groupId}`,
    SK: `SETTLE#${timestamp}#${settlementId}`,
  }),

  group: (groupId: string) => ({
    PK: `GROUP#${groupId}`,
    SK: 'METADATA',
  }),

  groupMember: (groupId: string, userId: string) => ({
    PK: `GROUP#${groupId}`,
    SK: `MEMBER#${userId}`,
  }),

  user: (userId: string) => ({
    PK: `USER#${userId}`,
    SK: 'PROFILE',
  }),

  userGroup: (userId: string, groupId: string) => ({
    PK: `USER#${userId}`,
    SK: `GROUP#${groupId}`,
  }),

  // Secondary lookup: find userId by email (written when user profile is created)
  userEmailLookup: (email: string) => ({
    PK: `USER_EMAIL#${email.toLowerCase()}`,
    SK: 'LOOKUP',
  }),
} as const;

/** SK prefix constants for begins_with queries */
export const SKPrefix = {
  transactions: 'TXN#',
  settlements: 'SETTLE#',
  splits: 'SPLIT#',
  members: 'MEMBER#',
  groups: 'GROUP#',
} as const;

/** Extract groupId from a GROUP#groupId PK */
export const parseGroupId = (pk: string): string => pk.replace('GROUP#', '');

/** Extract txnId from a TXN#txnId PK */
export const parseTxnId = (pk: string): string => pk.replace('TXN#', '');

/** Extract userId from a SPLIT#userId SK */
export const parseUserId = (sk: string, prefix: string): string =>
  sk.replace(prefix, '');
