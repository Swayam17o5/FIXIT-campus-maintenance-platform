import { createClient } from '@supabase/supabase-js';
import env from './env.js';

const isConfiguredUrl = (url) => {
  return typeof url === 'string' && (url.startsWith('https://') || url.startsWith('http://')) && !url.includes('YOUR_');
};

const supabaseKey = env.supabaseServiceRoleKey || env.supabaseAnonKey;
const isValidKey = typeof supabaseKey === 'string' && supabaseKey.length > 20 && !supabaseKey.startsWith('YOUR_');

const rawClient = (isConfiguredUrl(env.supabaseUrl) && isValidKey)
  ? createClient(env.supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    })
  : null;

export const supabase = new Proxy(rawClient || {}, {
  get(target, prop) {
    if (!rawClient) {
      throw new Error(
        'Database is not configured yet. Please enter your real SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env and save the file.'
      );
    }
    return target[prop];
  }
});

export const testConnection = async () => {
  if (!rawClient) {
    throw new Error(
      'Supabase is not configured yet. Please enter your SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in backend/.env'
    );
  }

  // Probe category table to verify connectivity and credentials
  const { error } = await rawClient
    .from('category')
    .select('category_id', { count: 'exact', head: true });

  if (error) {
    throw new Error(`Supabase connection failed: ${error.message} (${error.code || 'unknown'})`);
  }
};

export default supabase;
