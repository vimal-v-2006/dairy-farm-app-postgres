#!/usr/bin/env node
/**
 * SQLite to PostgreSQL Migration Script
 *
 * Reads data from the existing SQLite database and imports it into PostgreSQL.
 *
 * Usage:
 *   DATABASE_URL=postgresql://user:pass@host/db node scripts/migrate-sqlite-to-pg.js [sqlite_path]
 *
 * The sqlite_path defaults to: server/data/dairy-farm.db
 */

const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

let Database;
try {
  Database = require('better-sqlite3');
} catch {
  console.error('better-sqlite3 is required for migration. Run: npm install better-sqlite3');
  process.exit(1);
}

const sqlitePath = process.argv[2] || path.join(__dirname, '..', 'data', 'dairy-farm.db');
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error('ERROR: DATABASE_URL environment variable is required.');
  console.error('Example: DATABASE_URL=postgresql://user:pass@host:5432/dbname node scripts/migrate-sqlite-to-pg.js');
  process.exit(1);
}

if (!fs.existsSync(sqlitePath)) {
  console.error(`ERROR: SQLite database not found at: ${sqlitePath}`);
  process.exit(1);
}

const pgPool = new Pool({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1') ? false : { rejectUnauthorized: false }
});

console.log(`SQLite source: ${sqlitePath}`);
console.log(`PostgreSQL target: ${databaseUrl.split('@')[1] || databaseUrl}`);
console.log('');

const sqliteDb = new Database(sqlitePath, { readonly: true });

const tables = [
  'users',
  'cows',
  'buyers',
  'expense_categories',
  'food_items',
  'food_price_history',
  'calves',
  'calf_expenses',
  'daily_entries',
  'cow_milk_entries',
  'milk_sales',
  'expenses',
  'investments',
  'cow_update_history'
];

const columnOverrides = {
  users: ['id', 'username', 'password_hash', 'created_at'],
  cows: ['id', 'name', 'breed', 'age', 'status', 'purchase_date', 'status_date', 'purchase_price', 'notes', 'created_at'],
  buyers: ['id', 'name', 'location', 'default_rate', 'contact', 'notes', 'active', 'created_at'],
  expense_categories: ['id', 'name', 'is_default', 'created_at'],
  food_items: ['id', 'name', 'purchase_kg', 'purchase_amount', 'rate_per_kg', 'unit_type', 'notes', 'created_at'],
  food_price_history: ['id', 'food_item_id', 'purchase_quantity', 'purchase_amount', 'unit_rate', 'unit_type', 'effective_from', 'notes', 'created_at'],
  calves: ['id', 'name', 'breed', 'birth_date', 'source_type', 'expected_lactation_date', 'purchase_price', 'paid_amount', 'status', 'notes', 'transferred_to_cow_id', 'transferred_at', 'created_at'],
  calf_expenses: ['id', 'calf_id', 'expense_date', 'expense_type', 'category_id', 'food_item_id', 'food_price_history_id', 'food_name_snapshot', 'unit_type_snapshot', 'rate_effective_from', 'quantity_kg', 'unit_rate', 'amount', 'entry_shift', 'description', 'payment_mode', 'created_at'],
  daily_entries: ['id', 'entry_date', 'total_milk_litres', 'remaining_milk_litres', 'total_income', 'total_expenses', 'profit', 'notes', 'created_at', 'updated_at'],
  cow_milk_entries: ['id', 'daily_entry_id', 'cow_id', 'morning_litres', 'evening_litres', 'total_litres', 'entry_shift', 'status', 'notes'],
  milk_sales: ['id', 'daily_entry_id', 'buyer_id', 'litres', 'rate_per_litre', 'income', 'payment_status', 'payment_mode', 'entry_shift', 'notes'],
  expenses: ['id', 'daily_entry_id', 'category_id', 'expense_type', 'cow_id', 'food_item_id', 'food_price_history_id', 'food_name_snapshot', 'unit_type_snapshot', 'rate_effective_from', 'quantity_kg', 'unit_rate', 'amount', 'entry_shift', 'description', 'payment_mode', 'bill_path', 'created_at'],
  investments: ['id', 'source_type', 'source_id', 'title', 'investment_date', 'investment_amount', 'status', 'completed_on', 'completed_income_amount', 'notes', 'created_at', 'updated_at'],
  cow_update_history: ['id', 'cow_id', 'updated_at', 'changes', 'snapshot']
};

function pgPlaceholder(count) {
  return Array.from({ length: count }, (_, i) => `$${i + 1}`).join(', ');
}

function normalizeValue(value, colName) {
  if (value === null || value === undefined) return null;
  if (colName === 'active') {
    return Boolean(value);
  }
  if (colName === 'is_default') {
    return Boolean(value);
  }
  if (colName.endsWith('_at') && typeof value === 'string') {
    if (value.includes('T')) return value;
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
      return value.replace(' ', 'T');
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return value + 'T00:00:00';
    }
  }
  return value;
}

async function migrateTable(tableName) {
  const columns = columnOverrides[tableName];
  if (!columns) {
    console.log(`  SKIP: ${tableName} (no column mapping)`);
    return;
  }

  const rows = sqliteDb.prepare(`SELECT * FROM ${tableName}`).all();
  console.log(`  ${tableName}: ${rows.length} rows`);

  if (rows.length === 0) return;

  const client = await pgPool.connect();
  try {
    for (const row of rows) {
      const values = columns.map((col) => normalizeValue(row[col], col));
      const placeholders = pgPlaceholder(columns.length);
      const colNames = columns.map((c) => `"${c}"`).join(', ');
      await client.query(
        `INSERT INTO "${tableName}" (${colNames}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`,
        values
      );
    }

    if (tableName === 'users' || tableName === 'cows' || tableName === 'calves' || tableName === 'buyers' || tableName === 'food_items' || tableName === 'expense_categories' || tableName === 'investments') {
      const maxId = Math.max(...rows.map((r) => Number(r.id || 0)));
      await client.query(`SELECT setval(pg_get_serial_sequence('${tableName}', 'id'), ${maxId}, true)`);
    }
  } finally {
    client.release();
  }
}

async function run() {
  console.log('Starting migration...\n');

  for (const table of tables) {
    try {
      await migrateTable(table);
    } catch (err) {
      console.error(`  ERROR migrating ${table}: ${err.message}`);
    }
  }

  sqliteDb.close();
  await pgPool.end();

  console.log('\nMigration complete!');
  console.log('Please verify the data in your PostgreSQL database.');
}

run().catch((err) => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
