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
//   ONLY_IDS    загружать только документы с перечисленными documentId через запятую
//                (например 'catalog-cuisines-en,catalog-cuisines-de'). Можно совмещать с ONLY_PREFIX.
//   DRY_RUN=1    только показать, что будет загружено и куда; без входа и без запросов.
//   UPLOAD_DELAY_MS  пауза между документами, мс (по умолчанию 400).
//   UPLOAD_ATTEMPTS сколько попыток на документ при временной ошибке (по умолчанию 3).
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

/**
 * Список documentId для точной догрузки.
 *
 * Префикс выбирает целое семейство документов, а перечисление — конкретные
 * файлы. Это нужно, чтобы дозагрузить несколько документов, не перезаливая
 * весь каталог: каждый лишний документ — это запросы к модели и риск упереться
 * в лимит провайдера.
 */
const ONLY_IDS = (process.env.ONLY_IDS ?? '')
  .split(',')
  .map((id) => id.trim())
  .filter((id) => id.length > 0);

/**
 * Пауза между документами.
 *
 * Каждая загрузка делает два запроса к модели (проверка безопасности и
 * эмбеддинги). Без паузы сорок документов подряд упираются в лимит
 * провайдера, и часть запросов падает.
 */
const DELAY_MS = Number(process.env.UPLOAD_DELAY_MS ?? 400);

/** Сколько попыток на один документ при временной ошибке. */
const ATTEMPTS = Number(process.env.UPLOAD_ATTEMPTS ?? 3);

/** Пауза перед повторной попыткой, мс. */
const RETRY_DELAYS_MS = [2000, 5000];

/**
 * Коды, при которых запрос повторяют: лимит провайдера и его перегрузка.
 *
 * 400 тоже повторяется: провайдер изредка отвечает на корректный запрос
 * проверки безопасности разовым 400, и без повтора документ просто выпадал
 * из загрузки. Повтор здесь безопасен: запрос отправляется целиком заново.
 */
const RETRYABLE = new Set([400, 408, 429, 500, 502, 503, 504]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));


const MIME = {
  '.txt': 'text/plain',
  '.pdf': 'application/pdf',
  '.docx':
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};

const manifest = JSON.parse(
  await readFile(path.join(DIR, 'manifest.json'), 'utf-8'),
);

const queue = manifest.filter((doc) => {
  const id = String(doc.documentId ?? '');

  if (PREFIX && !id.startsWith(PREFIX)) {
    return false;
  }

  if (ONLY_IDS.length > 0 && !ONLY_IDS.includes(id)) {
    return false;
  }

  return true;
});

if (queue.length === 0) {
  console.error(
    `Нет документов для загрузки (ONLY_PREFIX='${PREFIX}', ONLY_IDS='${ONLY_IDS.join(',')}', в манифесте ${manifest.length}).`,
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

  // Повторяем при временной ошибке: backend отдаёт 500, когда провайдер
  // упёрся в лимит запросов, и документ вполне загружается со второй попытки.
  let res = null;
  let lastStatus = 0;
  let lastText = '';

  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    res = await fetch(`${BASE_URL}/ingestion/upload`, {
      method: 'POST',
      headers: { Cookie: cookie, Origin: ORIGIN },
      body: form,
    });

    if (res.ok) break;

    lastStatus = res.status;
    lastText = (await res.text()).slice(0, 200);

    if (!RETRYABLE.has(res.status) || attempt === ATTEMPTS) break;

    const delay = RETRY_DELAYS_MS[attempt - 1] ?? 2000;
    console.log(
      `  попытка ${attempt} не удалась: ${res.status}, повтор через ${delay}ms`,
    );
    await sleep(delay);
  }

  if (res.ok) {
    ok += 1;
    console.log(`OK      ${doc.file}`);
  } else {
    failed.push(doc.file);
    console.log(`FAILED  ${doc.file}: ${lastStatus} ${lastText}`);
  }

  if (DELAY_MS > 0) await sleep(DELAY_MS);
}

console.log(`\nЗагружено: ${ok} из ${queue.length}`);

if (failed.length > 0) {
  console.log(`Не загружены: ${failed.join(', ')}`);
  process.exit(1);
}
