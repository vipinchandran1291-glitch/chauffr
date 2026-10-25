import { serve } from '@hono/node-server';
import { createApp } from './app.ts';
import { googleVerifier } from './auth.ts';
import { openDb } from './db.ts';
import { loadEnv } from './env.ts';
import { razorpayGateway } from './razorpay.ts';

const env = loadEnv();
const db = openDb(env.databasePath);
const app = createApp(db, env, googleVerifier(env.googleClientId), razorpayGateway(env.razorpay));

serve({ fetch: app.fetch, port: env.port, hostname: '127.0.0.1' }, ({ port }) => {
  console.log(`Chauffr API listening on http://127.0.0.1:${port}`);
  if (env.devLogin) console.log('DEV_LOGIN is on: anyone can sign in with just an email.');
  if (!env.razorpay.keyId) console.log('Razorpay keys are not set: customers cannot pay.');
  if (env.razorpay.keyId && !env.razorpay.webhookSecret) console.log('RAZORPAY_WEBHOOK_SECRET is not set: webhooks will be rejected.');
});
