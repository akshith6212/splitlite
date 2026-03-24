const headers = { 'Content-Type': 'application/json' };

export const ok = (body: unknown, statusCode = 200) => ({
  statusCode,
  headers,
  body: JSON.stringify(body),
});

export const created = (body: unknown) => ok(body, 201);

export const noContent = () => ({ statusCode: 204, headers, body: '' });

export const notFound = (message = 'Not found') =>
  ok({ message }, 404);

export const forbidden = (message = 'Forbidden') =>
  ok({ message }, 403);

export const badRequest = (message: string) =>
  ok({ message }, 400);

export const conflict = (message: string) =>
  ok({ message }, 409);

export const internalError = () =>
  ok({ message: 'Internal server error' }, 500);
