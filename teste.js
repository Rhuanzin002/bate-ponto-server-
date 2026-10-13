const { Pool } = require('pg');
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
pool.query('select 1')
  .then(() => console.log('OK, conectou'))
  .catch(e => console.log('FALHOU:', e.message))
  .finally(() => process.exit());