// Проставляет language старым точкам Qdrant, у которых этого поля нет.
//
// Новые документы получают язык при загрузке, но точки, залитые до появления
// поля, лежат без него. Поиск с фильтром по языку их не видит: пользователь
// получает «нет информации» вместо документа.
//
// Скрипт идемпотентный: у точки с языком поле не меняется, поэтому его можно
// запускать повторно.
//
// Настройки: QDRANT_URL, KNOWLEDGE_DB_COLLECTION_NAME, QDRANT_API_KEY,
// DEFAULT_LANGUAGE (язык для точек без метаданных, по умолчанию ru).
//
// Запуск: node scripts/backfill-language.mjs
import './load-env.mjs';

const QDRANT_URL = (process.env.QDRANT_URL ?? 'http://localhost:6333').replace(
  /\/+$/,
  '',
);
const COLLECTION =
  process.env.KNOWLEDGE_DB_COLLECTION_NAME ?? 'food_delivery_knowledge';
const API_KEY = (process.env.QDRANT_API_KEY ?? '').trim();
const DEFAULT_LANGUAGE = (process.env.DEFAULT_LANGUAGE ?? 'ru').trim();

const BASE = `${QDRANT_URL}/collections/${COLLECTION}`;

const headers = {
  'Content-Type': 'application/json',
  ...(API_KEY ? { 'api-key': API_KEY } : {}),
};

async function post(path, body) {
  const response = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(
      `${path}: ${response.status} ${await response.text()}`,
    );
  }

  return response.json();
}

/**
 * Читает точки партиями по 256 и останавливается, когда страница кончилась.
 */
async function* readPoints() {
  let offset = null;

  do {
    const page = await post('/points/scroll', {
      limit: 256,
      with_payload: true,
      with_vector: false,
      offset,
    });

    const points = page?.result?.points ?? [];

    if (points.length === 0) {
      return;
    }

    yield points;

    offset = page?.result?.next_page_offset ?? null;
  } while (offset !== null);
}

async function main() {
  let total = 0;
  let patched = 0;

  for await (const points of readPoints()) {
    total += points.length;

    const withoutLanguage = points.filter(
      (point) =>
        !point?.payload ||
        typeof point.payload.language !== 'string' ||
        point.payload.language.length === 0,
    );

    if (withoutLanguage.length === 0) {
      continue;
    }

    await post('/points/payload', {
      payload: { language: DEFAULT_LANGUAGE },
      points: withoutLanguage.map((point) => point.id),
    });

    patched += withoutLanguage.length;

    console.log(`обработано: ${total}, проставлен язык: ${patched}`);
  }

  console.log(
    `\nГотово: точек ${total}, язык проставлен ${patched} (${DEFAULT_LANGUAGE}).`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
