import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load from current working directory
dotenv.config();

// Also fallback load from backend directory if not populated
if (!process.env.SUPABASE_URL) {
  dotenv.config({ path: path.resolve(__dirname, '../../.env') });
}

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 4000),
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  jwtSecret: process.env.JWT_SECRET || 'replace_this_in_production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '2h'
};

export default env;
