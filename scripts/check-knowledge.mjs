// Состояние базы знаний: что в основной коллекции, что в архиве и что
// расходится с локальными файлами.
//
// Запуск (Node 18+): node scripts/check-knowledge.mjs
//
// Необязательные переменные:
//   ONLY_IDS  показывать только эти documentId (через запятую)
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import './load-env.mjs';

const DIR = process.env.DOCS_DIR ?? 'docs/knowledge-base';

const headers = {
  'Content-Type': 'application/json',
  ...(process.env.QDRANT_API_KEY
    ? { 'api-key': process.env.QDRANT_API_KEY }
    : {}),
};

async function scroll(collection) {
  const response = await fetch(
    `${process.env.QDRANT_URL}/collections/${collection}/points/scroll`,
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

  const json = await response.json();

  if (!response.ok) {
    throw new Error(
      `${collection}: HTTP ${response.status} ${JSON.stringify(json).slice(0, 200)}`,
    );
  }

  return json.result?.points ?? [];
}

function group(points) {
  const map = new Map();

  for (const point of points) {
    const payload = point.payload ?? {};
    const id = payload.documentId ?? '(без documentId)';

    if (!map.has(id)) {
      map.set(id, {
        language: payload.language,
        version: payload.documentVersion,
        type: payload.documentType,
        title: payload.docTitle,
        chunks: 0,
        texts: [],
      });
    }

    const entry = map.get(id);
    entry.chunks += 1;
    entry.texts.push(payload.text ?? '');
  }

  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}

const main = group(await scroll(process.env.KNOWLEDGE_DB_COLLECTION_NAME));
const archive = group(await scroll(process.env.ARCHIVE_DB_COLLECTION_NAME));

const only = new Set(
  (process.env.ONLY_IDS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0),
);

const filter = (id) => only.size === 0 || only.has(id);

console.log(
  `\n=== ${process.env.KNOWLEDGE_DB_COLLECTION_NAME}: ${main.length} документов ===`,
);
for (const [id, info] of main) {
  if (!filter(id)) continue;
  console.log(
    `${id} | ver=${info.version} | ${info.language} | ${info.type} | частей=${info.chunks}`,
  );
}

console.log(
  `\n=== ${process.env.ARCHIVE_DB_COLLECTION_NAME}: ${archive.length} документов (старые версии) ===`,
);
for (const [id, info] of archive) {
  if (!filter(id)) continue;
  console.log(
    `${id} | ver=${info.version} | ${info.language} | ${info.type} | частей=${info.chunks}`,
  );
}

// Локальные файлы против содержимого базы: так видно, какие документы
// загружены в старой версии или не загружены вовсе.
let manifest = [];

try {
  manifest = JSON.parse(await readFile(path.join(DIR, 'manifest.json'), 'utf-8'));
} catch {
  console.log('\nmanifest.json не найден — проверка локальных файлов пропущена.');
}

if (manifest.length > 0) {
  const mainMap = new Map(main);
  const outdated = [];
  const missing = [];

  for (const doc of manifest) {
    if (!filter(doc.documentId)) continue;

    const entry = mainMap.get(doc.documentId);

    if (!entry) {
      missing.push(doc.documentId);
      continue;
    }

    const local = (
      await readFile(path.join(DIR, doc.file), 'utf-8')
    ).replace(/\s+/g, ' ');

    const inDb = entry.texts.every((text) =>
      local.includes(text.replace(/\s+/g, ' ').trim()),
    );

    if (!inDb) outdated.push(doc.documentId);
  }

  console.log(
    `\nЛокальных документов в манифесте: ${manifest.length}, ` +
      `устарело в базе: ${outdated.length}, отсутствует в базе: ${missing.length}`,
  );
  if (outdated.length > 0) console.log(`устарело: ${outdated.join(', ')}`);
  if (missing.length > 0) console.log(`отсутствует: ${missing.join(', ')}`);
}

// Документы в базе, которых нет в манифесте: обычно это загруженные
// вручную файлы со служебным documentId.
const manifestIds = new Set(manifest.map((doc) => doc.documentId));
const orphans = main
  .map(([id]) => id)
  .filter((id) => manifest.length > 0 && !manifestIds.has(id));

if (orphans.length > 0) {
  console.log(`\nне в манифесте (загружены вручную или со служебным id): ${orphans.join(', ')}`);
}
