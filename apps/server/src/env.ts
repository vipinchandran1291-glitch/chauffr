export interface Env {
  port: number;
  databasePath: string;
  googleClientId: string;
  adminEmails: Set<string>;
  /** Allows signing in with just an email. Never enable in production. */
  devLogin: boolean;
  cookieSecure: boolean;
  razorpay: { keyId: string; keySecret: string; webhookSecret: string };
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const devLogin = source.DEV_LOGIN === 'true';
  if (devLogin && source.NODE_ENV === 'production') {
    throw new Error('DEV_LOGIN must not be enabled in production');
  }
  return {
    port: Number(source.PORT ?? 3000),
    databasePath: source.DATABASE_PATH ?? 'data/chauffr.db',
    googleClientId: source.GOOGLE_CLIENT_ID ?? '',
    adminEmails: new Set(
      (source.ADMIN_EMAILS ?? '')
        .split(',')
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    ),
    devLogin,
    cookieSecure: source.NODE_ENV === 'production',
    razorpay: {
      keyId: source.RAZORPAY_KEY_ID ?? '',
      keySecret: source.RAZORPAY_KEY_SECRET ?? '',
      webhookSecret: source.RAZORPAY_WEBHOOK_SECRET ?? '',
    },
  };
}
