// Перевод базовых документов базы знаний на английский и немецкий.
//
// Источник: тексты базовых документов, уже загруженных в Qdrant (в рабочем
// каталоге их исходников нет: папка docs/knowledge-base в .gitignore).
// Скрипт собирает текст из чанков по documentId, переводит его и кладёт
// результат в docs/knowledge-base/<lang>/, затем добавляет записи в
// manifest.json, чтобы их можно было загрузить тем же upload-knowledge.mjs.
//
// Запуск (Node 18+): node scripts/translate-base-docs.mjs
//
// Необязательные переменные (только из окружения):
//   PROVIDER       openai (по умолчанию) или gemini — чем переводить
//   TARGET_LANGS   языки через запятую (по умолчанию 'en,de')
//   TRANSLATE_DELAY_MS  пауза между запросами к модели, мс (по умолчанию 2500)
//   TRANSLATE_ATTEMPTS сколько попыток при временной ошибке (по умолчанию 3)
//   FORCE=1        перевести заново, даже если файл уже есть
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import './load-env.mjs';

const DIR = process.env.DOCS_DIR ?? 'docs/knowledge-base';
const MANIFEST = path.join(DIR, 'manifest.json');
const PROVIDER = (process.env.PROVIDER ?? 'openai').toLowerCase();
const TARGET_LANGS = (process.env.TARGET_LANGS ?? 'en,de')
  .split(',')
  .map((l) => l.trim().toLowerCase())
  .filter((l) => l.length > 0);
const DELAY_MS = Number(process.env.TRANSLATE_DELAY_MS ?? 2500);
const ATTEMPTS = Number(process.env.TRANSLATE_ATTEMPTS ?? 3);
const FORCE = process.env.FORCE === '1';

const LANG_NAMES = {
  en: 'English',
  de: 'German',
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Склеивает перекрывающиеся чанки документа в исходный текст.
 *
 * Чанки идут с перекрытием, поэтому общий кусок вырезается, а граница чанков
 * сохраняется разделителем: так в переводе не пропадает структура.
 */
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

  return parts.join('\n\n');
}

async function scrollCollection() {
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

  const json = await response.json();

  if (!response.ok) {
    throw new Error(
      `Qdrant вернул ${response.status}: ${JSON.stringify(json).slice(0, 200)}`,
    );
  }

  return json.result?.points ?? [];
}

const TRANSLATE_PROMPT = (langName) => `Translate the text below from Russian into ${langName}.

Rules:
- Translate everything, keep the meaning exact.
- Keep the structure: headings, numbering and the order of the parts.
- Keep the names of restaurants, dishes, roles, statuses, fields and technical terms as they are.
- Keep the currency and the format of prices as they are.
- Do not add, remove or comment on anything. Output only the translation.
- Write plain text, without markdown.

Text:

`;

async function translate(text, langName) {
  const body =
    PROVIDER === 'gemini'
      ? {
          contents: [
            {
              parts: [{ text: TRANSLATE_PROMPT(langName) + text }],
            },
          ],
          generationConfig: { temperature: 0 },
        }
      : {
          model: process.env.OPENAI_MODEL ?? 'gpt-4.1-mini',
          input: TRANSLATE_PROMPT(langName) + text,
        };

  const url =
    PROVIDER === 'gemini'
      ? (process.env.GEMINI_API_URL ?? '').trim() +
        (process.env.GEMINI_API_KEY ?? '').trim()
      : process.env.OPENAI_API_URL;

  const headers =
    PROVIDER === 'gemini'
      ? { 'Content-Type': 'application/json' }
      : {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        };

  if (!url) {
    throw new Error('Нет адреса API провайдера в .env');
  }

  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const retryable = [408, 429, 500, 502, 503, 504].includes(
          response.status,
        );
        if (retryable && attempt < ATTEMPTS) {
          console.log(
            `    попытка ${attempt}: HTTP ${response.status}, повтор через ${attempt * 3000}ms`,
          );
          await sleep(attempt * 3000);
          continue;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const json = await response.json();
      const answer =
        PROVIDER === 'gemini'
          ? json?.candidates?.[0]?.content?.parts?.[0]?.text
          : json?.output?.[0]?.content?.[0]?.text;

      if (!answer) {
        throw new Error('Пустой ответ модели');
      }

      return answer.trim();
    } catch (error) {
      if (attempt === ATTEMPTS) throw error;
      console.log(`    попытка ${attempt}: ${error.message}, повтор`);
      await sleep(attempt * 3000);
    }
  }

  throw new Error('Не удалось перевести');
}

