import { DynamoDBStreamEvent, DynamoDBRecord } from 'aws-lambda';
import { QueryCommand, BatchWriteCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { AttributeValue } from '@aws-sdk/client-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { docClient, TABLE_NAME } from '@splitlite/shared';
import { SKPrefix } from '@splitlite/shared';
import { simplifyDebts, computeNetBalances } from './debtSimplification';

// ---------------------------------------------------------------------------
// Entry point — triggered by DynamoDB Streams
// ---------------------------------------------------------------------------

export const handler = async (event: DynamoDBStreamEvent): Promise<void> => {
  // Extract unique groupIds affected by this batch of stream records
  const groupIds = extractAffectedGroupIds(event.Records);
  if (groupIds.size === 0) return;

  // Process each group independently — failures in one group don't block others
  await Promise.allSettled(
    Array.from(groupIds).map((groupId) => recalculateSettlements(groupId))
  );
};

// ---------------------------------------------------------------------------
// Core recalculation logic
// ---------------------------------------------------------------------------

async function recalculateSettlements(groupId: string): Promise<void> {
  console.log(`Recalculating settlements for group ${groupId}`);

  // Step 1: Fetch all transactions for the group
  const transactions = await fetchTransactionsForGroup(groupId);
  if (!transactions.length) return;

  // Step 2: Fetch all splits for every transaction in the group
  const allSplits = await fetchAllSplitsForGroup(transactions.map((t) => t.txnId));

  // Step 3: Build paidBy map and compute net balances
  const paidByMap = new Map(
    transactions.map((t) => [t.txnId, { paidBy: t.paidBy, amount: t.amount }])
  );
  const netBalances = computeNetBalances(allSplits, paidByMap);

  // Step 4: Run the debt simplification algorithm
  const instructions = simplifyDebts(netBalances);

  // Step 5: Fetch existing PENDING settlements to delete them
  const existingPending = await fetchPendingSettlements(groupId);

  // Step 6: Replace PENDING settlements with freshly calculated ones
  // PAID settlements are never touched — they are permanent records
  await replaceSettlements(groupId, existingPending, instructions, transactions[0].currency);

  console.log(`Group ${groupId}: wrote ${instructions.length} settlement(s)`);
}

// ---------------------------------------------------------------------------
// Stream record processing
// ---------------------------------------------------------------------------

/**
 * Extract groupIds from stream records.
 * Only processes INSERT/MODIFY/REMOVE on:
 *   - TXN# items: PK=GROUP#groupId, SK=TXN#...
 *   - SPLIT# items: PK=TXN#txnId, SK=SPLIT#... (groupId stored as attribute)
 *
 * Skips SETTLE# writes to prevent infinite recalculation loops.
 */
function extractAffectedGroupIds(records: DynamoDBRecord[]): Set<string> {
  const groupIds = new Set<string>();

  for (const record of records) {
    if (!record.dynamodb?.Keys) continue;

    const pk = record.dynamodb.Keys.PK?.S ?? '';
    const sk = record.dynamodb.Keys.SK?.S ?? '';

    // TXN item written by TransactionsHandler: PK=GROUP#groupId, SK=TXN#...
    if (pk.startsWith('GROUP#') && sk.startsWith('TXN#')) {
      groupIds.add(pk.replace('GROUP#', ''));
      continue;
    }

    // SPLIT item: PK=TXN#txnId — extract groupId from the item's attributes
    if (pk.startsWith('TXN#') && sk.startsWith('SPLIT#')) {
      const image = record.dynamodb.NewImage ?? record.dynamodb.OldImage;
      if (image) {
        const item = unmarshall(image as Record<string, AttributeValue>);
        if (item.groupId) groupIds.add(item.groupId as string);
      }
    }
  }

  return groupIds;
}

// ---------------------------------------------------------------------------
// DynamoDB queries
// ---------------------------------------------------------------------------

async function fetchTransactionsForGroup(
  groupId: string
): Promise<Array<{ txnId: string; paidBy: string; amount: number; currency: string }>> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `GROUP#${groupId}`,
        ':prefix': SKPrefix.transactions,
      },
      ProjectionExpression: 'txnId, paidBy, amount, currency',
    })
  );

  return (result.Items ?? []) as Array<{
    txnId: string;
    paidBy: string;
    amount: number;
    currency: string;
  }>;
}

