import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, errorMessage, type AppName, type PublicConfig } from '@chauffr/shared';
import { Icon, Logo, type IconName } from './Icon';
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

export interface TrustPoint {
  icon: IconName;
  title: string;
  text: string;
}

interface Props {
  app: AppName;
  title: string;
  tagline: string;
  points: TrustPoint[];
}

export function LoginScreen({ app, title, tagline, points }: Props) {
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
        google.accounts.id.renderButton(el, {
          theme: 'outline',
          size: 'large',
          shape: 'rectangular',
          text: 'continue_with',
          width: Math.min(el.clientWidth || 360, 400),
        });
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
    <div className="auth">
      <section className="auth-hero">
        <Logo size={34} />
        <div className="stack-sm">
          <h1>{title}</h1>
          <p className="lead">{tagline}</p>
        </div>
        <ul className="trust-list">
          {points.map((p) => (
            <li key={p.title}>
              <span className="trust-icon"><Icon name={p.icon} /></span>
              <div>
                <strong>{p.title}</strong>
                <span>{p.text}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="auth-panel">
        <div className="card auth-card stack">
          <div className="stack-sm">
            <h2>Sign in</h2>
            <p className="muted small">Use your Google account. We never post anything on your behalf.</p>
          </div>
          <div ref={buttonRef} className="google-button" />
          {config && !config.googleClientId && !config.devLogin && (
            <p className="alert warning small">Google sign-in is not configured on the server yet.</p>
          )}
          {config?.devLogin && (
            <form className="stack" onSubmit={devLogin}>
              <div className="divider">local development</div>
              <label>
                Email
                <input type="email" value={devEmail} onChange={(e) => setDevEmail(e.target.value)} placeholder="you@example.com" required />
              </label>
              <button type="submit" className="secondary">Sign in without Google</button>
            </form>
          )}
          {error && (
            <p className="alert danger small"><Icon name="alert" size={18} />{error}</p>
          )}
          <p className="fineprint">By continuing you agree to Chauffr's Terms and Privacy Policy.</p>
        </div>
      </section>
    </div>
  );
}
