import { useCallback, useEffect, useState } from 'react';
import { api, apiList } from '../api';
import type { Role, UserDto } from '../types';
import { CollapsibleForm, ErrorBanner, RoleBadge, SuccessBanner, roleLabel } from '../ui';

const ROLES: Role[] = ['ADMIN', 'MANAGER', 'CUSTOMER', 'COURIER'];

export default function UsersView() {
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
      setError(err instanceof Error ? err.message : 'Не удалось загрузить пользователей');
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
      setError(err instanceof Error ? err.message : 'Операция не выполнена');
    } finally {
      setBusy(false);
    }
  };

  const create = () =>
    run(async () => {
      await api('/users', { method: 'POST', body: JSON.stringify(form) });
      setForm({ name: '', email: '', phone: '', password: '' });
    }, 'Пользователь создан (роль: Клиент)');

  const setRole = (id: number, role: Role) =>
    run(
      () => api(`/users/${id}/set-role/${role}`, { method: 'PATCH' }),
      `Роль пользователя #${id}: ${roleLabel(role)}`,
    );

  const remove = (id: number) =>
    run(() => api(`/users/${id}`, { method: 'DELETE' }), `Пользователь #${id} деактивирован`);

  return (
    <div className="view">
      <header className="view-header">
        <h1>Пользователи</h1>
        <button className="btn btn-ghost" onClick={() => void load()}>
          Обновить
        </button>
      </header>

      {error && <ErrorBanner message={error} onClose={() => setError('')} />}
      {success && <SuccessBanner message={success} onClose={() => setSuccess('')} />}

      <CollapsibleForm title="Добавить пользователя" onSubmit={create} busy={busy}>
        <label>
          Имя (латиницей)
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
            minLength={2}
          />
        </label>
        <label>
          Email
          <input
            type="email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            required
          />
        </label>
        <label>
          Телефон
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            required
          />
        </label>
        <label>
          Пароль
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
        <div className="empty">Загрузка…</div>
      ) : users.length === 0 ? (
        <div className="empty">Пользователей нет</div>
      ) : (
        <div className="card table-card">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Имя</th>
                <th>Телефон</th>
                <th>Роль</th>
                <th className="actions-col">Действия</th>
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
                      <option value="">Сменить роль…</option>
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
                      Удалить
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
