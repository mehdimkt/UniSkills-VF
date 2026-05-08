from supabase import create_client
import os
from datetime import datetime

# Configuration Supabase
SUPABASE_URL = os.getenv("VITE_SUPABASE_URL", "https://gwdhvmfrzmtpsuozooqn.supabase.co")
SUPABASE_KEY = os.getenv("VITE_SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3ZGh2bWZyem10cHN1b3pvb3FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4ODYzMjQsImV4cCI6MjA5MzQ2MjMyNH0.JgM2jtIgjN_mVx-EKrjsnCnonAV3HoWqFQ3yERbIbps")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

class LeadController:
    
    @staticmethod
    def get_all_leads():
        try:
            response = supabase.table('leads')\
                .select('*, owner:users!owner_id(*)')\
                .eq('status', 'open')\
                .order('created_at', desc=True)\
                .execute()
            return response.data, 200
        except Exception as e:
            return {'error': str(e)}, 500
    
    @staticmethod
    def create_lead(data):
        try:
            data['created_at'] = datetime.now().isoformat()
            data['status'] = 'open'
            if 'id' not in data or not data['id']:
                data['id'] = f"lead_{datetime.now().timestamp()}_{os.urandom(4).hex()}"
            
            response = supabase.table('leads').insert(data).execute()
            return response.data[0] if response.data else {}, 201
        except Exception as e:
            return {'error': str(e)}, 500
    
    @staticmethod
    def update_lead(lead_id, data):
        try:
            response = supabase.table('leads')\
                .update(data)\
                .eq('id', lead_id)\
                .execute()
            return response.data[0] if response.data else {}, 200
        except Exception as e:
            return {'error': str(e)}, 500
    
    @staticmethod
    def delete_lead(lead_id):
        try:
            supabase.table('leads').delete().eq('id', lead_id).execute()
            return {'success': True}, 200
        except Exception as e:
            return {'error': str(e)}, 500