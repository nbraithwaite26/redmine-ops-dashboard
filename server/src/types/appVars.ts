/**
 * Shared Hono context variable shape. Every Hono() instance that uses
 * c.get('requestId') or c.get('sessionUser') needs to be parameterized
 * with this type, otherwise tsc widens the variable keys to `never`.
 */
export type AppVariables = {
  requestId: string;
  sessionUser?: string;
};

export type AppEnv = { Variables: AppVariables };
