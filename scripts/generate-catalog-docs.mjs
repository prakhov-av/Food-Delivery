// Собирает документы базы знаний из каталога: рестораны, меню и блюда берутся из API,
// ничего не выдумывается. Скрипт только читает API (GET) и пишет локальные файлы.
//
// Документы генерируются на трёх языках: русском, английском и немецком.
// У каждого языка свой documentId (суффикс -en/-de), чтобы языки не затирали друг
// друга: один documentId — это одна версия документа, а язык здесь версия.
//
// Настройки берутся из переменных окружения или из файла .env в корне проекта
// (другой файл: $env:ENV_FILE = '.env.prod'). Переменные окружения важнее файла.
// Ключи: ADMIN_EMAIL, ADMIN_PASSWORD, BASE_URL, ORIGIN, DOCS_DIR, ONLY_LANG.
// Пример .env:
//   ADMIN_EMAIL=почта_админа
//   ADMIN_PASSWORD=пароль
//   BASE_URL=https://<backend>
//   ORIGIN=https://<frontend>
// Файл с паролем должен быть в .gitignore, не коммитьте его.
//
// Запуск (Node 18+): node scripts/generate-catalog-docs.mjs
//
// Только один язык: $env:ONLY_LANG = 'de'; node scripts/generate-catalog-docs.mjs
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
const ONLY_LANG = (process.env.ONLY_LANG ?? '').trim().toLowerCase();

// Кухня ресторана для подсказок «что заказать». Указана по названию ресторана,
// проверьте и поправьте под свои данные. Рестораны без записи просто без кухни.
// Порядок кухонь: русский, английский, немецкий.
const CUISINES = {
  'Pizza House': ['пицца', 'pizza', 'Pizza'],
  Italiano: ['итальянская кухня', 'Italian cuisine', 'italienische Küche'],
  'Sushi Master': ['суши и роллы', 'sushi and rolls', 'Sushi und Rolls'],
  'Tokyo Roll': ['роллы и японская кухня', 'rolls and Japanese cuisine', 'Rolls und japanische Küche'],
  'Burger Point': ['бургеры', 'burgers', 'Burger'],
  'BBQ Factory': ['барбекю', 'barbecue', 'Barbecue'],
  'Steak House': ['стейки', 'steaks', 'Steaks'],
  'Healthy Food': ['здоровая еда', 'healthy food', 'gesundes Essen'],
  'Green Bowl': ['здоровая еда и боулы', 'healthy food and bowls', 'gesundes Essen und Bowls'],
  'Coffee Time': ['кофе и десерты', 'coffee and desserts', 'Kaffee und Desserts'],
};

const ALL_ROLES = ['ADMIN', 'MANAGER', 'CUSTOMER', 'COURIER'];

