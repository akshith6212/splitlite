import {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import {
  GetCommand,
  QueryCommand,
  TransactWriteCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { docClient, TABLE_NAME } from '@splitlite/shared';
import { Keys, SKPrefix } from '@splitlite/shared';
import {
  ok,
  created,
  noContent,
  notFound,
  forbidden,
  badRequest,
  internalError,
} from '@splitlite/shared';
import {
  Transaction,
  Split,
  SplitType,
  CreateTransactionInput,
  UpdateTransactionInput,
  SplitInput,
} from '@splitlite/shared';

// ---------------------------------------------------------------------------
// Entry point — routes by HTTP method + path
// ---------------------------------------------------------------------------

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  try {
    const method = event.requestContext.http.method;
    const { groupId, txnId } = event.pathParameters ?? {};

    if (!groupId) return badRequest('groupId is required');

    const callerId = getCallerId(event);

    // Guard: caller must be a group member for every operation
    const isMember = await assertGroupMember(groupId, callerId);
    if (!isMember) return forbidden('You are not a member of this group');

    if (method === 'POST' && !txnId) {
      const body = parseBody<CreateTransactionInput>(event.body);
      if (!body) return badRequest('Invalid request body');
      return createTransaction(groupId, callerId, body);
    }

    if (method === 'GET' && !txnId) {
      return listTransactions(groupId);
    }

    if (method === 'GET' && txnId) {
      return getTransaction(groupId, txnId);
    }

    if (method === 'PUT' && txnId) {
      const body = parseBody<UpdateTransactionInput>(event.body);
      if (!body) return badRequest('Invalid request body');
      return updateTransaction(groupId, txnId, callerId, body);
    }

    if (method === 'DELETE' && txnId) {
      return deleteTransaction(groupId, txnId, callerId);
    }

    return badRequest('Unknown route');
  } catch (err) {
    console.error('TransactionsHandler error', err);
    return internalError();
  }
};

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

async function createTransaction(
  groupId: string,
  callerId: string,
  input: CreateTransactionInput
): Promise<APIGatewayProxyResultV2> {
  const validationError = validateCreateInput(input);
  if (validationError) return badRequest(validationError);

  const txnId = uuidv4();
  const now = new Date().toISOString();
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-'); // safe for SK sort

  const computedSplits = computeSplits(input.amount, input.splitType, input.splits, txnId, groupId);

  const txnItem = {
    ...Keys.transaction(groupId, timestamp, txnId),
    txnId,
    groupId,
    description: input.description,
    amount: input.amount,
    currency: input.currency,
    paidBy: input.paidBy,
    splitType: input.splitType,
    notes: input.notes,
    createdAt: now,
    updatedAt: now,
    createdBy: callerId,
    _entityType: 'TRANSACTION',
  };

  // Atomic write: transaction item + all split items in a single TransactWrite
  // DynamoDB TransactWriteItems limit is 100 items; chunk if splits exceed 99
  const splitPuts = computedSplits.map((s) => ({
    Put: {
      TableName: TABLE_NAME,
      Item: {
        ...Keys.split(txnId, s.userId),
        txnId: s.txnId,
        userId: s.userId,
        groupId: s.groupId,
        owedAmount: s.owedAmount,
        settled: false,
        _entityType: 'SPLIT',
      },
    },
  }));

  await docClient.send(
    new TransactWriteCommand({
      TransactItems: [
        { Put: { TableName: TABLE_NAME, Item: txnItem } },
        ...splitPuts,
      ],
    })
  );

  const transaction: Transaction = {
    txnId,
    groupId,
    description: input.description,
    amount: input.amount,
    currency: input.currency,
    paidBy: input.paidBy,
    splitType: input.splitType,
    notes: input.notes,
    createdAt: now,
    updatedAt: now,
    createdBy: callerId,
  };

  return created({ transaction, splits: computedSplits });
}

async function listTransactions(groupId: string): Promise<APIGatewayProxyResultV2> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `GROUP#${groupId}`,
        ':prefix': SKPrefix.transactions,
      },
    })
  );

  const transactions = (result.Items ?? []).map(itemToTransaction);
  return ok({ transactions });
}

