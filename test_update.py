import os
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv()
SUPABASE_URL = os.getenv("VITE_SUPABASE_URL")
SUPABASE_KEY = os.getenv("VITE_SUPABASE_ANON_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

try:
    res = supabase.table('users').select('*').limit(1).execute()
    if res.data:
        print("Columns:", res.data[0].keys())
    else:
        print("No users found.")
except Exception as e:
    print("Error:", str(e))
