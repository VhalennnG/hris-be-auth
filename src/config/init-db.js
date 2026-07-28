import pool from './db.js';

/**
 * Verifies connection to the PostgreSQL database.
 * No table checks or automatic migrations are performed as they are handled manually.
 */
export async function initializeDatabase() {
  const dbName = process.env.HRIS_AUTH_DB_NAME || 'hris_auth';
  console.log(`Verifying connection to database "${dbName}"...`);
  try {
    await pool.query('SELECT 1');
    console.log('Database connection verified successfully.');
  } catch (error) {
    console.error(`Failed to connect to database "${dbName}" in Auth Service:`, error.message);
    throw error;
  }
}
