import { useCallback, useEffect, useState } from 'react';
import { api } from '../api';
import { translate, useT } from '../i18n';
import type { MenuDto, RestaurantDto } from '../types';
import { CollapsibleForm, ErrorBanner, SuccessBanner } from '../ui';

export default function MenusView({
  restaurant,
  canManage,
  onSelect,
  onBack,
}: {
  restaurant: RestaurantDto;
  canManage: boolean;
  onSelect: (menu: MenuDto) => void;
  onBack: () => void;
}) {
  const t = useT();
  const [menus, setMenus] = useState<MenuDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  const [name, setName] = useState('');
  const [renameId, setRenameId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setMenus(await api<MenuDto[]>(`/menus?restaurantId=${restaurant.id}`));
    } catch (err) {
      setError(
        err instanceof Error ? err.message : translate('views.menus.loadFailed'),
      );
    } finally {
      setLoading(false);
    }
  }, [restaurant.id]);

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
        err instanceof Error ? err.message : t('views.menus.operationFailed'),
      );
    } finally {
      setBusy(false);
    }
  };

  const create = () =>
    run(async () => {
      await api('/menus', {
        method: 'POST',
        body: JSON.stringify({ name, restaurantId: restaurant.id }),
      });
      setName('');
    }, t('views.menus.created'));

  const rename = (id: number) =>
    run(async () => {
      await api(`/menus/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ newName: renameValue }),
      });
      setRenameId(null);
    }, t('views.menus.renamed'));

  const remove = (id: number) =>
    run(() => api(`/menus/${id}`, { method: 'DELETE' }), t('views.menus.deactivated'));

  return (
    <div className="view">
      <header className="view-header">
        <div>
          <button className="btn btn-ghost btn-sm" onClick={onBack}>
            {t('views.menus.back')}
          </button>
          <h1>{t('views.menus.title', { name: restaurant.name })}</h1>
        </div>
        <button className="btn btn-ghost" onClick={() => void load()}>
          {t('views.menus.refresh')}
        </button>
      </header>

      {error && <ErrorBanner message={error} onClose={() => setError('')} />}
      {success && (
        <SuccessBanner message={success} onClose={() => setSuccess('')} />
      )}

      {canManage && (
        <CollapsibleForm title={t('views.menus.addTitle')} onSubmit={create} busy={busy}>
          <label>
            {t('views.menus.nameLatin')}
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
            />
          </label>
        </CollapsibleForm>
      )}

      {loading ? (
        <div className="empty">{t('views.menus.loading')}</div>
      ) : menus.length === 0 ? (
        <div className="empty">{t('views.menus.empty')}</div>
      ) : (
        <div className="card table-card">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>{t('views.menus.name')}</th>
                <th className="actions-col">{t('views.menus.actions')}</th>
              </tr>
            </thead>
            <tbody>
              {menus.map((m) => (
                <tr key={m.id}>
                  <td className="muted">#{m.id}</td>
                  <td>
                    {canManage && renameId === m.id ? (
                      <div className="inline-form">
                        <input
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                        />
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => void rename(m.id)}
                        >
                          {t('views.menus.ok')}
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => setRenameId(null)}
                        >
                          {t('views.menus.cancel')}
                        </button>
                      </div>
                    ) : (
                      m.name
                    )}
                  </td>
                  <td className="actions-col">
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => onSelect(m)}
                    >
                      {t('views.menus.dishesLink')}
                    </button>
                    {canManage && (
                      <>
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            setRenameId(m.id);
                            setRenameValue(m.name);
                          }}
                        >
                          {t('views.menus.rename')}
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => void remove(m.id)}
                          disabled={busy}
                        >
                          {t('views.menus.delete')}
                        </button>
                      </>
                    )}
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