async function getTransaction(
  groupId: string,
  txnId: string
): Promise<APIGatewayProxyResultV2> {
  // We need to find the transaction SK (includes timestamp) — query by groupId + txnId suffix
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      FilterExpression: 'txnId = :txnId',
      ExpressionAttributeValues: {
        ':pk': `GROUP#${groupId}`,
        ':prefix': SKPrefix.transactions,
        ':txnId': txnId,
      },
    })
  );

  if (!result.Items?.length) return notFound('Transaction not found');

  // Also fetch splits
  const splitsResult = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `TXN#${txnId}`,
        ':prefix': SKPrefix.splits,
      },
    })
  );

  return ok({
    transaction: itemToTransaction(result.Items[0]),
    splits: (splitsResult.Items ?? []).map(itemToSplit),
  });
}

async function updateTransaction(
  groupId: string,
  txnId: string,
  callerId: string,
  input: UpdateTransactionInput
): Promise<APIGatewayProxyResultV2> {
  // Fetch existing transaction
  const existing = await findTransactionItem(groupId, txnId);
  if (!existing) return notFound('Transaction not found');

  if (existing.createdBy !== callerId) {
    return forbidden('Only the transaction creator can update it');
  }

  const now = new Date().toISOString();

  // Build updated transaction item (reuse existing SK which contains the original timestamp)
  const updatedItem = {
    ...existing,
    description: input.description ?? existing.description,
    amount: input.amount ?? existing.amount,
    paidBy: input.paidBy ?? existing.paidBy,
    splitType: input.splitType ?? existing.splitType,
    notes: input.notes !== undefined ? input.notes : existing.notes,
    updatedAt: now,
  };

  // If splits or amount changed, recompute splits
  if (input.splits || input.amount) {
    const newAmount = input.amount ?? existing.amount;
    const newSplitType: SplitType = input.splitType ?? existing.splitType;
    const newSplitInputs: SplitInput[] = input.splits ?? [];

    const computedSplits = computeSplits(newAmount, newSplitType, newSplitInputs, txnId, groupId);

    // Fetch old splits to delete them
    const oldSplitsResult = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        ExpressionAttributeValues: {
          ':pk': `TXN#${txnId}`,
          ':prefix': SKPrefix.splits,
        },
      })
    );

    const oldSplitDeletes = (oldSplitsResult.Items ?? []).map((item) => ({
      Delete: {
        TableName: TABLE_NAME,
        Key: { PK: item.PK, SK: item.SK },
      },
    }));

    const newSplitPuts = computedSplits.map((s) => ({
      Put: {
        TableName: TABLE_NAME,
        Item: {
          ...Keys.split(txnId, s.userId),
          txnId: s.txnId,
          userId: s.userId,
          groupId: s.groupId,
          owedAmount: s.owedAmount,
          settled: false,
          _entityType: 'SPLIT',
        },
      },
    }));

    await docClient.send(
      new TransactWriteCommand({
        TransactItems: [
          { Put: { TableName: TABLE_NAME, Item: updatedItem } },
          ...oldSplitDeletes,
          ...newSplitPuts,
        ],
      })
    );
  } else {
    // No split changes — update transaction item only
    await docClient.send(
      new TransactWriteCommand({
        TransactItems: [{ Put: { TableName: TABLE_NAME, Item: updatedItem } }],
      })
    );
  }

  return ok({ transaction: itemToTransaction(updatedItem) });
}

async function deleteTransaction(
  groupId: string,
  txnId: string,
  callerId: string
): Promise<APIGatewayProxyResultV2> {
  const existing = await findTransactionItem(groupId, txnId);
  if (!existing) return notFound('Transaction not found');

  if (existing.createdBy !== callerId) {
    return forbidden('Only the transaction creator can delete it');
  }

  // Fetch all split items to delete
  const splitsResult = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `TXN#${txnId}`,
        ':prefix': SKPrefix.splits,
      },
    })
  );

  const splitKeys = (splitsResult.Items ?? []).map((item) => ({
    DeleteRequest: { Key: { PK: item.PK, SK: item.SK } },
  }));

  // Delete transaction + all splits (batch, not transactional — acceptable for deletes)
  const allDeletes = [
    { DeleteRequest: { Key: { PK: existing.PK, SK: existing.SK } } },
    ...splitKeys,
  ];

  // BatchWriteItem limit is 25 per call — chunk accordingly
  for (let i = 0; i < allDeletes.length; i += 25) {
    await docClient.send(
      new BatchWriteCommand({
        RequestItems: {
          [TABLE_NAME]: allDeletes.slice(i, i + 25),
        },
      })
    );
  }

  return noContent();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCallerId(event: APIGatewayProxyEventV2WithJWTAuthorizer): string {
  return event.requestContext.authorizer.jwt.claims.sub as string;
}

function parseBody<T>(body: string | null | undefined): T | null {
  if (!body) return null;
  try {
    return JSON.parse(body) as T;
  } catch {
    return null;
  }
}

