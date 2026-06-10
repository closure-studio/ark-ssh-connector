import { Hono } from 'hono';
import { executeSshCommand, type SshCommandRequest } from './ssh';

const app = new Hono();

app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
  });
});

app.post('/ssh/exec', async (c) => {
  let body: unknown;

  try {
    body = await c.req.json();
  } catch {
    return c.json(
      {
        connected: false,
        error: 'Request body must be valid JSON',
      },
      400,
    );
  }

  try {
    const result = await executeSshCommand(parseSshCommandRequest(body));

    return c.json(result);
  } catch (error) {
    const isValidationError = error instanceof RequestValidationError;

    return c.json(
      {
        connected: false,
        error: error instanceof Error ? error.message : String(error),
      },
      isValidationError ? 400 : 502,
    );
  }
});

export default app;

class RequestValidationError extends Error {}

function parseSshCommandRequest(value: unknown): SshCommandRequest {
  if (!isRecord(value)) {
    throw new RequestValidationError('Request body must be a JSON object');
  }

  return {
    ip: requireString(value.ip, 'ip'),
    port: requirePort(value.port),
    username: requireString(value.username, 'username'),
    password: requireString(value.password, 'password'),
    command: requireString(value.command, 'command'),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, name: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new RequestValidationError(`${name} must be a non-empty string`);
  }

  return value;
}

function requirePort(value: unknown): number {
  const port = typeof value === 'string' && value.trim() !== ''
    ? Number(value)
    : value;

  if (!Number.isInteger(port) || typeof port !== 'number' || port < 1 || port > 65535) {
    throw new RequestValidationError('port must be an integer between 1 and 65535');
  }

  return port;
}
