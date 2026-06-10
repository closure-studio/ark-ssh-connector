import { connect } from 'cloudflare:sockets';
import { Duplex } from 'node:stream';
import type ClientConstructor from 'ssh2/lib/client.js';

type SshClientConstructor = typeof ClientConstructor;

export interface SshCommandRequest {
  ip: string;
  port: number;
  username: string;
  password: string;
  command: string;
}

export interface SshCommandResult {
  connected: boolean;
  stdout: string;
  stderr: string;
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

export async function executeSshCommand(request: SshCommandRequest): Promise<SshCommandResult> {
  const Client = await loadSshClient();

  return new Promise((resolve, reject) => {
    const client = new Client();
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    const rejectCommand = (error: unknown) => {
      client.end();
      reject(toError(error));
    };

    client
      .once('ready', () => {
        client.exec(request.command, (error, stream) => {
          if (error) {
            rejectCommand(error);
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
      .once('error', rejectCommand)
      .connect({
        sock: new WorkerSocketDuplex(request.ip, request.port),
        username: request.username,
        password: request.password,
        algorithms: {
          cipher: [
            'aes128-ctr',
            'aes192-ctr',
            'aes256-ctr',
          ],
          compress: ['none'],
        },
        readyTimeout: 20_000,
      });
  });
}

async function loadSshClient(): Promise<SshClientConstructor> {
  const module = await import('ssh2/lib/client.js');

  return module.default;
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
