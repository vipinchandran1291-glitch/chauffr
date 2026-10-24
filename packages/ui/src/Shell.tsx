import type { ReactNode } from 'react';
import { useSession } from './session';

export function Shell({ title, wide, children }: { title: string; wide?: boolean; children: ReactNode }) {
  const { user, logout } = useSession();
  return (
    <div className="shell">
      <header className="topbar">
        <strong>{title}</strong>
        {user && (
          <div className="topbar-user">
            <span>{user.name || user.email}</span>
            <button type="button" className="link" onClick={() => void logout()}>Sign out</button>
          </div>
        )}
      </header>
      <main className={wide ? 'content wide' : 'content'}>{children}</main>
    </div>
  );
}

export function Splash() {
  return <div className="login muted">Loading…</div>;
}
