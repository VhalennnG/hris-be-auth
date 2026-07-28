import app from './app.js';
import { initializeDatabase } from './config/init-db.js';
import dotenv from 'dotenv';

dotenv.config();

const PORT = process.env.PORT || 4002;

async function startServer() {
  try {
    // 1. Initialize and verify database (checks and runs migrations if needed)
    await initializeDatabase();
    
    // 2. Start Express Server listener
    app.listen(PORT, () => {
      console.log(`[hris-be-auth] Server is running successfully on port ${PORT}`);
    });
  } catch (error) {
    console.error('Fatal error during Auth Service server startup:', error);
    process.exit(1);
  }
}

startServer();
