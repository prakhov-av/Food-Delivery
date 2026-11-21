import { useState, type FormEvent, type ReactNode } from 'react';
import type { OrderStatus, Role } from './types';
import { translate, useT } from './i18n';

export function ErrorBanner({ message, onClose }: { message: string; onClose: () => void }) {
  const t = useT();

  return (
    <div className="banner banner-error">
      <span>{message}</span>
      <button className="banner-close" onClick={onClose} aria-label={t('ui.close')}>
        ×
      </button>
    </div>
  );
}

export function SuccessBanner({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  const t = useT();

  return (
    <div className="banner banner-success">
      <span>{message}</span>
      <button className="banner-close" onClick={onClose} aria-label={t('ui.close')}>
        ×
      </button>
    </div>
  );
}

const STATUS_LABEL_KEYS: Record<OrderStatus, string> = {
  NEW: 'ui.status.new',
  ACCEPTED: 'ui.status.accepted',
  COOKING: 'ui.status.cooking',
  READY: 'ui.status.ready',
  DELIVERING: 'ui.status.delivering',
  COMPLETED: 'ui.status.completed',
  CANCELLED_CUSTOMER: 'ui.status.cancelledCustomer',
  CANCELLED_COURIER: 'ui.status.cancelledCourier',
  CANCELLED_STAFF: 'ui.status.cancelledStaff',
};

/**
 * Подпись статуса заказа.
 *
 * Здесь нельзя вызывать хук: функция используется в списках и callbacks,
 * где правила хуков не выполняются. Поэтому перевод берётся из модульной
 * функции, которая знает текущий язык.
 */
export function statusLabel(status?: OrderStatus): string {
  return status
    ? translate(STATUS_LABEL_KEYS[status])
    : translate('ui.status.none');
}

export function StatusBadge({ status }: { status?: OrderStatus }) {
  return <span className={`badge status-${status ?? 'unknown'}`}>{statusLabel(status)}</span>;
}

const ROLE_LABEL_KEYS: Record<Role, string> = {
  ADMIN: 'ui.role.admin',
  MANAGER: 'ui.role.manager',
  CUSTOMER: 'ui.role.customer',
  COURIER: 'ui.role.courier',
};

export function roleLabel(role: Role): string {
  return translate(ROLE_LABEL_KEYS[role]);
}

export function RoleBadge({ role }: { role: Role }) {
  return <span className={`badge role-${role}`}>{roleLabel(role)}</span>;
}

export function formatPrice(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (Number.isNaN(num)) return '—';
  return `${num.toLocaleString('de-DE', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €`;
}

export function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('de-DE');
}

export function CollapsibleForm({
  title,
  children,
  onSubmit,
  submitLabel,
  busy = false,
}: {
  title: string;
  children: ReactNode;
  onSubmit: () => Promise<void> | void;
  submitLabel?: string;
  busy?: boolean;
}) {
  const t = useT();
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
              {busy ? '…' : (submitLabel ?? t('ui.create'))}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
