import { connect } from 'cloudflare:sockets';
import { Duplex } from 'node:stream';
import type { Env } from './env';
import type ClientConstructor from 'ssh2/lib/client.js';

type SshClientConstructor = typeof ClientConstructor;

interface SshCheckResult {
  connected: boolean;
  stdout: string;
  stderr: string;
}

interface SshBannerResult {
  banner: string;
}

class WorkerSocketDuplex extends Duplex {
  readonly connecting = false;

  private readonly socketReadable: ReadableStream<Uint8Array>;
  private readonly writer: WritableStreamDefaultWriter<Uint8Array>;
  private readClosed: Promise<void> | undefined;

  constructor(host: string, port: number) {
    super();

    const socket = connect({ hostname: host, port });
    this.socketReadable = socket.readable;
    this.writer = socket.writable.getWriter();

    queueMicrotask(() => {
      this.emit('connect');
      this.emit('ready');
    });
  }

  setMaxListeners(): this {
    return this;
  }

  setTimeout(): this {
    return this;
  }

  _read(): void {
    this.readClosed ??= this.readFrom(this.socketReadable);
  }

  _write(
    chunk: Buffer | string,
    encoding: BufferEncoding,
    callback: (error?: Error | null) => void,
  ): void {
    const data = typeof chunk === 'string' ? Buffer.from(chunk, encoding) : chunk;

    this.writer.write(data)
      .then(() => callback())
      .catch((error: unknown) => callback(toError(error)));
  }

  _final(callback: (error?: Error | null) => void): void {
    this.writer.close()
      .then(() => callback())
      .catch((error: unknown) => callback(toError(error)));
  }

  _destroy(error: Error | null, callback: (error?: Error | null) => void): void {
    this.writer.abort(error ?? undefined)
      .catch(() => undefined)
      .finally(() => {
        (this.readClosed ?? Promise.resolve())
          .catch(() => undefined)
          .finally(() => callback(error));
      });
  }

  private async readFrom(readable: ReadableStream<Uint8Array>): Promise<void> {
    const reader = readable.getReader();

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          this.push(null);
          return;
        }

        this.push(Buffer.from(value));
      }
    } catch (error) {
      this.destroy(toError(error));
    } finally {
      reader.releaseLock();
    }
  }
}

export async function checkSsh(env: Env): Promise<SshCheckResult> {
  const host = requireEnv(env.VPS_SSH_HOST, 'VPS_SSH_HOST');
  const username = env.VPS_SSH_USERNAME ?? 'root';
  const password = requireEnv(env.VPS_SSH_PASSWORD, 'VPS_SSH_PASSWORD');
  const command = env.VPS_SSH_COMMAND ?? 'printf ark-watcher-ready';
  const port = parsePort(env.VPS_SSH_PORT);
  const Client = await loadSshClient();

  return new Promise((resolve, reject) => {
    const client = new Client();
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    const debugLines: string[] = [];
    const rejectWithDebug = (error: unknown) => {
      const err = toError(error);
      Object.assign(err, { debug: debugLines });
      reject(err);
    };

    client
      .once('ready', () => {
        client.exec(command, (error, stream) => {
          if (error) {
            client.end();
            rejectWithDebug(error);
            return;
          }

          stream
            .on('close', () => {
              client.end();
              resolve({
                connected: true,
                stdout: Buffer.concat(stdoutChunks).toString('utf8'),
                stderr: Buffer.concat(stderrChunks).toString('utf8'),
              });
            })
            .on('data', (chunk: Buffer) => stdoutChunks.push(chunk));

          stream.stderr.on('data', (chunk: Buffer) => stderrChunks.push(chunk));
        });
      })
      .once('error', rejectWithDebug)
      .connect({
        sock: new WorkerSocketDuplex(host, port),
        username,
        password,
        algorithms: {
          cipher: [
            'aes128-ctr',
            'aes192-ctr',
            'aes256-ctr',
          ],
          compress: ['none'],
        },
        debug: (message) => {
          debugLines.push(message);
        },
        readyTimeout: 20_000,
      });
  });
}

async function loadSshClient(): Promise<SshClientConstructor> {
  const module = await import('ssh2/lib/client.js');

  return module.default;
}

export async function readSshBanner(env: Env): Promise<SshBannerResult> {
  const host = requireEnv(env.VPS_SSH_HOST, 'VPS_SSH_HOST');
  const port = parsePort(env.VPS_SSH_PORT);
  const socket = connect({ hostname: host, port });
  const reader = socket.readable.getReader();

  try {
    const result = await Promise.race([
      reader.read(),
      timeout(5_000),
    ]);

    if (result.done || !result.value) {
      throw new Error('SSH server closed before sending a banner');
    }

    return {
      banner: Buffer.from(result.value).toString('utf8').trim(),
    };
  } finally {
    reader.releaseLock();
    await socket.close();
  }
}

function timeout(ms: number): Promise<ReadableStreamReadResult<Uint8Array>> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
  });
}

function parsePort(value: string | undefined): number {
  if (value === undefined || value === '') {
    return 22;
  }

  const port = Number(value);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('VPS_SSH_PORT must be an integer between 1 and 65535');
  }

  return port;
}

function requireEnv(value: string | undefined, name: string): string {
  if (value === undefined || value === '') {
    throw new Error(`${name} is required`);
  }

  return value;
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
