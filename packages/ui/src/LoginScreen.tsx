import { useEffect, useRef, useState } from 'react';
import type { User } from '@chauffr/shared';
import { errorMessage, type Api } from './api.ts';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize(opts: { client_id: string; callback: (res: { credential: string }) => void }): void;
          renderButton(el: HTMLElement, opts: Record<string, unknown>): void;
        };
      };
    };
  }
}

interface AuthConfig {
  googleClientId: string;
  devLogin: boolean;
}

function loadGoogleScript(): Promise<void> {
  if (window.google) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load Google sign-in'));
    document.head.appendChild(s);
  });
}

export function LoginScreen({ api, title, tagline, onLogin }: { api: Api; title: string; tagline: string; onLogin(u: User): void }) {
  const [config, setConfig] = useState<AuthConfig | null>(null);
  const [error, setError] = useState('');
  const [devEmail, setDevEmail] = useState('');
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api<AuthConfig>('GET', '/auth/config').then(setConfig, (e) => setError(errorMessage(e)));
  }, [api]);

  useEffect(() => {
    if (!config?.googleClientId || !buttonRef.current) return;
    const el = buttonRef.current;
    loadGoogleScript()
      .then(() => {
        window.google!.accounts.id.initialize({
          client_id: config.googleClientId,
          callback: ({ credential }) => {
            setError('');
            api<User>('POST', '/auth/google', { credential }).then(onLogin, (e) => setError(errorMessage(e)));
          },
        });
        window.google!.accounts.id.renderButton(el, { theme: 'outline', size: 'large', shape: 'pill', width: 280 });
      })
      .catch((e) => setError(errorMessage(e)));
  }, [api, config, onLogin]);

  const devLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      onLogin(await api<User>('POST', '/auth/dev', { email: devEmail }));
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <div className="login">
      <div className="brand">
        <div className="logo">C</div>
        <h1>{title}</h1>
        <p className="muted">{tagline}</p>
      </div>
      {config && !config.googleClientId && !config.devLogin && (
        <p className="error">Sign-in is not configured. Set GOOGLE_CLIENT_ID on the server.</p>
      )}
      <div ref={buttonRef} className="google-btn" />
      {config?.devLogin && (
        <form className="card stack" onSubmit={devLogin}>
          <label>
            Dev sign-in (local only)
            <input type="email" required placeholder="you@example.com" value={devEmail} onChange={(e) => setDevEmail(e.target.value)} />
          </label>
          <button type="submit">Continue</button>
        </form>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
