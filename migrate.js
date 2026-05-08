import { createClient } from '@supabase/supabase-js';

const supabaseUrl = "https://gwdhvmfrzmtpsuozooqn.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3ZGh2bWZyem10cHN1b3pvb3FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4ODYzMjQsImV4cCI6MjA5MzQ2MjMyNH0.JgM2jtIgjN_mVx-EKrjsnCnonAV3HoWqFQ3yERbIbps";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function migrate() {
    const queries = [
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'text'",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'sent'",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS reply_to_message_id UUID",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited BOOLEAN DEFAULT false",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS deleted BOOLEAN DEFAULT false",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'",
        "ALTER TABLE messages ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now()",
        "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS last_message_at TIMESTAMPTZ DEFAULT now()",
        "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now()",
        "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS related_type TEXT",
        "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS related_id UUID",
        "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS pinned_by UUID[] DEFAULT '{}'",
        "ALTER TABLE conversations ADD COLUMN IF NOT EXISTS blocked_by UUID[] DEFAULT '{}'",
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link_data JSONB",
        "ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read BOOLEAN DEFAULT false"
    ];

    for (const q of queries) {
        console.log(`Running: ${q}`);
        const { error } = await supabase.rpc('exec_sql', { sql: q });
        if (error) console.error(`Error: ${error.message}`);
        else console.log("Success");
    }
}

migrate();
