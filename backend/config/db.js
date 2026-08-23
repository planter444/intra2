const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const env = require('./env');

const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: env.nodeEnv === 'production' ? { rejectUnauthorized: false } : false
});

const query = (text, params = []) => pool.query(text, params);

const initDatabase = async () => {
  const schemaPath = path.resolve(__dirname, '..', 'database', 'schema.sql');
  const schema = fs.readFileSync(schemaPath, 'utf8');
  await pool.query(schema);
};

module.exports = {
  pool,
  query,
  initDatabase
};
