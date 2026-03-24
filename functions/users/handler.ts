import {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { GetCommand, PutCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { docClient, TABLE_NAME } from '@splitlite/shared';
import { Keys } from '@splitlite/shared';
import {
  ok,
  created,
  badRequest,
  internalError,
} from '@splitlite/shared';
import { User, UpdateUserInput } from '@splitlite/shared';

// ---------------------------------------------------------------------------
// Entry point — routes by HTTP method + path
// ---------------------------------------------------------------------------

export const handler = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  try {
    const method = event.requestContext.http.method;
    const callerId = getCallerId(event);

    if (method === 'GET') return getOrCreateCurrentUser(callerId, event);
    if (method === 'PUT') {
      const body = parseBody<UpdateUserInput>(event.body);
      if (!body) return badRequest('Invalid request body');
      return updateCurrentUser(callerId, body);
    }

    return badRequest('Unknown route');
  } catch (err) {
    console.error('UsersHandler error', err);
    return internalError();
  }
};

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

/**
 * GET /users/me
 *
 * Returns the caller's profile. Auto-provisions a profile on first login
 * using the claims from the Cognito JWT (email, name/given_name).
 * Also writes a USER_EMAIL# lookup item so users can be found by email
 * when adding them to groups.
 */
async function getOrCreateCurrentUser(
  callerId: string,
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> {
  const existing = await docClient.send(
    new GetCommand({ TableName: TABLE_NAME, Key: Keys.user(callerId) })
  );

  if (existing.Item) {
    return ok({ user: itemToUser(existing.Item as Record<string, unknown>) });
  }

  // First login — provision profile from JWT claims
  const claims = event.requestContext.authorizer.jwt.claims;
  const email = (claims.email as string | undefined) ?? '';
  const name =
    (claims.name as string | undefined) ??
    (claims.given_name as string | undefined) ??
    email.split('@')[0];

  if (!email) {
    return badRequest('Email claim missing from token. Re-authenticate and try again.');
  }

  const now = new Date().toISOString();
  const profileItem = {
    ...Keys.user(callerId),
    userId: callerId,
    email,
    name,
    createdAt: now,
    _entityType: 'USER',
  };

  // Write profile + email-lookup in one atomic operation
  const emailLookupItem = {
    ...Keys.userEmailLookup(email),
    userId: callerId,
    email,
    _entityType: 'USER_EMAIL_LOOKUP',
  };

  await docClient.send(
    new TransactWriteCommand({
      TransactItems: [
        { Put: { TableName: TABLE_NAME, Item: profileItem } },
        { Put: { TableName: TABLE_NAME, Item: emailLookupItem } },
      ],
    })
  );

  return created({ user: itemToUser(profileItem) });
}

/**
 * PUT /users/me
 *
 * Updates name and/or avatarUrl. Email cannot be changed here (Cognito owns it).
 */
async function updateCurrentUser(
  callerId: string,
  input: UpdateUserInput
): Promise<APIGatewayProxyResultV2> {
  const existing = await docClient.send(
    new GetCommand({ TableName: TABLE_NAME, Key: Keys.user(callerId) })
  );

  // Auto-provision shouldn't happen on PUT, but handle gracefully
  if (!existing.Item) {
    return badRequest('User profile not found. Call GET /users/me first to provision it.');
  }

  if (!input.name?.trim() && input.avatarUrl === undefined) {
    return badRequest('Provide at least one field to update (name, avatarUrl)');
  }

  const updatedItem = {
    ...existing.Item,
    name: input.name?.trim() ?? existing.Item.name,
    avatarUrl: input.avatarUrl !== undefined ? input.avatarUrl : existing.Item.avatarUrl,
  };

  await docClient.send(new PutCommand({ TableName: TABLE_NAME, Item: updatedItem }));

  return ok({ user: itemToUser(updatedItem as Record<string, unknown>) });
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

function itemToUser(item: Record<string, unknown>): User {
  return {
    userId: item.userId as string,
    email: item.email as string,
    name: item.name as string,
    avatarUrl: item.avatarUrl as string | undefined,
    createdAt: item.createdAt as string,
  };
}
