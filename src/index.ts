import { Hono } from 'hono';
import type { Env } from './env';
import { checkSsh, readSshBanner } from './ssh';

const app = new Hono<{ Bindings: Env }>();

app.get('/', (c) => {
  return c.json({
    name: 'ark-watcher',
    status: 'ok',
  });
});

app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
  });
});

app.get('/ssh/check', async (c) => {
  try {
    const result = await checkSsh(c.env);

    return c.json(result);
  } catch (error) {
    return c.json(
      {
        connected: false,
        error: error instanceof Error ? error.message : String(error),
        debug: error instanceof Error && 'debug' in error ? error.debug : undefined,
      },
      502,
    );
  }
});

app.get('/ssh/banner', async (c) => {
  try {
    const result = await readSshBanner(c.env);

    return c.json(result);
  } catch (error) {
    return c.json(
      {
        error: error instanceof Error ? error.message : String(error),
      },
      502,
    );
  }
});

export default app;
