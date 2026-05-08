import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://gwdhvmfrzmtpsuozooqn.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3ZGh2bWZyem10cHN1b3pvb3FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4ODYzMjQsImV4cCI6MjA5MzQ2MjMyNH0.JgM2jtIgjN_mVx-EKrjsnCnonAV3HoWqFQ3yERbIbps";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
    let { data: orders, error: oErr } = await supabase.from('orders').select('files').limit(1);
    console.log("Orders files column:", oErr ? oErr.message : "Exists", orders);

    let { data: props, error: pErr } = await supabase.from('proposals').select('files').limit(1);
    console.log("Proposals files column:", pErr ? pErr.message : "Exists", props);
}

test();
