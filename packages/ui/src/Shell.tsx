import type { ReactNode } from 'react';
import { useSession } from './session.tsx';

export interface Tab<T extends string> {
  id: T;
  label: string;
}

export function Shell<T extends string>({
  title,
  tabs,
  active,
  onTab,
  children,
}: {
  title: string;
  tabs?: Tab<NoInfer<T>>[];
  active?: T;
  onTab?(id: T): void;
  children: ReactNode;
}) {
  const { user, logout } = useSession();
  return (
    <div className="shell">
      <header className="topbar">
        <strong>{title}</strong>
        <span className="muted small">{user.name}</span>
        <button className="link" onClick={logout}>
          Sign out
        </button>
      </header>
      {tabs && (
        <nav className="tabs">
          {tabs.map((t) => (
            <button key={t.id} className={t.id === active ? 'tab active' : 'tab'} onClick={() => onTab?.(t.id)}>
              {t.label}
            </button>
          ))}
        </nav>
      )}
      <main className="page">{children}</main>
    </div>
  );
}

const STATUS_LABELS: Record<string, string> = {
  requested: 'Finding driver',
  assigned: 'Driver assigned',
  in_progress: 'On trip',
  completed: 'Completed',
  cancelled: 'Cancelled',
  pending: 'Pending review',
  approved: 'Approved',
  rejected: 'Rejected',
  suspended: 'Suspended',
};

export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge badge-${status}`}>{STATUS_LABELS[status] ?? status}</span>;
}

export function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
}