// Тексты документов на каждом языке.
// Названия блюд и описания приходят из базы как есть: их не переводим.
const TEXTS = {
  ru: {
    locale: 'ru-RU',
    suffix: '',
    menuTitle: (name) => `Меню ресторана ${name}`,
    restaurantLine: (name, cuisine, address, phone) =>
      `${name}: ресторан${cuisine ? `, кухня: ${cuisine}` : ''}. Адрес: ${address}. Телефон: ${phone}.`,
    menuSection: (menuName, name) =>
      `Меню «${menuName}» ресторана ${name}. Цены указаны в евро:`,
    dishesSection: (name) =>
      `Блюда меню ресторана ${name}. Цены указаны в евро.`,
    itemLine: (restaurant, item, price, description) =>
      `- ${restaurant}, ${item}: ${price} €. ${description}`.trim(),
    listTitle: 'Список ресторанов',
    listCount: (count) => `Всего ресторанов: ${count}.`,
    listItem: (name, cuisine, address, phone, email) =>
      `${name}${cuisine ? ` (кухня: ${cuisine})` : ''}. Адрес: ${address}. Телефон: ${phone}. Email: ${email}.`,
    cuisinesTitle: 'Какие рестораны есть по кухням',
    whatToOrderTitle: 'Что заказать: рестораны и кухни',
    hint:
      'Доступные кухни: пицца, суши и роллы, барбекю, итальянская кухня, бургеры, стейки, здоровая еда, кофе и десерты. У каждого ресторана своё меню с названиями блюд, описаниями и ценами в евро.',
    cuisine: (restaurant) => CUISINES[restaurant]?.[0],
  },
  en: {
    locale: 'en-GB',
    suffix: '-en',
    menuTitle: (name) => `Menu of the restaurant ${name}`,
    restaurantLine: (name, cuisine, address, phone) =>
      `${name}: restaurant${cuisine ? `, cuisine: ${cuisine}` : ''}. Address: ${address}. Phone: ${phone}.`,
    menuSection: (menuName, name) =>
      `Menu "${menuName}" of the restaurant ${name}. Prices are in euro:`,
    dishesSection: (name) =>
      `Dishes of the menu of the restaurant ${name}. Prices are in euro.`,
    itemLine: (restaurant, item, price, description) =>
      `- ${restaurant}, ${item}: ${price} €. ${description}`.trim(),
    listTitle: 'List of restaurants',
    listCount: (count) => `Total number of restaurants: ${count}.`,
    listItem: (name, cuisine, address, phone, email) =>
      `${name}${cuisine ? ` (cuisine: ${cuisine})` : ''}. Address: ${address}. Phone: ${phone}. Email: ${email}.`,
    cuisinesTitle: 'Which restaurants are there by cuisine',
    whatToOrderTitle: 'What to order: restaurants and cuisines',
    hint:
      'Available cuisines: pizza, sushi and rolls, barbecue, Italian cuisine, burgers, steaks, healthy food, coffee and desserts. Every restaurant has its own menu with dish names, descriptions and prices in euro.',
    cuisine: (restaurant) => CUISINES[restaurant]?.[1],
  },
  de: {
    locale: 'de-DE',
    suffix: '-de',
    menuTitle: (name) => `Menü des Restaurants ${name}`,
    restaurantLine: (name, cuisine, address, phone) =>
      `${name}: Restaurant${cuisine ? `, Küche: ${cuisine}` : ''}. Adresse: ${address}. Telefon: ${phone}.`,
    menuSection: (menuName, name) =>
      `Menü „${menuName}“ des Restaurants ${name}. Preise sind in Euro angegeben:`,
    dishesSection: (name) =>
      `Gerichte der Speisekarte des Restaurants ${name}. Preise sind in Euro angegeben.`,
    itemLine: (restaurant, item, price, description) =>
      `- ${restaurant}, ${item}: ${price} €. ${description}`.trim(),
    listTitle: 'Liste der Restaurants',
    listCount: (count) => `Insgesamt gibt es ${count} Restaurants.`,
    listItem: (name, cuisine, address, phone, email) =>
      `${name}${cuisine ? ` (Küche: ${cuisine})` : ''}. Adresse: ${address}. Telefon: ${phone}. E-Mail: ${email}.`,
    cuisinesTitle: 'Welche Restaurants gibt es nach Küche',
    whatToOrderTitle: 'Was bestellen: Restaurants und Küchen',
    hint:
      'Verfügbare Küchen: Pizza, Sushi und Rolls, Barbecue, italienische Küche, Burger, Steaks, gesundes Essen, Kaffee und Desserts. Jedes Restaurant hat eine eigene Speisekarte mit Gerichtnamen, Beschreibungen und Preisen in Euro.',
    cuisine: (restaurant) => CUISINES[restaurant]?.[2],
  },
};

const LANGUAGES = Object.keys(TEXTS).filter(
  (code) => ONLY_LANG === '' || code === ONLY_LANG,
);