async function assertGroupMember(groupId: string, userId: string): Promise<boolean> {
  const result = await docClient.send(
    new GetCommand({
      TableName: TABLE_NAME,
      Key: Keys.groupMember(groupId, userId),
    })
  );
  return !!result.Item;
}

async function findTransactionItem(groupId: string, txnId: string) {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      FilterExpression: 'txnId = :txnId',
      ExpressionAttributeValues: {
        ':pk': `GROUP#${groupId}`,
        ':prefix': SKPrefix.transactions,
        ':txnId': txnId,
      },
    })
  );
  return result.Items?.[0] ?? null;
}

function validateCreateInput(input: CreateTransactionInput): string | null {
  if (!input.description?.trim()) return 'description is required';
  if (!input.amount || input.amount <= 0) return 'amount must be a positive integer (cents)';
  if (!input.currency) return 'currency is required';
  if (!input.paidBy) return 'paidBy is required';
  if (!input.splitType) return 'splitType is required';
  if (!input.splits?.length) return 'splits array is required';
  return null;
}

/**
 * Compute per-user owed amounts from the split inputs.
 * All amounts are in cents (integers). Rounding remainder distributed
 * 1 cent at a time to maintain total equality.
 */
function computeSplits(
  totalAmount: number,
  splitType: SplitType,
  splitInputs: SplitInput[],
  txnId: string,
  groupId: string
): Split[] {
  const n = splitInputs.length;

  switch (splitType) {
    case 'EQUAL': {
      const base = Math.floor(totalAmount / n);
      const remainder = totalAmount - base * n;
      return splitInputs.map((s, i) => ({
        txnId,
        groupId,
        userId: s.userId,
        owedAmount: base + (i < remainder ? 1 : 0),
        settled: false,
      }));
    }

    case 'EXACT': {
      const total = splitInputs.reduce((sum, s) => sum + (s.amount ?? 0), 0);
      if (total !== totalAmount) {
        throw new Error(`Exact splits sum (${total}) must equal transaction amount (${totalAmount})`);
      }
      return splitInputs.map((s) => ({
        txnId,
        groupId,
        userId: s.userId,
        owedAmount: s.amount ?? 0,
        settled: false,
      }));
    }

    case 'PERCENTAGE': {
      const totalPct = splitInputs.reduce((sum, s) => sum + (s.percentage ?? 0), 0);
      if (Math.abs(totalPct - 100) > 0.01) {
        throw new Error(`Percentages must sum to 100, got ${totalPct}`);
      }
      const rawAmounts = splitInputs.map((s) =>
        Math.floor(totalAmount * ((s.percentage ?? 0) / 100))
      );
      const distributed = rawAmounts.reduce((a, b) => a + b, 0);
      const leftover = totalAmount - distributed;
      return splitInputs.map((s, i) => ({
        txnId,
        groupId,
        userId: s.userId,
        owedAmount: rawAmounts[i] + (i < leftover ? 1 : 0),
        settled: false,
      }));
    }

    case 'SHARES': {
      const totalShares = splitInputs.reduce((sum, s) => sum + (s.shares ?? 0), 0);
      if (totalShares === 0) throw new Error('Total shares must be greater than 0');
      const rawAmounts = splitInputs.map((s) =>
        Math.floor((totalAmount * (s.shares ?? 0)) / totalShares)
      );
      const distributed = rawAmounts.reduce((a, b) => a + b, 0);
      const leftover = totalAmount - distributed;
      return splitInputs.map((s, i) => ({
        txnId,
        groupId,
        userId: s.userId,
        owedAmount: rawAmounts[i] + (i < leftover ? 1 : 0),
        settled: false,
      }));
    }
  }
}

function itemToTransaction(item: Record<string, unknown>): Transaction {
  return {
    txnId: item.txnId as string,
    groupId: item.groupId as string,
    description: item.description as string,
    amount: item.amount as number,
    currency: item.currency as string,
    paidBy: item.paidBy as string,
    splitType: item.splitType as SplitType,
    createdAt: item.createdAt as string,
    updatedAt: item.updatedAt as string,
    createdBy: item.createdBy as string,
    notes: item.notes as string | undefined,
  };
}

function itemToSplit(item: Record<string, unknown>): Split {
  return {
    txnId: item.txnId as string,
    groupId: item.groupId as string,
    userId: item.userId as string,
    owedAmount: item.owedAmount as number,
    settled: item.settled as boolean,
    settledAt: item.settledAt as string | undefined,
  };
}