async function fetchAllSplitsForGroup(
  txnIds: string[]
): Promise<Array<{ txnId: string; userId: string; owedAmount: number }>> {
  if (!txnIds.length) return [];

  // Query splits for each transaction in parallel (no cross-entity query possible in single-table)
  const results = await Promise.all(
    txnIds.map((txnId) =>
      docClient.send(
        new QueryCommand({
          TableName: TABLE_NAME,
          KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
          ExpressionAttributeValues: {
            ':pk': `TXN#${txnId}`,
            ':prefix': SKPrefix.splits,
          },
          ProjectionExpression: 'txnId, userId, owedAmount',
        })
      )
    )
  );

  return results.flatMap(
    (r) =>
      (r.Items ?? []) as Array<{ txnId: string; userId: string; owedAmount: number }>
  );
}

async function fetchPendingSettlements(
  groupId: string
): Promise<Array<{ PK: string; SK: string }>> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      FilterExpression: '#status = :pending',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':pk': `GROUP#${groupId}`,
        ':prefix': SKPrefix.settlements,
        ':pending': 'PENDING',
      },
      ProjectionExpression: 'PK, SK',
    })
  );

  return (result.Items ?? []) as Array<{ PK: string; SK: string }>;
}

// ---------------------------------------------------------------------------
// Settlement replacement
// ---------------------------------------------------------------------------

/**
 * Atomically delete all PENDING settlements and write the new ones.
 * PAID settlements are never touched.
 *
 * Uses TransactWriteItems (max 100 items). For groups with more than ~50
 * members, falls back to sequential BatchWrite operations.
 */
async function replaceSettlements(
  groupId: string,
  toDelete: Array<{ PK: string; SK: string }>,
  instructions: ReturnType<typeof simplifyDebts>,
  currency: string
): Promise<void> {
  const now = new Date().toISOString();
  const timestamp = now.replace(/[:.]/g, '-');

  const newSettlementItems = instructions.map((inst) => {
    const settlementId = uuidv4();
    return {
      PK: `GROUP#${groupId}`,
      SK: `SETTLE#${timestamp}#${settlementId}`,
      settlementId,
      groupId,
      fromUserId: inst.fromUserId,
      toUserId: inst.toUserId,
      amount: inst.amount,
      currency,
      status: 'PENDING',
      calculatedAt: now,
      _entityType: 'SETTLEMENT',
    };
  });

  const totalItems = toDelete.length + newSettlementItems.length;

  if (totalItems <= 100) {
    // Single atomic transaction
    await docClient.send(
      new TransactWriteCommand({
        TransactItems: [
          ...toDelete.map((key) => ({
            Delete: { TableName: TABLE_NAME, Key: { PK: key.PK, SK: key.SK } },
          })),
          ...newSettlementItems.map((item) => ({
            Put: { TableName: TABLE_NAME, Item: item },
          })),
        ],
      })
    );
  } else {
    // Chunked batch operations for large groups
    const deleteChunks = chunk(
      toDelete.map((key) => ({
        DeleteRequest: { Key: { PK: key.PK, SK: key.SK } },
      })),
      25
    );
    const putChunks = chunk(
      newSettlementItems.map((item) => ({ PutRequest: { Item: item } })),
      25
    );

    for (const c of [...deleteChunks, ...putChunks]) {
      await docClient.send(
        new BatchWriteCommand({ RequestItems: { [TABLE_NAME]: c } })
      );
    }
  }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
