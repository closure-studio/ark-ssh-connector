import { WorkerEntrypoint } from 'cloudflare:workers';
import { executeSshCommand, type SshCommandRequest } from './ssh';

export default class ArkSshConnector extends WorkerEntrypoint {
  health(): { status: 'healthy' } {
    return {
      status: 'healthy',
    };
  }

  async execute(request: SshCommandRequest) {
    return executeSshCommand(parseSshCommandRequest(request));
  }
}

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
