// Собирает документы базы знаний из каталога: рестораны, меню и блюда берутся из API,
// ничего не выдумывается. Скрипт только читает API (GET) и пишет локальные файлы.
//
// Настройки берутся из переменных окружения или из файла .env в корне проекта
// (другой файл: $env:ENV_FILE = '.env.prod'). Переменные окружения важнее файла.
// Ключи: ADMIN_EMAIL, ADMIN_PASSWORD, BASE_URL, ORIGIN, DOCS_DIR.
// Пример .env:
//   ADMIN_EMAIL=почта_админа
//   ADMIN_PASSWORD=пароль
//   BASE_URL=https://<backend>
//   ORIGIN=https://<frontend>
// Файл с паролем должен быть в .gitignore, не коммитьте его.
//
// Запуск (Node 18+): node scripts/generate-catalog-docs.mjs
//
// Результат: docs/knowledge-base/catalog/*.txt и обновлённый manifest.json.
// Затем загрузите их: node scripts/upload-knowledge.mjs
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import './load-env.mjs';

const BASE_URL = (process.env.BASE_URL ?? 'http://localhost:3000').replace(/\/+$/, '');
const ORIGIN = process.env.ORIGIN ?? 'http://localhost:5173';
const DIR = process.env.DOCS_DIR ?? 'docs/knowledge-base';
const EMAIL = process.env.ADMIN_EMAIL;
const PASSWORD = process.env.ADMIN_PASSWORD;

// Кухня ресторана для подсказок «что заказать». Указана по названию ресторана,
// проверьте и поправьте под свои данные. Рестораны без записи просто без кухни.
const CUISINES = {
  'Pizza House': 'пицца',
  Italiano: 'итальянская кухня',
  'Sushi Master': 'суши и роллы',
  'Tokyo Roll': 'роллы и японская кухня',
  'Burger Point': 'бургеры',
  'BBQ Factory': 'барбекю',
  'Steak House': 'стейки',
  'Healthy Food': 'здоровая еда',
  'Green Bowl': 'здоровая еда и боулы',
  'Coffee Time': 'кофе и десерты',
};

const ALL_ROLES = ['ADMIN', 'MANAGER', 'CUSTOMER', 'COURIER'];

if (!EMAIL || !PASSWORD) {
  console.error(
    'Задайте ADMIN_EMAIL и ADMIN_PASSWORD в переменных окружения или в файле .env.',
  );
  process.exit(1);
}

console.log(`Каталог читается с: ${BASE_URL}`);

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

// Пустой список на backend это 404, считаем его пустым массивом.
async function getList(pathAndQuery) {
  const res = await fetch(`${BASE_URL}${pathAndQuery}`, {
    headers: { Cookie: cookie, Origin: ORIGIN },
  });

  if (res.status === 404) return [];
  if (!res.ok) throw new Error(`${pathAndQuery}: ${res.status}`);

  return res.json();
}

