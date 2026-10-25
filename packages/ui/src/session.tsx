import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '@chauffr/shared';
import { ApiError, errorMessage, type Api } from './api.ts';
import { LoginScreen } from './LoginScreen.tsx';
import { ProfileForm } from './ProfileForm.tsx';

interface Session {
  user: User;
  api: Api;
  setUser(user: User): void;
  logout(): Promise<void>;
}

const SessionContext = createContext<Session | null>(null);

export function useSession(): Session {
  const s = useContext(SessionContext);
  if (!s) throw new Error('useSession used outside <SessionGate>');
  return s;
}

/** Shows sign-in, then the name/phone form, then the app. */
export function SessionGate({ api, title, tagline, children }: { api: Api; title: string; tagline: string; children: ReactNode }) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [loadError, setLoadError] = useState('');

  const load = useCallback(() => {
    setLoadError('');
    api<User>('GET', '/auth/me')
      .then(setUser)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) setUser(null);
        else setLoadError(errorMessage(err));
      });
  }, [api]);

  useEffect(load, [load]);

  const logout = useCallback(async () => {
    await api('POST', '/auth/logout');
    setUser(null);
  }, [api]);

  if (loadError) {
    return (
      <div className="center">
        <div className="stack" style={{ alignItems: 'center' }}>
          <p className="error">Can't reach Chauffr right now. Check your connection.</p>
          <button onClick={load}>Retry</button>
        </div>
      </div>
    );
  }
  if (user === undefined) return <div className="center muted">Loading...</div>;
  if (user === null) return <LoginScreen api={api} title={title} tagline={tagline} onLogin={setUser} />;

  return (
    <SessionContext.Provider value={{ user, api, setUser, logout }}>
      {user.phone ? children : <ProfileForm api={api} user={user} onSaved={setUser} intro="Tell us how to reach you." />}
    </SessionContext.Provider>
  );
}
