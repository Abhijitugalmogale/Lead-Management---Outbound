const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const config = require('../config');

let pool = null;
let isConnected = false;

try {
  pool = new Pool({
    host: config.db.host,
    port: config.db.port,
    database: config.db.database,
    user: config.db.user,
    password: config.db.password,
    ssl: config.db.ssl,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 3000,
  });

  pool.on('error', (err) => {
    console.error('Unexpected idle PostgreSQL client error:', err.message);
  });
} catch (err) {
  console.warn('Could not initialize PostgreSQL Pool:', err.message);
}

/**
 * Execute SQL query with parameters
 */
const query = async (text, params) => {
  if (!pool) {
    throw new Error('Database pool not initialized');
  }
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (config.env === 'development' && duration > 200) {
      console.log('Slow query:', { text, duration, rows: res.rowCount });
    }
    return res;
  } catch (err) {
    console.error('Database query error:', { query: text, error: err.message });
    throw err;
  }
};

/**
 * Test connectivity
 */
const testConnection = async () => {
  if (!pool) return false;
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    isConnected = true;
    return true;
  } catch (err) {
    isConnected = false;
    return false;
  }
};

/**
 * Initialize database schema and seeds
 */
const initDb = async () => {
  try {
    const connected = await testConnection();
    if (!connected) {
      console.warn('⚠️  PostgreSQL server is not reachable on localhost:5432. Schema migration skipped.');
      console.warn('   Ensure PostgreSQL is running and database "vedanjay_leads" exists.');
      return false;
    }

    console.log('✅ Connected to PostgreSQL. Applying schema & initial seeds...');
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf-8');
    await pool.query(schemaSql);
    console.log('✅ Schema tables verified/created successfully.');

    const seedsSql = fs.readFileSync(path.join(__dirname, 'seeds.sql'), 'utf-8');
    await pool.query(seedsSql);
    console.log('✅ Reference seed data populated.');
    return true;
  } catch (err) {
    console.error('Error applying database migrations:', err.message);
    return false;
  }
};

module.exports = {
  pool,
  query,
  testConnection,
  initDb,
  get isConnected() {
    return isConnected;
  },
};
