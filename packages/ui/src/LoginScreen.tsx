import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, errorMessage, type AppName, type PublicConfig } from '@chauffr/shared';
import { useSession } from './session';

interface GoogleIdentity {
  accounts: {
    id: {
      initialize(options: { client_id: string; callback: (res: { credential: string }) => void }): void;
      renderButton(el: HTMLElement, options: Record<string, string | number>): void;
    };
  };
}

declare global {
  interface Window {
    google?: GoogleIdentity;
  }
}

let googleScript: Promise<GoogleIdentity> | undefined;

function loadGoogle(): Promise<GoogleIdentity> {
  googleScript ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => (window.google ? resolve(window.google) : reject(new Error('Google sign-in unavailable')));
    script.onerror = () => reject(new Error('Could not load Google sign-in'));
    document.head.appendChild(script);
  });
  return googleScript;
}

interface Props {
  app: AppName;
  title: string;
  tagline: string;
}

export function LoginScreen({ app, title, tagline }: Props) {
  const { refresh } = useSession();
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [error, setError] = useState('');
  const [devEmail, setDevEmail] = useState('');
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get<PublicConfig>('/api/config').then(setConfig, () => setError('Cannot reach the server'));
  }, []);

  useEffect(() => {
    const el = buttonRef.current;
    if (!config?.googleClientId || !el) return;
    loadGoogle().then(
      (google) => {
        google.accounts.id.initialize({
          client_id: config.googleClientId,
          callback: async ({ credential }) => {
            try {
              await api.post('/api/auth/google', { credential, app });
              await refresh();
            } catch (err) {
              setError(errorMessage(err));
            }
          },
        });
        google.accounts.id.renderButton(el, { theme: 'filled_blue', size: 'large', shape: 'pill', text: 'continue_with' });
      },
      (err) => setError(errorMessage(err)),
    );
  }, [config, app, refresh]);

  async function devLogin(e: FormEvent) {
    e.preventDefault();
    try {
      await api.post('/api/auth/dev', { email: devEmail, app });
      await refresh();
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="login">
      <div className="card stack login-card">
        <div className="brand">Chauffr</div>
        <h1>{title}</h1>
        <p className="muted">{tagline}</p>
        <div ref={buttonRef} className="google-button" />
        {config && !config.googleClientId && !config.devLogin && (
          <p className="muted">Google sign-in is not configured on the server.</p>
        )}
        {config?.devLogin && (
          <form className="stack dev-login" onSubmit={devLogin}>
            <label>
              Dev sign-in (local only)
              <input type="email" value={devEmail} onChange={(e) => setDevEmail(e.target.value)} placeholder="you@example.com" required />
            </label>
            <button type="submit" className="secondary">Sign in without Google</button>
          </form>
        )}
        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}
