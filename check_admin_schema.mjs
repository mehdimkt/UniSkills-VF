import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://gwdhvmfrzmtpsuozooqn.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3ZGh2bWZyem10cHN1b3pvb3FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4ODYzMjQsImV4cCI6MjA5MzQ2MjMyNH0.JgM2jtIgjN_mVx-EKrjsnCnonAV3HoWqFQ3yERbIbps";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkAdminSchema() {
  const tables = ['users', 'services', 'leads', 'orders', 'proposals', 'unicoin_wallets', 'unicoin_transactions', 'categories', 'reports', 'audit_logs', 'platform_settings'];
  
  for (const table of tables) {
    try {
      const { data, error } = await supabase.from(table).select('*').limit(1);
      if (error) {
        console.log(`❌ Table ${table} does NOT exist or error: ${error.message}`);
      } else {
        console.log(`✅ Table ${table} exists. Columns:`);
        if (data && data.length > 0) {
          console.log(Object.keys(data[0]));
        } else {
          console.log("(Table is empty)");
        }
      }
    } catch (e) {
      console.log(`💥 Error checking table ${table}: ${e.message}`);
    }
  }
}

checkAdminSchema();
