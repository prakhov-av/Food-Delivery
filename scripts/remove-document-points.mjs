// Удаление точек документа из основной коллекции.
//
// Нужен для документов, загруженных под служебным id: они остаются в базе
// и участвуют в поиске, хотя их правильные версии загружены отдельно.
//
// Запуск (Node 18+):
//   node scripts/remove-document-points.mjs ca1 cm1 --confirm
//
// Без --confirm скрипт только показывает, что будет удалено.
import './load-env.mjs';

const args = process.argv.slice(2);
const confirmed = args.includes('--confirm');
const documentIds = args.filter((arg) => !arg.startsWith('--'));

if (documentIds.length === 0) {
  console.error('Укажите documentId: node scripts/remove-document-points.mjs <id> [--confirm]');
  process.exit(1);
}

const headers = {
  'Content-Type': 'application/json',
  ...(process.env.QDRANT_API_KEY
    ? { 'api-key': process.env.QDRANT_API_KEY }
    : {}),
};

const collection = process.env.KNOWLEDGE_DB_COLLECTION_NAME;

// Сначала показываем, что именно попадёт под удаление.
for (const documentId of documentIds) {
  const response = await fetch(
    `${process.env.QDRANT_URL}/collections/${collection}/points/scroll`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        limit: 100,
        with_payload: true,
        with_vector: false,
        filter: { must: [{ key: 'documentId', match: { value: documentId } }] },
      }),
    },
  );

  const points = (await response.json()).result?.points ?? [];

  console.log(
    `${documentId}: точек ${points.length}` +
      (points.length > 0
        ? ` | язык ${points[0].payload?.language} | версия ${points[0].payload?.documentVersion}` +
          ` | ${String(points[0].payload?.text ?? '').slice(0, 80)}`
        : ''),
  );
}

if (!confirmed) {
  console.log('\nНичего не удалено. Повторите с --confirm.');
  process.exit(0);
}

for (const documentId of documentIds) {
  const response = await fetch(
    `${process.env.QDRANT_URL}/collections/${collection}/points/delete`,
    {
      method: 'POST',
      headers,
      body: JSON.stringify({
        filter: { must: [{ key: 'documentId', match: { value: documentId } }] },
      }),
    },
  );

  console.log(
    `удаление ${documentId}: ${response.ok ? 'ок' : `ошибка ${response.status} ${await response.text()}`}`,
  );
}
