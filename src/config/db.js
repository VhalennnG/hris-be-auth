import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  host: process.env.HRIS_AUTH_DB_HOST || 'localhost',
  port: parseInt(process.env.HRIS_AUTH_DB_PORT || '5432', 10),
  user: process.env.HRIS_AUTH_DB_USER || 'postgres',
  password: process.env.HRIS_AUTH_DB_PASS || 'postgres',
  database: process.env.HRIS_AUTH_DB_NAME || 'hris_auth',
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client in Auth Service', err);
});

export default pool;
