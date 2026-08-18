export const normalizeLyricsKey = (artist, title) =>
  `${String(artist || '').toLowerCase()}||${String(title || '').toLowerCase()}`;

export const cloneEntry = (value) => {
  if (value === null || value === undefined) return value;
  return JSON.parse(JSON.stringify(value));
};

export const chunkArray = (arr, size = 200) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
};

export async function replaceTableRows(db, { table, columns, rows, batchSize = 200 }) {
  await db.execute(`DELETE FROM ${table}`);

  const columnList = columns.join(', ');
  const rowPlaceholder = `(${columns.map(() => '?').join(', ')})`;

  for (const batch of chunkArray(rows, batchSize)) {
    if (!batch.length) continue;
    await db.execute({
      sql: `INSERT INTO ${table} (${columnList}) VALUES ${batch.map(() => rowPlaceholder).join(', ')}`,
      args: batch.flat(),
    });
  }
}