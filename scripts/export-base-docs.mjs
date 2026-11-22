// Выгрузка базовых документов базы знаний из Qdrant в локальные файлы.
//
// Исходников этих документов в репозитории нет: папка docs/knowledge-base в
// .gitignore, а документы загружали через админку. Текст берётся из уже
// загруженных точек: по documentId собираются чанки, перекрытие вырезается,
// «Вопрос:» и «Ответ:» разносятся по строкам.
//
// Скрипт нужен, чтобы править такие документы точечно: без него в рабочем
// каталоге нет ни файла, ни строки, которую можно поправить.
//
// Запуск (Node 18+): node scripts/export-base-docs.mjs
//
// Необязательные переменные:
//   EXPORT_LANG   язык выгружаемых документов (по умолчанию 'ru')
//   EXPORT_DIR    папка внутри docs/knowledge-base (по умолчанию 'base')
//   ADD_TO_MANIFEST=1  добавить записи в manifest.json (по умолчанию включено)
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import './load-env.mjs';

const DIR = process.env.DOCS_DIR ?? 'docs/knowledge-base';
const MANIFEST = path.join(DIR, 'manifest.json');
const LANG = (process.env.EXPORT_LANG ?? 'ru').toLowerCase();
const EXPORT_DIR = process.env.EXPORT_DIR ?? 'base';
const ADD_TO_MANIFEST = process.env.ADD_TO_MANIFEST !== '0';

const headers = {
  'Content-Type': 'application/json',
  ...(process.env.QDRANT_API_KEY
    ? { 'api-key': process.env.QDRANT_API_KEY }
    : {}),
};

const response = await fetch(
  `${process.env.QDRANT_URL}/collections/${process.env.KNOWLEDGE_DB_COLLECTION_NAME}/points/scroll`,
  {
    method: 'POST',
    headers,
    body: JSON.stringify({
      limit: 2000,
      with_payload: true,
      with_vector: false,
    }),
  },
);

const points = (await response.json()).result?.points ?? [];

const byId = new Map();
for (const point of points) {
  const payload = point.payload ?? {};
  const id = payload.documentId;
  if (!id) continue;
  if (!byId.has(id)) byId.set(id, []);
  byId.get(id).push(payload);
}

/** Склеивает перекрывающиеся чанки в один текст. */
function mergeChunks(chunks) {
  const sorted = [...chunks].sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const parts = [];

  for (const chunk of sorted) {
    const text = (chunk.text ?? '').trim();
    if (!text) continue;

    const previous = parts[parts.length - 1];

    if (previous === undefined) {
      parts.push(text);
      continue;
    }

    let overlap = 0;
    const max = Math.min(previous.length, text.length);
    for (let len = max; len > 20; len -= 1) {
      if (previous.slice(-len) === text.slice(0, len)) {
        overlap = len;
        break;
      }
    }

    parts.push(overlap ? text.slice(overlap) : text);
  }

  return parts.join(' ');
}

/**
 * Имя документа по-человечески.
 *
 * Часть документов загружена под служебными id ('ca1', 'cm1'), поэтому имя
 * берётся из названия файла.
 */
function baseName(documentId, docTitle) {
  const fromTitle = (docTitle ?? '')
    .split(/[\\/]/)
    .pop()
    .replace(/\.[a-z]+$/i, '')
    .replace(/\s*\(\d+\)$/, '')
    .trim();

  if (!fromTitle) return documentId;

  return fromTitle.startsWith(documentId) ? documentId : fromTitle;
}

/** Раскладывает «Вопрос:» и «Ответ:» по отдельным строкам. */
function splitQuestions(text) {
  return text
    .replace(/\s+(?=Вопрос:)/g, '\n')
    .replace(/\s+(?=Ответ:)/g, '\n')
    .replace(/\s+(?=Frage:)/g, '\n')
    .replace(/\s+(?=Antwort:)/g, '\n')
    .trim();
}

const docs = [...byId.entries()]
  .filter(([id]) => !id.startsWith('catalog-') && !id.startsWith('restaurants-list'))
  .map(([id, chunks]) => {
    const first = chunks[0];
    return {
      id,
      base: baseName(id, first.docTitle),
      language: first.language,
      documentType: first.documentType,
      allowedRoles: first.allowedRoles ?? ['ADMIN'],
      version: first.documentVersion,
      text: mergeChunks(chunks),
    };
  })
  .filter((doc) => doc.language === LANG)
  .sort((a, b) => a.id.localeCompare(b.id));

console.log(`Документов на языке ${LANG}: ${docs.length}`);

await mkdir(path.join(DIR, EXPORT_DIR), { recursive: true });

const manifest = JSON.parse(await readFile(MANIFEST, 'utf-8'));
const version = Math.floor(Date.now() / 1000);
const added = [];

for (const doc of docs) {
  const fileName = `${doc.base}.txt`;
  const filePath = path.join(DIR, EXPORT_DIR, fileName);

  await writeFile(filePath, `${splitQuestions(doc.text)}\n`, 'utf-8');
  console.log(`  ${filePath} (был ver=${doc.version})`);

  if (!ADD_TO_MANIFEST) continue;

  const entry = {
    file: `${EXPORT_DIR}/${fileName}`,
    documentType: doc.documentType,
    allowedRoles: doc.allowedRoles,
    language: doc.language,
    documentId: doc.base,
    documentVersion: version,
  };

  const existing = manifest.findIndex((item) => item.documentId === doc.base);
  if (existing >= 0) {
    manifest[existing] = entry;
  } else {
    manifest.push(entry);
  }

  added.push(doc.base);
}

if (ADD_TO_MANIFEST) {
  await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
  console.log(`\nВ манифест добавлено: ${added.length} (версия ${version})`);
}
