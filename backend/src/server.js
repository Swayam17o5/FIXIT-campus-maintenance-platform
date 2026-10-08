import app from './app.js';
import env from './config/env.js';
import { testConnection } from './config/db.js';

const startServer = async () => {
  try {
    await testConnection();
    console.log('✅ Supabase connected successfully.');
  } catch (error) {
    console.warn(`⚠️ Warning on DB connection: ${error.message}`);
    console.warn('Backend server will start, but database operations require valid Supabase credentials in backend/.env');
  }

  app.listen(env.port, () => {
    console.log(`Server running on http://localhost:${env.port}`);
  });
};

startServer();