// Цены в приложении показываются в евро (в базе те же числа).
const price = (value) =>
  Number(value).toLocaleString('ru-RU', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

const sentence = (text) => {
  const t = String(text ?? '').trim();

  return t ? t.replace(/[.!?]*$/, '.') : '';
};

const slugOf = (restaurant) =>
  restaurant.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || `restaurant-${restaurant.id}`;

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

const restaurants = await getList('/restaurants');

// Пустой каталог это почти наверняка ошибка (не тот адрес, нет данных).
// Не генерируем документы, чтобы потом не заменить хорошие версии пустыми.
if (restaurants.length === 0) {
  console.error('Список ресторанов пуст, остановка. Проверьте BASE_URL и данные.');
  process.exit(1);
}

const docs = [];

// 1. Меню каждого ресторана, где есть блюда.
for (const restaurant of restaurants) {
  const menus = await getList(`/menus?restaurantId=${restaurant.id}`);
  const sections = [];

  for (const menu of menus) {
    const items = await getList(`/menu-items?menuId=${menu.id}`);

    if (items.length === 0) continue;

    sections.push({ menu, items });
  }

  if (sections.length === 0) {
    console.log(`пропущен (нет блюд): ${restaurant.name}`);
    continue;
  }

  const cuisine = CUISINES[restaurant.name];
  const lines = [
    `Меню ресторана ${restaurant.name}`,
    '',
    `${restaurant.name}: ресторан${cuisine ? `, кухня: ${cuisine}` : ''}. Адрес: ${restaurant.address}. Телефон: ${restaurant.phone}.`,
    '',
  ];

  for (const { menu, items } of sections) {
    lines.push(
      sections.length > 1
        ? `Меню «${menu.name}» ресторана ${restaurant.name}. Цены указаны в евро:`
        : `Блюда меню ресторана ${restaurant.name}. Цены указаны в евро.`,
    );

    // Название ресторана в каждой строке: любой фрагмент после нарезки
    // остаётся самодостаточным и находится по запросу про этот ресторан.
    for (const item of items) {
      lines.push(
        `- ${restaurant.name}, ${item.name}: ${price(item.price)} €. ${sentence(item.description)}`.trim(),
      );
    }

    lines.push('');
  }

  docs.push({
    id: `catalog-${slugOf(restaurant)}`,
    type: 'MENU',
    text: lines.join('\n'),
  });
}

// 2. Список всех ресторанов.
const listLines = [
  'Список ресторанов',
  '',
  `Всего ресторанов: ${restaurants.length}.`,
  '',
  ...restaurants.map((r) => {
    const cuisine = CUISINES[r.name];

    return `${r.name}${cuisine ? ` (кухня: ${cuisine})` : ''}. Адрес: ${r.address}. Телефон: ${r.phone}. Email: ${r.email}.`;
  }),
];

docs.push({ id: 'restaurants-list', type: 'RESTAURANT', text: listLines.join('\n') });

// 3. Подсказка «что заказать»: рестораны по кухням.
const byCuisine = new Map();

for (const r of restaurants) {
  const cuisine = CUISINES[r.name];

  if (!cuisine) continue;

  byCuisine.set(cuisine, [...(byCuisine.get(cuisine) ?? []), r.name]);
}

const cuisineLines = [...byCuisine.entries()].map(
  ([cuisine, names]) => `${capitalize(cuisine)}: ${names.join(', ')}.`,
);

const hint =
  'Помощник в чате может подсказать, что заказать: достаточно написать, какая кухня или какое блюдо вам хочется, например пицца, суши, роллы, барбекю, итальянская кухня, бургеры, стейки, здоровая еда или кофе с десертом. Меню каждого ресторана открывается на вкладке «Рестораны» кнопкой «Меню».';

docs.push({
  id: 'catalog-cuisines',
  type: 'RESTAURANT',
  text: ['Какие рестораны есть по кухням', '', ...cuisineLines, '', hint].join('\n'),
});
docs.push({
  id: 'catalog-what-to-order',
  type: 'MENU',
  text: ['Что заказать: рестораны и кухни', '', ...cuisineLines, '', hint].join('\n'),
});

// 4. Запись файлов и обновление manifest.json.
const outDir = path.join(DIR, 'catalog');
await mkdir(outDir, { recursive: true });

const manifestPath = path.join(DIR, 'manifest.json');
let manifest = [];

try {
  manifest = JSON.parse(await readFile(manifestPath, 'utf-8'));
} catch (error) {
  // Нет файла это нормально. Любая другая ошибка (например, битый JSON):
  // останавливаемся, иначе записи базовых документов потерялись бы.
  if (error.code !== 'ENOENT') {
    console.error(`manifest.json не читается, остановка: ${error.message}`);
    process.exit(1);
  }
}

const generatedIds = new Set(docs.map((d) => d.id));

// Версия растёт при каждой генерации: тот же documentId с большей версией заменяет старый документ.
const version = Math.floor(Date.now() / 1000);

manifest = manifest.filter(
  (entry) =>
    !generatedIds.has(entry.documentId) &&
    !entry.documentId.startsWith('catalog-'),
);

for (const doc of docs) {
  const file = `catalog/${doc.id}.txt`;

  await writeFile(path.join(DIR, file), doc.text + '\n', 'utf-8');
  manifest.push({
    file,
    documentType: doc.type,
    allowedRoles: ALL_ROLES,
    language: 'ru',
    documentId: doc.id,
    documentVersion: version,
  });
  console.log(`создан: ${file}`);
}

await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
console.log(
  `\nГотово: ${docs.length} документов, версия ${version}. Теперь: node scripts/upload-knowledge.mjs`,
);
