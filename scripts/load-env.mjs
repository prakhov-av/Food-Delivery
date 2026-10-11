// Подхватывает настройки скриптов из .env (или из файла, указанного в ENV_FILE).
// Работает на Node 18+, без зависимостей.
//
// Читаются только ключи из списка KEYS: остальное содержимое .env (ключи БД,
// Qdrant, LLM) скриптам не нужно, оно не загружается.
// Переменные, уже заданные в окружении ($env:...), имеют приоритет над файлом.
import { readFileSync } from 'node:fs';

const KEYS = ['ADMIN_EMAIL', 'ADMIN_PASSWORD', 'BASE_URL', 'ORIGIN', 'DOCS_DIR'];
const file = process.env.ENV_FILE ?? '.env';

let content;

try {
  content = readFileSync(file, 'utf-8');
} catch (error) {
  if (error.code !== 'ENOENT') {
    console.error(`Не удалось прочитать ${file}: ${error.message}`);
    process.exit(1);
  }

  if (process.env.ENV_FILE) {
    console.error(`Файл ${file} (ENV_FILE) не найден.`);
    process.exit(1);
  }
}

if (content !== undefined) {
  for (const rawLine of content.replace(/^\uFEFF/, '').split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith('#')) continue;

    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);

    if (!match) continue;

    const [, key, rawValue] = match;

    if (!KEYS.includes(key) || process.env[key] !== undefined) continue;

    let value = rawValue.trim();
    const quote = value[0];

    if ((quote === '"' || quote === "'") && value.length >= 2 && value.endsWith(quote)) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/, '');
    }

    process.env[key] = value;
  }

  console.log(`Настройки прочитаны из ${file}`);
}
