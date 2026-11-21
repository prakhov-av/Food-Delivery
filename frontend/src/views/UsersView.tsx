import { useCallback, useEffect, useState } from 'react';
import { api, apiList } from '../api';
import { translate, useT } from '../i18n';
import type { Role, UserDto } from '../types';
import { CollapsibleForm, ErrorBanner, RoleBadge, SuccessBanner, roleLabel } from '../ui';

const ROLES: Role[] = ['ADMIN', 'MANAGER', 'CUSTOMER', 'COURIER'];

export default function UsersView() {
  const t = useT();
  const [users, setUsers] = useState<UserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '' });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setUsers(await apiList<UserDto>('/users'));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : translate('views.users.loadFailed'),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (action: () => Promise<void>, successMessage: string) => {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await action();
      setSuccess(successMessage);
      await load();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('views.users.operationFailed'),
      );
    } finally {
      setBusy(false);
    }
  };

  const create = () =>
    run(async () => {
      await api('/users', { method: 'POST', body: JSON.stringify(form) });
      setForm({ name: '', email: '', phone: '', password: '' });
    }, t('views.users.created'));

  const setRole = (id: number, role: Role) =>
    run(
      () => api(`/users/${id}/set-role/${role}`, { method: 'PATCH' }),
      t('views.users.roleChanged', { id, role: roleLabel(role) }),
    );

  const remove = (id: number) =>
    run(
      () => api(`/users/${id}`, { method: 'DELETE' }),
      t('views.users.deactivated', { id }),
    );

  return (
    <div className="view">
      <header className="view-header">
        <h1>{t('views.users.title')}</h1>
        <button className="btn btn-ghost" onClick={() => void load()}>
          {t('views.users.refresh')}
        </button>
      </header>

      {error && <ErrorBanner message={error} onClose={() => setError('')} />}
      {success && <SuccessBanner message={success} onClose={() => setSuccess('')} />}

      <CollapsibleForm title={t('views.users.addTitle')} onSubmit={create} busy={busy}>
        <label>
          {t('views.users.nameLatin')}
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            minLength={2}
          />
        </label>
        <label>
          {t('views.users.email')}
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </label>
        <label>
          {t('views.users.phone')}
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            required
          />
        </label>
        <label>
          {t('views.users.password')}
          <input
            type="password"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
            required
            minLength={8}
          />
        </label>
      </CollapsibleForm>

      {loading ? (
        <div className="empty">{t('views.users.loading')}</div>
      ) : users.length === 0 ? (
        <div className="empty">{t('views.users.empty')}</div>
      ) : (
        <div className="card table-card">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>{t('views.users.name')}</th>
                <th>{t('views.users.phone')}</th>
                <th>{t('views.users.role')}</th>
                <th className="actions-col">{t('views.users.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="muted">#{u.id}</td>
                  <td>{u.name}</td>
                  <td>{u.phone}</td>
                  <td>
                    <RoleBadge role={u.role} />
                  </td>
                  <td className="actions-col">
                    <select
                      className="status-select"
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          void setRole(u.id, e.target.value as Role);
                        }
                      }}
                      disabled={busy}
                    >
                      <option value="">{t('views.users.changeRole')}</option>
                      {ROLES.filter((r) => r !== u.role).map((r) => (
                        <option key={r} value={r}>
                          {roleLabel(r)}
                        </option>
                      ))}
                    </select>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => void remove(u.id)}
                      disabled={busy}
                    >
                      {t('views.users.delete')}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
