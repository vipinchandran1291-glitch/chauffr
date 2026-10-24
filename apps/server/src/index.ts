import { buildApp } from './app';
import { sqlite } from './db';
import { env } from './env';

const app = await buildApp();

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, async () => {
    await app.close();
    sqlite.close();
    process.exit(0);
  });
}

await app.listen({ port: env.port, host: env.host });