const points = await scrollCollection();

const byId = new Map();
for (const point of points) {
  const payload = point.payload ?? {};
  const id = payload.documentId;

  if (!id) continue;

  if (!byId.has(id)) byId.set(id, []);
  byId.get(id).push(payload);
}

/**
 * Имя документа по-человечески.
 *
 * Часть документов загружали под служебными id ('ca1', 'cm1'), поэтому имя
 * берётся из названия файла: иначе переводы получили бы бесполезные id
 * вроде 'ca1-en' и не совпали бы с остальными документами.
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

// Базовые документы — всё, что не каталог. Их documentId не начинается
// с 'catalog-' и не с 'restaurants-list' (в каталоге есть ru/en/de-версии
// списка ресторанов, они генерируются отдельно).
const baseDocs = [...byId.entries()]
  .filter(
    ([id]) =>
      !id.startsWith('catalog-') && !id.startsWith('restaurants-list'),
  )
  .map(([id, chunks]) => {
    const first = chunks[0];
    return {
      id,
      base: baseName(id, first.docTitle),
      language: first.language,
      documentType: first.documentType,
      allowedRoles: first.allowedRoles ?? ['ADMIN'],
      version: first.documentVersion,
      title: first.docTitle ?? id,
      text: mergeChunks(chunks),
    };
  })
  .sort((a, b) => a.id.localeCompare(b.id));

console.log(`Базовых документов в базе: ${baseDocs.length}`);

const manifest = JSON.parse(await readFile(MANIFEST, 'utf-8'));
const version = Math.floor(Date.now() / 1000);
const added = [];

for (const doc of baseDocs) {
  if (doc.language !== 'ru') {
    console.log(`  пропуск ${doc.id}: язык ${doc.language}, не переводим`);
    continue;
  }

  for (const lang of TARGET_LANGS) {
    const langName = LANG_NAMES[lang];

    if (!langName) {
      console.log(`  пропуск ${doc.id}: язык ${lang} не поддерживается`);
      continue;
    }

    const fileName = `${doc.base}-${lang}.txt`;
    const filePath = path.join(DIR, lang, fileName);
    const documentId = `${doc.base}-${lang}`;

    const exists = await readFile(filePath, 'utf-8').catch(() => null);
    if (exists && !FORCE) {
      console.log(`  есть ${documentId}, пропускаем`);
      continue;
    }

    console.log(`  перевод ${doc.id} -> ${langName}`);

    let translated;
    try {
      translated = await translate(doc.text, langName);
    } catch (error) {
      console.log(`  ОШИБКА ${documentId}: ${error.message}`);
      continue;
    }

    await mkdir(path.join(DIR, lang), { recursive: true });
    await writeFile(filePath, `${translated}\n`, 'utf-8');

    const existing = manifest.findIndex(
      (entry) => entry.documentId === documentId,
    );
    const entry = {
      file: `${lang}/${fileName}`,
      documentType: doc.documentType,
      allowedRoles: doc.allowedRoles,
      language: lang,
      documentId,
      documentVersion: version,
    };

    if (existing >= 0) {
      manifest[existing] = entry;
    } else {
      manifest.push(entry);
    }

    added.push(documentId);
    console.log(`  готово ${documentId} (${translated.length} символов)`);

    await sleep(DELAY_MS);
  }
}

await writeFile(MANIFEST, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');

console.log(`\nДобавлено документов: ${added.length} (версия ${version})`);
console.log('Незагруженные переводы лежат в docs/knowledge-base/en и /de.');

if (added.length > 0) {
  console.log('\nКоманда загрузки переводов:');
  console.log(
    `cmd /c "set DRY_RUN=& set ONLY_PREFIX=& set ONLY_IDS=${added.join(',')}& node scripts/upload-knowledge.mjs"`,
  );
}
