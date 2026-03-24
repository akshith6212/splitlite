import {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import {
  GetCommand,
  QueryCommand,
  PutCommand,
  DeleteCommand,
  TransactWriteCommand,
  BatchGetCommand,
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
  conflict,
  internalError,
} from '@splitlite/shared';
import {
  Group,
  GroupMember,
  GroupMemberRole,
  CreateGroupInput,
  UpdateGroupInput,
} from '@splitlite/shared';

// ---------------------------------------------------------------------------
// Entry point — routes by HTTP method + path
// ---------------------------------------------------------------------------

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  try {
    const method = event.requestContext.http.method;
    const { groupId, userId: memberUserId } = event.pathParameters ?? {};
    const rawPath = event.rawPath;

    const callerId = getCallerId(event);

    // ── /groups/{groupId}/members/{userId} ──────────────────────────────────
    if (groupId && memberUserId) {
      if (method === 'DELETE') return removeMember(groupId, memberUserId, callerId);
      return badRequest('Unknown route');
    }

    // ── /groups/{groupId}/members ────────────────────────────────────────────
    if (groupId && rawPath.endsWith('/members')) {
      const isMember = await assertGroupMember(groupId, callerId);
      if (!isMember) return forbidden('You are not a member of this group');

      if (method === 'GET') return listMembers(groupId);
      if (method === 'POST') {
        const body = parseBody<{ userId: string }>(event.body);
        if (!body?.userId) return badRequest('userId is required');
        return addMember(groupId, callerId, body.userId);
      }
      return badRequest('Unknown route');
    }

    // ── /groups/{groupId} ────────────────────────────────────────────────────
    if (groupId) {
      const isMember = await assertGroupMember(groupId, callerId);
      if (!isMember) return forbidden('You are not a member of this group');

      if (method === 'GET') return getGroup(groupId);
      if (method === 'PUT') {
        const body = parseBody<UpdateGroupInput>(event.body);
        if (!body) return badRequest('Invalid request body');
        return updateGroup(groupId, callerId, body);
      }
      if (method === 'DELETE') return deleteGroup(groupId, callerId);
      return badRequest('Unknown route');
    }

    // ── /groups ──────────────────────────────────────────────────────────────
    if (method === 'GET') return listGroups(callerId);
    if (method === 'POST') {
      const body = parseBody<CreateGroupInput>(event.body);
      if (!body) return badRequest('Invalid request body');
      return createGroup(callerId, body);
    }

    return badRequest('Unknown route');
  } catch (err) {
    console.error('GroupsHandler error', err);
    return internalError();
  }
};

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

async function listGroups(callerId: string): Promise<APIGatewayProxyResultV2> {
  // Query the reverse-lookup items: USER#userId / GROUP#* → gives groupIds
  const result = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `USER#${callerId}`,
        ':prefix': SKPrefix.groups,
      },
      ProjectionExpression: 'SK',
    })
  );

  const groupIds = (result.Items ?? []).map((item) =>
    (item.SK as string).replace('GROUP#', '')
  );

  if (!groupIds.length) return ok({ groups: [] });

  // Batch-get all group METADATA items
  const keys = groupIds.map((gId) => Keys.group(gId));
  const batchResult = await docClient.send(
    new BatchGetCommand({
      RequestItems: {
        [TABLE_NAME]: { Keys: keys },
      },
    })
  );

  const groups = ((batchResult.Responses?.[TABLE_NAME] ?? []) as Record<string, unknown>[])
    .map(itemToGroup)
    .sort((a, b) => a.name.localeCompare(b.name));

  return ok({ groups });
}

async function createGroup(
  callerId: string,
  input: CreateGroupInput
): Promise<APIGatewayProxyResultV2> {
  if (!input.name?.trim()) return badRequest('name is required');
  if (!input.currency?.trim()) return badRequest('currency is required');

  const groupId = uuidv4();
  const now = new Date().toISOString();

  const groupItem = {
    ...Keys.group(groupId),
    groupId,
    name: input.name.trim(),
    currency: input.currency.toUpperCase(),
    description: input.description?.trim(),
    createdBy: callerId,
    createdAt: now,
    updatedAt: now,
    _entityType: 'GROUP',
  };

  const memberItem = {
    ...Keys.groupMember(groupId, callerId),
    groupId,
    userId: callerId,
    role: 'ADMIN' as GroupMemberRole,
    joinedAt: now,
    _entityType: 'GROUP_MEMBER',
  };

  const userGroupItem = {
    ...Keys.userGroup(callerId, groupId),
    groupId,
    userId: callerId,
    _entityType: 'USER_GROUP',
  };

  // Atomic: group + creator's member record + reverse-lookup
  await docClient.send(
    new TransactWriteCommand({
      TransactItems: [
        { Put: { TableName: TABLE_NAME, Item: groupItem } },
        { Put: { TableName: TABLE_NAME, Item: memberItem } },
        { Put: { TableName: TABLE_NAME, Item: userGroupItem } },
      ],
    })
  );

  return created({ group: itemToGroup(groupItem) });
}

