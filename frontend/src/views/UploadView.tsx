import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api';
import {
  ALL_ROLES,
  DOCUMENT_TYPES,
  MAX_UPLOAD_BYTES,
  UPLOAD_EXTENSIONS,
} from '../types';
import type { DocumentType, Role } from '../types';
import { ErrorBanner, SuccessBanner, roleLabel } from '../ui';

const LANGUAGES = ['ru', 'en', 'de'];

const formatSize = (bytes: number): string =>
  bytes < 1024 * 1024
    ? `${Math.ceil(bytes / 1024)} КБ`
    : `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;

export default function UploadView() {
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [documentType, setDocumentType] = useState<DocumentType>('USER');
  const [roles, setRoles] = useState<Role[]>([]);
  const [language, setLanguage] = useState('ru');
  const [documentId, setDocumentId] = useState('');
  const [documentVersion, setDocumentVersion] = useState(1);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const toggleRole = (role: Role) =>
    setRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    );

  const validate = (): string => {
    if (!file) return 'Выберите файл';

    const name = file.name.toLowerCase();

    if (!UPLOAD_EXTENSIONS.some((ext) => name.endsWith(ext))) {
      return `Допустимые форматы: ${UPLOAD_EXTENSIONS.join(', ')}`;
    }

    if (file.size === 0) return 'Файл пустой';

    if (file.size > MAX_UPLOAD_BYTES) {
      return `Файл больше ${formatSize(MAX_UPLOAD_BYTES)} (сейчас ${formatSize(file.size)})`;
    }

    if (roles.length === 0) return 'Выберите хотя бы одну роль';

    if (!documentId.trim()) return 'Укажите documentId';

    if (!Number.isInteger(documentVersion) || documentVersion < 1) {
      return 'Версия должна быть целым числом от 1';
    }

    return '';
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();

    if (busy) return;

    setError('');
    setSuccess('');

    const problem = validate();

    if (problem || !file) {
      setError(problem);

      return;
    }

    // Поля строго по IngestDocumentDto: лишние поля backend отклонит (400).
    const body = new FormData();

    body.append('documentType', documentType);
    // allowedRoles: каждая роль отдельным полем, backend соберёт массив.
    roles.forEach((r) => body.append('allowedRoles', r));
    body.append('language', language);
    body.append('documentVersion', String(documentVersion));
    body.append('documentId', documentId.trim());
    body.append('file', file);

    setBusy(true);

    try {
      await api('/ingestion/upload', { method: 'POST', body });

      setSuccess(
        `Документ «${documentId.trim()}» версии ${documentVersion} загружен в базу знаний`,
      );
      setFile(null);
      setFileKey((k) => k + 1);
      setDocumentId('');
      setDocumentVersion(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось загрузить');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="view">
      <header className="view-header">
        <h1>Загрузка документа</h1>
      </header>

      {error && <ErrorBanner message={error} onClose={() => setError('')} />}

      {success && (
        <SuccessBanner message={success} onClose={() => setSuccess('')} />
      )}

      <details className="card" style={{ padding: 16, marginBottom: 16 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
          Как подготовить документ
        </summary>

        <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
          <div>
            <b>Права и тип задаются в форме, а не в файле.</b> Всё, что написано
            в тексте документа (в том числе «Роль: CUSTOMER»), на доступ не
            влияет: доступ определяют поля формы ниже.
          </div>

          <div>
            <b>Формат:</b> {UPLOAD_EXTENSIONS.join(', ')}, не больше{' '}
            {formatSize(MAX_UPLOAD_BYTES)}. Перед индексацией документ проходит
            проверку безопасности: небезопасный отклоняется и уходит в карантин.
          </div>

          <div>
            <b>Версии:</b> тот же documentId с версией выше заменяет документ,
            старая версия уходит в архив. Та же или меньшая версия отклоняется.
          </div>

          <div>
            <b>Типы:</b> AUTH — вход и сессии, USER — правила клиента,
            RESTAURANT — рестораны, MENU — меню и блюда, DELIVERY — доставка и
            курьеры, ORDER — заказы и статусы, SYSTEM — общие правила сервиса.
          </div>
        </div>
      </details>

      <form
        className="card"
        style={{ padding: 16, display: 'grid', gap: 12, maxWidth: 560 }}
        onSubmit={(e) => void submit(e)}
      >
        <label style={{ display: 'grid', gap: 4 }}>
          Файл
          <input
            key={fileKey}
            type="file"
            accept={UPLOAD_EXTENSIONS.join(',')}
            disabled={busy}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>

        <label style={{ display: 'grid', gap: 4 }}>
          Тип документа
          <select
            value={documentType}
            disabled={busy}
            onChange={(e) => setDocumentType(e.target.value as DocumentType)}
          >
            {DOCUMENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>

        <fieldset
          style={{ border: 'none', padding: 0, margin: 0 }}
          disabled={busy}
        >
          <legend style={{ marginBottom: 4 }}>Кто видит документ в чате</legend>

          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {ALL_ROLES.map((r) => (
              <label
                key={r}
                style={{ display: 'flex', gap: 6, alignItems: 'center' }}
              >
                <input
                  type="checkbox"
                  checked={roles.includes(r)}
                  onChange={() => toggleRole(r)}
                />
                {roleLabel(r)}
              </label>
            ))}
          </div>
        </fieldset>

        <label style={{ display: 'grid', gap: 4 }}>
          Язык
          <select
            value={language}
            disabled={busy}
            onChange={(e) => setLanguage(e.target.value)}
          >
            {LANGUAGES.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: 'grid', gap: 4 }}>
          documentId
          <input
            value={documentId}
            disabled={busy}
            onChange={(e) => setDocumentId(e.target.value)}
            placeholder="например, 02_C_G"
            required
          />
          <small className="muted">
            Уникальный код документа (не файла). Один документ — один ID
            навсегда, разные документы — разные ID. Если указать ID, который уже
            есть в базе знаний, это обновление: новая версия заменит старую.
          </small>
        </label>

        <label style={{ display: 'grid', gap: 4 }}>
          Версия
          <input
            type="number"
            min={1}
            step={1}
            value={documentVersion}
            disabled={busy}
            onChange={(e) => setDocumentVersion(Number(e.target.value))}
            required
          />
          <small className="muted">
            Целое число от 1. Новый документ — 1. При обновлении того же ID
            ставьте версию больше текущей (была 1 — загружайте 2). Если версия
            не больше загруженной, система откажет, чтобы не затереть свежий
            текст старым. Старая версия сохраняется в архиве.
          </small>
        </label>

        <div>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? 'Проверка и индексация…' : 'Загрузить'}
          </button>
        </div>

        {busy && (
          <div className="muted">
            Документ проверяется и индексируется, это может занять до минуты. Не
            закрывайте страницу и не нажимайте повторно.
          </div>
        )}
      </form>
    </div>
  );
}
