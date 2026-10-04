import {
  Fragment,
  useCallback,
  useEffect,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react';
import { api } from '../api';
import { AUDIT_ACTIONS } from '../types';
import type { AuditPageDto } from '../types';
import { ErrorBanner, formatDate } from '../ui';

const PAGE_SIZE = 20;

const ENTITY_TYPES = [
  'User',
  'Restaurant',
  'Menu',
  'MenuItem',
  'Order',
  'OrderItem',
  'Document',
  'Chat',
];

const RESULT_COLORS: Record<string, string> = {
  SUCCESS: '#1e8e3e',
  DENIED: '#e37400',
  FAILED: '#d93025',
};

const FIELD_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  minWidth: 0,
  fontSize: 13,
};

const CONTROL_STYLE: CSSProperties = {
  width: '100%',
  height: 42,
  minWidth: 0,
  boxSizing: 'border-box',
};

interface Filters {
  actorId: string;
  action: string;
  entityType: string;
  entityId: string;
  from: string;
  to: string;
}

const EMPTY_FILTERS: Filters = {
  actorId: '',
  action: '',
  entityType: '',
  entityId: '',
  from: '',
  to: '',
};

function buildQuery(filters: Filters, page: number): string {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(PAGE_SIZE),
  });

  if (filters.actorId) params.set('actorId', filters.actorId);
  if (filters.action) params.set('action', filters.action);
  if (filters.entityType) params.set('entityType', filters.entityType);
  if (filters.entityId) params.set('entityId', filters.entityId);
  if (filters.from) params.set('from', new Date(filters.from).toISOString());
  if (filters.to) params.set('to', new Date(filters.to).toISOString());

  return params.toString();
}

export default function AuditView() {
  const [form, setForm] = useState<Filters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<AuditPageDto>({
    items: [],
    total: 0,
    page: 1,
    pageSize: PAGE_SIZE,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openId, setOpenId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(
        await api<AuditPageDto>(`/audit-logs?${buildQuery(applied, page)}`),
      );
      setOpenId(null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Не удалось загрузить журнал',
      );
    } finally {
      setLoading(false);
    }
  }, [applied, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setApplied(form);
    setPage(1);
  };

  const reset = () => {
    setForm(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(data.total / PAGE_SIZE));

  return (
    <div className="view">
      <header className="view-header">
        <h1>Журнал</h1>
        <button className="btn btn-ghost" onClick={() => void load()}>
          Обновить
        </button>
      </header>

      {error && <ErrorBanner message={error} onClose={() => setError('')} />}

      <form className="card" style={{ padding: 20 }} onSubmit={submit}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
          }}
        >
          <label style={FIELD_STYLE}>
            Исполнитель (ID)
            <input
              style={CONTROL_STYLE}
              type="number"
              min="1"
              value={form.actorId}
              onChange={(e) => setForm({ ...form, actorId: e.target.value })}
            />
          </label>
          <label style={FIELD_STYLE}>
            Действие
            <select
              style={CONTROL_STYLE}
              value={form.action}
              onChange={(e) => setForm({ ...form, action: e.target.value })}
            >
              <option value="">Все</option>
              {AUDIT_ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          <label style={FIELD_STYLE}>
            Объект
            <select
              style={CONTROL_STYLE}
              value={form.entityType}
              onChange={(e) => setForm({ ...form, entityType: e.target.value })}
            >
              <option value="">Все</option>
              {ENTITY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label style={FIELD_STYLE}>
            ID объекта
            <input
              style={CONTROL_STYLE}
              type="number"
              min="1"
              value={form.entityId}
              onChange={(e) => setForm({ ...form, entityId: e.target.value })}
            />
          </label>
          <label style={FIELD_STYLE}>
            С
            <input
              style={CONTROL_STYLE}
              type="datetime-local"
              value={form.from}
              onChange={(e) => setForm({ ...form, from: e.target.value })}
            />
          </label>
          <label style={FIELD_STYLE}>
            По
            <input
              style={CONTROL_STYLE}
              type="datetime-local"
              value={form.to}
              onChange={(e) => setForm({ ...form, to: e.target.value })}
            />
          </label>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
          <button className="btn btn-primary" type="submit">
            Применить
          </button>
          <button className="btn btn-ghost" type="button" onClick={reset}>
            Сбросить
          </button>
        </div>
      </form>

      {loading ? (
        <div className="empty">Загрузка…</div>
      ) : data.items.length === 0 ? (
        <div className="empty">Записей нет</div>
      ) : (
        <div className="card table-card" style={{ marginTop: 16 }}>
          <table>
            <thead>
              <tr>
                <th>Время</th>
                <th>Исполнитель</th>
                <th>Действие</th>
                <th>Объект</th>
                <th>Результат</th>
                <th>IP</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.items.map((log) => (
                <Fragment key={log.id}>
                  <tr>
                    <td className="muted">{formatDate(log.createdAt)}</td>
                    <td>
                      {log.actorId !== null
                        ? `#${log.actorId} · ${log.actorRole ?? '—'}`
                        : '—'}
                    </td>
                    <td>{log.action}</td>
                    <td>
                      {log.entityType
                        ? `${log.entityType}${log.entityId !== null ? ` #${log.entityId}` : ''}`
                        : '—'}
                    </td>
                    <td
                      style={{
                        color: RESULT_COLORS[log.result] ?? 'inherit',
                        fontWeight: 600,
                      }}
                    >
                      {log.result}
                    </td>
                    <td className="muted">{log.ip ?? '—'}</td>
                    <td>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() =>
                          setOpenId(openId === log.id ? null : log.id)
                        }
                      >
                        {openId === log.id ? 'Скрыть' : 'Детали'}
                      </button>
                    </td>
                  </tr>
                  {openId === log.id && (
                    <tr>
                      <td colSpan={7}>
                        <pre
                          style={{
                            margin: 0,
                            whiteSpace: 'pre-wrap',
                            fontSize: 12,
                          }}
                        >
                          {JSON.stringify(
                            { details: log.details, userAgent: log.userAgent },
                            null,
                            2,
                          )}
                        </pre>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          marginTop: 16,
        }}
      >
        <button
          className="btn btn-ghost btn-sm"
          disabled={page <= 1 || loading}
          onClick={() => setPage((p) => p - 1)}
        >
          ← Назад
        </button>
        <span className="muted">
          Страница {page} из {totalPages} · всего {data.total}
        </span>
        <button
          className="btn btn-ghost btn-sm"
          disabled={page >= totalPages || loading}
          onClick={() => setPage((p) => p + 1)}
        >
          Вперёд →
        </button>
      </div>
    </div>
  );
}
