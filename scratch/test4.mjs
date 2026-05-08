import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://gwdhvmfrzmtpsuozooqn.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3ZGh2bWZyem10cHN1b3pvb3FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4ODYzMjQsImV4cCI6MjA5MzQ2MjMyNH0.JgM2jtIgjN_mVx-EKrjsnCnonAV3HoWqFQ3yERbIbps";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function getSchema() {
  const tables = ['messages', 'conversations', 'conversation_participants'];
  
  for (const table of tables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (error) {
      console.error(`Error fetching ${table}:`, error);
    } else {
      console.log(`\nTable ${table} columns:`);
      if (data && data.length > 0) {
        console.log(Object.keys(data[0]));
      } else {
        console.log("Empty table, inserting dummy to get schema...");
        const {data: insData, error: insErr} = await supabase.from(table).insert({}).select('*');
        if (insData && insData.length > 0) {
            console.log(Object.keys(insData[0]));
        } else {
            console.log("Could not fetch schema", insErr);
        }
      }
    }
  }
}

getSchema();