async function getGroup(groupId: string): Promise<APIGatewayProxyResultV2> {
  const result = await docClient.send(
    new GetCommand({ TableName: TABLE_NAME, Key: Keys.group(groupId) })
  );
  if (!result.Item) return notFound('Group not found');
  return ok({ group: itemToGroup(result.Item as Record<string, unknown>) });
}

async function updateGroup(
  groupId: string,
  callerId: string,
  input: UpdateGroupInput
): Promise<APIGatewayProxyResultV2> {
  const memberItem = await getGroupMember(groupId, callerId);
  if (memberItem?.role !== 'ADMIN') {
    return forbidden('Only group admins can update group details');
  }

  const existing = await docClient.send(
    new GetCommand({ TableName: TABLE_NAME, Key: Keys.group(groupId) })
  );
  if (!existing.Item) return notFound('Group not found');

  const now = new Date().toISOString();
  const updatedItem = {
    ...existing.Item,
    name: input.name?.trim() ?? existing.Item.name,
    currency: input.currency?.toUpperCase() ?? existing.Item.currency,
    description:
      input.description !== undefined ? input.description?.trim() : existing.Item.description,
    updatedAt: now,
  };

  await docClient.send(
    new PutCommand({ TableName: TABLE_NAME, Item: updatedItem })
  );

  return ok({ group: itemToGroup(updatedItem as Record<string, unknown>) });
}

async function deleteGroup(
  groupId: string,
  callerId: string
): Promise<APIGatewayProxyResultV2> {
  const memberItem = await getGroupMember(groupId, callerId);
  if (memberItem?.role !== 'ADMIN') {
    return forbidden('Only group admins can delete the group');
  }

  // Fetch all group members to clean up USER#userId/GROUP#groupId items
  const membersResult = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `GROUP#${groupId}`,
        ':prefix': SKPrefix.members,
      },
      ProjectionExpression: 'userId',
    })
  );

  const memberUserIds = (membersResult.Items ?? []).map((m) => m.userId as string);

  // Build delete requests: group metadata + all member records + all user-group lookups
  const deleteRequests = [
    { DeleteRequest: { Key: Keys.group(groupId) } },
    ...memberUserIds.map((uid) => ({
      DeleteRequest: { Key: Keys.groupMember(groupId, uid) },
    })),
    ...memberUserIds.map((uid) => ({
      DeleteRequest: { Key: Keys.userGroup(uid, groupId) },
    })),
  ];

  // BatchWriteItem limit: 25 per call
  for (let i = 0; i < deleteRequests.length; i += 25) {
    await docClient.send(
      new BatchWriteCommand({
        RequestItems: { [TABLE_NAME]: deleteRequests.slice(i, i + 25) },
      })
    );
  }

  return noContent();
}

async function listMembers(groupId: string): Promise<APIGatewayProxyResultV2> {
  // Query all MEMBER# items for the group
  const membersResult = await docClient.send(
    new QueryCommand({
      TableName: TABLE_NAME,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      ExpressionAttributeValues: {
        ':pk': `GROUP#${groupId}`,
        ':prefix': SKPrefix.members,
      },
    })
  );

  const memberItems = membersResult.Items ?? [];
  if (!memberItems.length) return ok({ members: [] });

  // Batch-get user profiles for name/email enrichment
  const userKeys = memberItems.map((m) => Keys.user(m.userId as string));
  const profilesResult = await docClient.send(
    new BatchGetCommand({
      RequestItems: { [TABLE_NAME]: { Keys: userKeys } },
    })
  );

  const profileMap = new Map<string, Record<string, unknown>>();
  for (const profile of profilesResult.Responses?.[TABLE_NAME] ?? []) {
    profileMap.set(profile.userId as string, profile as Record<string, unknown>);
  }

  const members: GroupMember[] = memberItems.map((m) => {
    const profile = profileMap.get(m.userId as string);
    return {
      groupId: m.groupId as string,
      userId: m.userId as string,
      role: m.role as GroupMemberRole,
      joinedAt: m.joinedAt as string,
      name: profile?.name as string | undefined,
      email: profile?.email as string | undefined,
    };
  });

  return ok({ members });
}

