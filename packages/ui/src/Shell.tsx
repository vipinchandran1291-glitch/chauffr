import type { ReactNode } from 'react';
import { Logo } from './Icon';
import { useSession } from './session';

export function Shell({ section, wide, children }: { section?: string; wide?: boolean; children: ReactNode }) {
  const { user, logout } = useSession();
  const initial = (user?.name || user?.email || '?').charAt(0).toUpperCase();
  return (
    <div className="shell">
      <header className="topbar">
        <div className="topbar-title">
          <Logo size={28} />
          {section && <small>{section}</small>}
        </div>
        {user && (
          <div className="topbar-user">
            <span className="avatar" title={user.email}>
              {user.avatarUrl ? <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" /> : initial}
            </span>
            <button type="button" className="link" onClick={() => void logout()}>Sign out</button>
          </div>
        )}
      </header>
      <main className={wide ? 'content wide' : 'content'}>{children}</main>
    </div>
  );
}

export function Splash() {
  return (
    <div className="auth-panel" style={{ minHeight: '100vh' }}>
      <Logo />
    </div>
  );
}
