import { useState } from 'react';
import type { FormEvent } from 'react';
import { api } from '../api';
import { translate, useT } from '../i18n';
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
    ? `${Math.ceil(bytes / 1024)} ${translate('views.upload.kb')}`
    : `${(bytes / (1024 * 1024)).toFixed(1)} ${translate('views.upload.mb')}`;

export default function UploadView() {
  const t = useT();
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
    if (!file) return t('views.upload.selectFile');

    const name = file.name.toLowerCase();

    if (!UPLOAD_EXTENSIONS.some((ext) => name.endsWith(ext))) {
      return t('views.upload.allowedFormats', {
        formats: UPLOAD_EXTENSIONS.join(', '),
      });
    }

    if (file.size === 0) return t('views.upload.emptyFile');

    if (file.size > MAX_UPLOAD_BYTES) {
      return t('views.upload.tooLarge', {
        max: formatSize(MAX_UPLOAD_BYTES),
        size: formatSize(file.size),
      });
    }

    if (roles.length === 0) return t('views.upload.selectRole');

    if (!documentId.trim()) return t('views.upload.requireDocumentId');

    if (!Number.isInteger(documentVersion) || documentVersion < 1) {
      return t('views.upload.requireVersion');
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
        t('views.upload.success', {
          id: documentId.trim(),
          version: documentVersion,
        }),
      );
      setFile(null);
      setFileKey((k) => k + 1);
      setDocumentId('');
      setDocumentVersion(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('views.upload.uploadFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="view">
      <header className="view-header">
        <h1>{t('views.upload.title')}</h1>
      </header>

      {error && <ErrorBanner message={error} onClose={() => setError('')} />}

      {success && (
        <SuccessBanner message={success} onClose={() => setSuccess('')} />
      )}

      <details className="card" style={{ padding: 16, marginBottom: 16 }}>
        <summary style={{ cursor: 'pointer', fontWeight: 600 }}>
          {t('views.upload.prepareTitle')}
        </summary>

        <div style={{ marginTop: 12, display: 'grid', gap: 8 }}>
          <div>
            <b>{t('views.upload.permissionsTitle')}</b>{' '}
            {t('views.upload.permissionsText')}
          </div>

          <div>
            <b>{t('views.upload.formatLabel')}</b>{' '}
            {UPLOAD_EXTENSIONS.join(', ')},{' '}
            {t('views.upload.formatLimit', {
              size: formatSize(MAX_UPLOAD_BYTES),
            })}
          </div>

          <div>
            <b>{t('views.upload.versionsLabel')}</b>{' '}
            {t('views.upload.versionsText')}
          </div>

          <div>
            <b>{t('views.upload.typesLabel')}</b> {t('views.upload.typesText')}
          </div>
        </div>
      </details>

      <form
        className="card"
        style={{ padding: 16, display: 'grid', gap: 12, maxWidth: 560 }}
        onSubmit={(e) => void submit(e)}
      >
        <label style={{ display: 'grid', gap: 4 }}>
          {t('views.upload.file')}
          <input
            key={fileKey}
            type="file"
            accept={UPLOAD_EXTENSIONS.join(',')}
            disabled={busy}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>

        <label style={{ display: 'grid', gap: 4 }}>
          {t('views.upload.documentType')}
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
          <legend style={{ marginBottom: 4 }}>
            {t('views.upload.whoSees')}
          </legend>

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
          {t('views.upload.language')}
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
            placeholder={t('views.upload.idPlaceholder')}
            required
          />
          <small className="muted">{t('views.upload.idHint')}</small>
        </label>

        <label style={{ display: 'grid', gap: 4 }}>
          {t('views.upload.version')}
          <input
            type="number"
            min={1}
            step={1}
            value={documentVersion}
            disabled={busy}
            onChange={(e) => setDocumentVersion(Number(e.target.value))}
            required
          />
          <small className="muted">{t('views.upload.versionHint')}</small>
        </label>

        <div>
          <button className="btn btn-primary" type="submit" disabled={busy}>
            {busy ? t('views.upload.busy') : t('views.upload.submit')}
          </button>
        </div>

        {busy && (
          <div className="muted">{t('views.upload.busyNote')}</div>
        )}
      </form>
    </div>
  );
}