async function addMember(
  groupId: string,
  callerId: string,
  userIdOrEmail: string
): Promise<APIGatewayProxyResultV2> {
  // Resolve email → userId if needed
  let resolvedUserId = userIdOrEmail;

  if (userIdOrEmail.includes('@')) {
    const lookupResult = await docClient.send(
      new GetCommand({
        TableName: TABLE_NAME,
        Key: Keys.userEmailLookup(userIdOrEmail),
      })
    );
    if (!lookupResult.Item) {
      return notFound('No user found with that email address. They must sign up first.');
    }
    resolvedUserId = lookupResult.Item.userId as string;
  }

  // Check user profile exists
  const userResult = await docClient.send(
    new GetCommand({ TableName: TABLE_NAME, Key: Keys.user(resolvedUserId) })
  );
  if (!userResult.Item) return notFound('User not found');

  // Check if already a member
  const existing = await getGroupMember(groupId, resolvedUserId);
  if (existing) return conflict('User is already a member of this group');

  const now = new Date().toISOString();
  const memberItem = {
    ...Keys.groupMember(groupId, resolvedUserId),
    groupId,
    userId: resolvedUserId,
    role: 'MEMBER' as GroupMemberRole,
    joinedAt: now,
    _entityType: 'GROUP_MEMBER',
  };

  const userGroupItem = {
    ...Keys.userGroup(resolvedUserId, groupId),
    groupId,
    userId: resolvedUserId,
    _entityType: 'USER_GROUP',
  };

  await docClient.send(
    new TransactWriteCommand({
      TransactItems: [
        { Put: { TableName: TABLE_NAME, Item: memberItem } },
        { Put: { TableName: TABLE_NAME, Item: userGroupItem } },
      ],
    })
  );

  const profile = userResult.Item as Record<string, unknown>;
  const member: GroupMember = {
    groupId,
    userId: resolvedUserId,
    role: 'MEMBER',
    joinedAt: now,
    name: profile.name as string | undefined,
    email: profile.email as string | undefined,
  };

  return created({ member });
}

async function removeMember(
  groupId: string,
  memberUserId: string,
  callerId: string
): Promise<APIGatewayProxyResultV2> {
  const callerMember = await getGroupMember(groupId, callerId);
  if (!callerMember) return forbidden('You are not a member of this group');

  // Allow: ADMIN can remove anyone, any member can remove themselves
  if (callerMember.role !== 'ADMIN' && callerId !== memberUserId) {
    return forbidden('Only admins can remove other members');
  }

  // Prevent removing the last admin
  if (memberUserId === callerId && callerMember.role === 'ADMIN') {
    const allMembers = await docClient.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
        FilterExpression: '#role = :admin',
        ExpressionAttributeNames: { '#role': 'role' },
        ExpressionAttributeValues: {
          ':pk': `GROUP#${groupId}`,
          ':prefix': SKPrefix.members,
          ':admin': 'ADMIN',
        },
        Select: 'COUNT',
      })
    );
    if ((allMembers.Count ?? 0) <= 1) {
      return forbidden('Cannot remove the last admin. Transfer admin role first.');
    }
  }

  const targetMember = await getGroupMember(groupId, memberUserId);
  if (!targetMember) return notFound('Member not found in this group');

  await docClient.send(
    new TransactWriteCommand({
      TransactItems: [
        {
          Delete: {
            TableName: TABLE_NAME,
            Key: Keys.groupMember(groupId, memberUserId),
          },
        },
        {
          Delete: {
            TableName: TABLE_NAME,
            Key: Keys.userGroup(memberUserId, groupId),
          },
        },
      ],
    })
  );

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
    new GetCommand({ TableName: TABLE_NAME, Key: Keys.groupMember(groupId, userId) })
  );
  return !!result.Item;
}

async function getGroupMember(
  groupId: string,
  userId: string
): Promise<{ role: GroupMemberRole } | null> {
  const result = await docClient.send(
    new GetCommand({ TableName: TABLE_NAME, Key: Keys.groupMember(groupId, userId) })
  );
  if (!result.Item) return null;
  return { role: result.Item.role as GroupMemberRole };
}

function itemToGroup(item: Record<string, unknown>): Group {
  return {
    groupId: item.groupId as string,
    name: item.name as string,
    currency: item.currency as string,
    createdBy: item.createdBy as string,
    createdAt: item.createdAt as string,
    updatedAt: item.updatedAt as string,
    description: item.description as string | undefined,
  };
}
