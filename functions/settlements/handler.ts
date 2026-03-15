import {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { GetCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '@splitlite/shared';
import { Keys, SKPrefix } from '@splitlite/shared';
import {
  ok,
  notFound,
  forbidden,
  badRequest,
  conflict,
  internalError,
} from '@splitlite/shared';
import { Settlement, SettlementStatus } from '@splitlite/shared';

// ---------------------------------------------------------------------------
// Entry point — routes by HTTP method + path
// ---------------------------------------------------------------------------

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  try {
    const method = event.requestContext.http.method;
    const { groupId, settlementId } = event.pathParameters ?? {};
    const pathSuffix = event.rawPath.endsWith('/pay');

    if (!groupId) return badRequest('groupId is required');

    const callerId = getCallerId(event);

    // Guard: caller must be a group member
    const isMember = await assertGroupMember(groupId, callerId);
    if (!isMember) return forbidden('You are not a member of this group');

    if (method === 'GET' && !settlementId) {
      const status = (event.queryStringParameters?.status as SettlementStatus) ?? 'PENDING';
      return listSettlements(groupId, status);
    }

    if (method === 'GET' && settlementId) {
      return getSettlement(groupId, settlementId);
    }

    if (method === 'POST' && settlementId && pathSuffix) {
      return markAsPaid(groupId, settlementId, callerId);
    }

    return badRequest('Unknown route');
  } catch (err) {
    console.error('SettlementsHandler error', err);
    return internalError();
  }
};

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

async function listSettlements(
  groupId: string,
  statusFilter: SettlementStatus
): Promise<APIGatewayProxyResultV2> {
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      FilterExpression: '#status = :status',
      ExpressionAttributeNames: { '#status': 'status' },
      ExpressionAttributeValues: {
        ':pk': `GROUP#${groupId}`,
        ':prefix': SKPrefix.settlements,
        ':status': statusFilter,
      },
    })
  );

  const settlements = (result.Items ?? []).map(itemToSettlement);
  return ok({ settlements });
}

async function getSettlement(
  groupId: string,
  settlementId: string
): Promise<APIGatewayProxyResultV2> {
  const item = await findSettlementItem(groupId, settlementId);
  if (!item) return notFound('Settlement not found');
  return ok({ settlement: itemToSettlement(item) });
}

/**
 * Mark a settlement as PAID.
 *
 * Business rules:
 * - Settlement must be in PENDING status (conditional update — prevents double-pay race condition)
 * - Caller must be either the debtor (fromUserId) or creditor (toUserId)
 */
async function markAsPaid(
  groupId: string,
  settlementId: string,
  callerId: string
): Promise<APIGatewayProxyResultV2> {
  const existing = await findSettlementItem(groupId, settlementId);
  if (!existing) return notFound('Settlement not found');

  // Authorization: only the involved parties can mark it paid
  if (existing.fromUserId !== callerId && existing.toUserId !== callerId) {
    return forbidden('Only the debtor or creditor can mark this settlement as paid');
  }

  if (existing.status === 'PAID') {
    return conflict('Settlement is already marked as paid');
  }

  const now = new Date().toISOString();

  try {
    const result = await docClient.send(
      new UpdateCommand({
        TableName: TABLE_NAME,
        Key: { PK: existing.PK, SK: existing.SK },
        UpdateExpression: 'SET #status = :paid, paidAt = :now, paidBy = :callerId',
        // Conditional: only succeeds if still PENDING — prevents race conditions
        ConditionExpression: '#status = :pending',
        ExpressionAttributeNames: { '#status': 'status' },
        ExpressionAttributeValues: {
          ':paid': 'PAID',
          ':pending': 'PENDING',
          ':now': now,
          ':callerId': callerId,
        },
        ReturnValues: 'ALL_NEW',
      })
    );

    return ok({ settlement: itemToSettlement(result.Attributes as Record<string, unknown>) });
  } catch (err: unknown) {
    if (isConditionalCheckFailed(err)) {
      return conflict('Settlement was already marked as paid by another request');
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getCallerId(event: APIGatewayProxyEventV2WithJWTAuthorizer): string {
  return event.requestContext.authorizer.jwt.claims.sub as string;
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

async function findSettlementItem(
  groupId: string,
  settlementId: string
): Promise<Record<string, unknown> | null> {
  // Settlements are keyed by GROUP#groupId / SETTLE#timestamp#settlementId
  // We query by groupId + filter by settlementId attribute
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      FilterExpression: 'settlementId = :settlementId',
      ExpressionAttributeValues: {
        ':pk': `GROUP#${groupId}`,
        ':prefix': SKPrefix.settlements,
        ':settlementId': settlementId,
      },
    })
  );
  return (result.Items?.[0] as Record<string, unknown>) ?? null;
}

function itemToSettlement(item: Record<string, unknown>): Settlement {
  return {
    settlementId: item.settlementId as string,
    groupId: item.groupId as string,
    fromUserId: item.fromUserId as string,
    toUserId: item.toUserId as string,
    amount: item.amount as number,
    currency: item.currency as string,
    status: item.status as SettlementStatus,
    calculatedAt: item.calculatedAt as string,
    paidAt: item.paidAt as string | undefined,
    paidBy: item.paidBy as string | undefined,
  };
}

function isConditionalCheckFailed(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'name' in err &&
    (err as { name: string }).name === 'ConditionalCheckFailedException'
  );
}
