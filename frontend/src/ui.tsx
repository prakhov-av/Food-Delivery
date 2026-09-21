import { useState, type FormEvent, type ReactNode } from 'react';
import type { OrderStatus, Role } from './types';

export function ErrorBanner({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="banner banner-error">
      <span>{message}</span>
      <button className="banner-close" onClick={onClose} aria-label="Закрыть">
        ×
      </button>
    </div>
  );
}

export function SuccessBanner({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="banner banner-success">
      <span>{message}</span>
      <button className="banner-close" onClick={onClose} aria-label="Закрыть">
        ×
      </button>
    </div>
  );
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  NEW: 'Новый',
  CREATED: 'Создан',
  ACCEPTED: 'Принят',
  COOKING: 'Готовится',
  READY: 'Готов',
  DELIVERING: 'Доставляется',
  COMPLETED: 'Завершён',
  CANCELLED: 'Отменён',
};

export function statusLabel(status?: OrderStatus): string {
  return status ? (STATUS_LABELS[status] ?? status) : '—';
}

export function StatusBadge({ status }: { status?: OrderStatus }) {
  return <span className={`badge status-${status ?? 'unknown'}`}>{statusLabel(status)}</span>;
}

const ROLE_LABELS: Record<Role, string> = {
  ADMIN: 'Администратор',
  MANAGER: 'Менеджер',
  CUSTOMER: 'Клиент',
  COURIER: 'Курьер',
};

export function roleLabel(role: Role): string {
  return ROLE_LABELS[role] ?? role;
}

export function RoleBadge({ role }: { role: Role }) {
  return <span className={`badge role-${role}`}>{roleLabel(role)}</span>;
}

export function formatPrice(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (Number.isNaN(num)) return '—';
  return `${num.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ₽`;
}

export function formatDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('ru-RU');
}

/** Карточка-«раскрывашка» для форм создания. */
export function CollapsibleForm({
  title,
  children,
  onSubmit,
  submitLabel = 'Создать',
  busy = false,
}: {
  title: string;
  children: ReactNode;
  onSubmit: () => Promise<void> | void;
  submitLabel?: string;
  busy?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void onSubmit();
  };

  return (
    <div className="card form-card">
      <button className="form-card-toggle" onClick={() => setOpen(!open)}>
        <span>{open ? '−' : '+'}</span> {title}
      </button>
      {open && (
        <form className="form-grid" onSubmit={handleSubmit}>
          {children}
          <div className="form-actions">
            <button className="btn btn-primary" type="submit" disabled={busy}>
              {busy ? '…' : submitLabel}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