if (!EMAIL || !PASSWORD) {
  console.error(
    'Задайте ADMIN_EMAIL и ADMIN_PASSWORD в переменных окружения или в файле .env.',
  );
  process.exit(1);
}

console.log(`Каталог читается с: ${BASE_URL}`);
console.log(`Языки документов: ${LANGUAGES.join(', ')}`);

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

// Меню и блюда читаем один раз: языки меняют только формулировки, не данные.
const catalog = [];

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

  catalog.push({ restaurant, sections });
}

const docs = [];

for (const code of LANGUAGES) {
  const t = TEXTS[code];
  const price = (value) =>
    Number(value).toLocaleString(t.locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });

  // 1. Меню каждого ресторана, где есть блюда.
  for (const { restaurant, sections } of catalog) {
    const cuisine = t.cuisine(restaurant.name);
    const lines = [
      t.menuTitle(restaurant.name),
      '',
      t.restaurantLine(
        restaurant.name,
        cuisine,
        restaurant.address,
        restaurant.phone,
      ),
      '',
    ];

    for (const { menu, items } of sections) {
      lines.push(
        sections.length > 1
          ? t.menuSection(menu.name, restaurant.name)
          : t.dishesSection(restaurant.name),
      );

      // Название ресторана в каждой строке: любой фрагмент после нарезки
      // остаётся самодостаточным и находится по запросу про этот ресторан.
      for (const item of items) {
        lines.push(
          t.itemLine(
            restaurant.name,
            item.name,
            price(item.price),
            sentence(item.description),
          ),
        );
      }

      lines.push('');
    }

    docs.push({
      id: `catalog-${slugOf(restaurant)}${t.suffix}`,
      type: 'MENU',
      text: lines.join('\n'),
      language: code,
    });
  }

  // 2. Список всех ресторанов.
  const listLines = [
    t.listTitle,
    '',
    t.listCount(restaurants.length),
    '',
    ...restaurants.map((r) => {
      const cuisine = t.cuisine(r.name);

      return t.listItem(
        r.name,
        cuisine,
        r.address,
        r.phone,
        r.email,
      );
    }),
  ];

  docs.push({
    id: `restaurants-list${t.suffix}`,
    type: 'RESTAURANT',
    text: listLines.join('\n'),
    language: code,
  });

  // 3. Подсказка «что заказать»: рестораны по кухням.
  const byCuisine = new Map();

  for (const r of restaurants) {
    const cuisine = t.cuisine(r.name);

    if (!cuisine) continue;

    byCuisine.set(cuisine, [...(byCuisine.get(cuisine) ?? []), r.name]);
  }

  const cuisineLines = [...byCuisine.entries()].map(
    ([cuisine, names]) => `${capitalize(cuisine)}: ${names.join(', ')}.`,
  );

  docs.push({
    id: `catalog-cuisines${t.suffix}`,
    type: 'RESTAURANT',
    text: [t.cuisinesTitle, '', ...cuisineLines, '', t.hint].join('\n'),
    language: code,
  });

  docs.push({
    id: `catalog-what-to-order${t.suffix}`,
    type: 'MENU',
    text: [t.whatToOrderTitle, '', ...cuisineLines, '', t.hint].join('\n'),
    language: code,
  });
}

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
    !entry.documentId.startsWith('catalog-') &&
    !entry.documentId.startsWith('restaurants-list'),
);

for (const doc of docs) {
  const file = `catalog/${doc.id}.txt`;

  await writeFile(path.join(DIR, file), doc.text + '\n', 'utf-8');
  manifest.push({
    file,
    documentType: doc.type,
    allowedRoles: ALL_ROLES,
    language: doc.language,
    documentId: doc.id,
    documentVersion: version,
  });
  console.log(`создан: ${file} (${doc.language})`);
}

await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n', 'utf-8');
console.log(
  `\nГотово: ${docs.length} документов, версия ${version}. Теперь: node scripts/upload-knowledge.mjs`,
);
