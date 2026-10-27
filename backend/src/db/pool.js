// backend/src/db/pool.js
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'nexifly',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || '',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('❌  Unexpected PostgreSQL pool error', err);
  process.exit(-1);
});

// ── Connection health check (runs once at startup) ────────────────────────────
async function testConnection() {
  let client;
  try {
    client = await pool.connect();
    const { rows } = await client.query('SELECT version()');
    console.log('✅  PostgreSQL connected —', rows[0].version.split(',')[0]);
  } catch (err) {
    console.error('❌  PostgreSQL connection FAILED:', err.message);
    console.error('    Check DB_HOST / DB_PORT / DB_NAME / DB_USER / DB_PASSWORD in your .env');
    process.exit(1);          // kill the server — no point running without a DB
  } finally {
    if (client) client.release();
  }
}

testConnection();   // called immediately when pool.js is first required

// Convenience helpers
const query = (text, params) => pool.query(text, params);
const getClient = () => pool.connect();

module.exports = { pool, query, getClient };