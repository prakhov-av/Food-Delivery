// Загрузка документов из manifest.json через POST /ingestion/upload.
//
// Настройки берутся из переменных окружения или из файла .env в корне проекта
// (другой файл: $env:ENV_FILE = '.env.prod'). Переменные окружения важнее файла.
// Ключи файла: ADMIN_EMAIL, ADMIN_PASSWORD, BASE_URL, ORIGIN, DOCS_DIR.
// Пример .env:
//   ADMIN_EMAIL=почта_админа
//   ADMIN_PASSWORD=пароль
//   BASE_URL=https://<backend>
//   ORIGIN=https://<frontend>
// Файл с паролем должен быть в .gitignore, не коммитьте его.
//
// Запуск (Node 18+): node scripts/upload-knowledge.mjs
//
// Необязательные переменные (только из окружения, в файл их не кладут):
//   ONLY_PREFIX  загружать только документы, documentId которых начинается с этой строки
//                (например 'catalog-' или 'catalog-tokyo-roll'). Пусто: все документы манифеста.
//   DRY_RUN=1    только показать, что будет загружено и куда; без входа и без запросов.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import './load-env.mjs';

const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
const ORIGIN = process.env.ORIGIN ?? 'http://localhost:5173';
const DIR = process.env.DOCS_DIR ?? 'docs/knowledge-base';
const EMAIL = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;
const PREFIX = process.env.ONLY_PREFIX ?? '';
const DRY_RUN = process.env.DRY_RUN === '1';

const MIME = {
  '.txt': 'text/plain',
  '.pdf': 'application/pdf',
  '.docx':
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

const manifest = JSON.parse(
  await readFile(path.join(DIR, 'manifest.json'), 'utf-8'),
);

const queue = manifest.filter((doc) =>
  String(doc.documentId ?? '').startsWith(PREFIX),
);

if (queue.length === 0) {
  console.error(
    `Нет документов для загрузки (ONLY_PREFIX='${PREFIX}', в манифесте ${manifest.length}).`,
  );
  process.exit(1);
}

console.log(`Цель загрузки: ${BASE_URL}`);
console.log(`Документов к загрузке: ${queue.length} из ${manifest.length}`);

if (DRY_RUN) {
  for (const doc of queue) {
    console.log(`  ${doc.documentId} (версия ${doc.documentVersion ?? 1}): ${doc.file}`);
  }

  console.log('\nDRY_RUN: ничего не отправлено.');
  process.exit(0);
}

if (!EMAIL || !PASSWORD) {
  console.error(
    'Задайте ADMIN_EMAIL и ADMIN_PASSWORD в переменных окружения или в файле .env.',
  );
  process.exit(1);
}

// Origin нужен CSRF-проверке бэкенда: адрес должен быть в CORS_ORIGINS.
const login = await fetch(`${BASE_URL}/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Origin: ORIGIN },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
});

if (!login.ok) {
  console.error(`Вход не удался: ${login.status} ${await login.text()}`);
  process.exit(1);
}

const cookie = login.headers
  .getSetCookie()
  .map((c) => c.split(';')[0])
  .join('; ');

let ok = 0;
const failed = [];

for (const doc of queue) {
  const buffer = await readFile(path.join(DIR, doc.file));
  const type = MIME[path.extname(doc.file).toLowerCase()] ?? 'text/plain';

  const form = new FormData();
  form.append('documentType', doc.documentType);
  doc.allowedRoles.forEach((role) => form.append('allowedRoles', role));
  form.append('language', doc.language ?? 'ru');
  form.append('documentVersion', String(doc.documentVersion ?? 1));
  form.append('documentId', doc.documentId);
  form.append('file', new Blob([buffer], { type }), path.basename(doc.file));

  const res = await fetch(`${BASE_URL}/ingestion/upload`, {
    method: 'POST',
    headers: { Cookie: cookie, Origin: ORIGIN },
    body: form,
  });

  if (res.ok) {
    ok += 1;
    console.log(`OK      ${doc.file}`);
  } else {
    const text = (await res.text()).slice(0, 200);
    failed.push(doc.file);
    console.log(`FAILED  ${doc.file}: ${res.status} ${text}`);
  }
}

console.log(`\nЗагружено: ${ok} из ${queue.length}`);

if (failed.length > 0) {
  console.log(`Не загружены: ${failed.join(', ')}`);
  process.exit(1);
}
