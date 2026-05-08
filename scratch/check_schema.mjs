import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

// Try to load from .env
const env = fs.readFileSync('.env', 'utf8');
const lines = env.split('\n');
const supabaseUrl = lines.find(l => l.startsWith('VITE_SUPABASE_URL='))?.split('=')[1]?.trim();
const supabaseKey = lines.find(l => l.startsWith('VITE_SUPABASE_ANON_KEY='))?.split('=')[1]?.trim();

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function getSchema() {
  const tables = ['conversations', 'messages', 'conversation_participants', 'users'];
  
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.error(`Error fetching ${table}:`, error);
    } else {
      console.log(`\nTable ${table} columns:`);
      if (data && data.length > 0) {
        console.log(Object.keys(data[0]));
      } else {
        console.log(`Empty table ${table}`);
      }
    }
  }
}

getSchema();
