const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

const isNeon = databaseUrl.includes('neon.tech');
const isLocal = databaseUrl.includes('localhost') || databaseUrl.includes('127.0.0.1');

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: isLocal ? false : { rejectUnauthorized: false },
  max: isNeon ? 4 : 10,
  idleTimeoutMillis: isNeon ? 5000 : 30000,
  connectionTimeoutMillis: isNeon ? 15000 : 10000,
  allowExitOnIdle: isNeon,
  maxUses: isNeon ? 7500 : Infinity
});

pool.on('connect', () => {
  if (process.env.NODE_ENV === 'production') {
    console.log('Database pool: new connection established');
  }
});

pool.on('remove', () => {
  if (process.env.NODE_ENV === 'production') {
    console.log('Database pool: connection removed');
  }
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err.message);
});

const defaultExpenseCategories = [
  'Feed 1', 'Feed 2', 'Feed 3', 'Feed 4', 'Medical expense', 'Labour', 'Transport', 'Electricity', 'Maintenance', 'Cow purchase', 'Other expense'
];

async function query(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows;
}

async function queryOne(sql, params = []) {
  const result = await pool.query(sql, params);
  return result.rows[0] || null;
}

async function execute(sql, params = []) {
  return pool.query(sql, params);
}

async function insertReturning(sql, params = []) {
  const result = await pool.query(`${sql} RETURNING id`, params);
  return result.rows[0].id;
}

async function initDb() {
  const schemaPath = path.join(__dirname, 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  await pool.query(schema);

  const existing = await pool.query('SELECT COUNT(*) AS count FROM expense_categories WHERE is_default = true');
  if (parseInt(existing.rows[0].count) === 0) {
    for (const name of defaultExpenseCategories) {
      await pool.query('INSERT INTO expense_categories (name, is_default) VALUES ($1, true) ON CONFLICT (name) DO NOTHING', [name]);
    }
  }
}

async function poolEnd() {
  await pool.end();
}

async function healthCheck() {
  try {
    const result = await pool.query('SELECT NOW() AS timestamp, 1 AS alive');
    return { status: 'ok', database: 'connected', timestamp: result.rows[0].timestamp };
  } catch (err) {
    return { status: 'error', database: 'disconnected', error: err.message };
  }
}

module.exports = { pool, query, queryOne, execute, insertReturning, initDb, poolEnd, defaultExpenseCategories, healthCheck };
