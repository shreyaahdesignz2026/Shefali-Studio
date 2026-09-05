const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function main() {
  const sqlPath = process.argv[2];
  if (!sqlPath) {
    console.error('Usage: node scripts/run-sql.js <path-to-sql-file>');
    process.exit(1);
  }
  const sql = fs.readFileSync(path.resolve(sqlPath), 'utf8');

  const client = new Client({
    connectionString: process.env.SUPABASE_DB_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    await client.query(sql);
    console.log(`Applied ${sqlPath}`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
