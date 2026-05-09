import os
import uuid
from datetime import datetime, timedelta
from flask import Flask, request, jsonify
from flask_cors import CORS
from supabase import create_client, Client
from dotenv import load_dotenv

# Charger les variables d'environnement
load_dotenv()

# Configuration Supabase
SUPABASE_URL = os.getenv("VITE_SUPABASE_URL", "https://gwdhvmfrzmtpsuozooqn.supabase.co")
SUPABASE_KEY = os.getenv("VITE_SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3ZGh2bWZyem10cHN1b3pvb3FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4ODYzMjQsImV4cCI6MjA5MzQ2MjMyNH0.JgM2jtIgjN_mVx-EKrjsnCnonAV3HoWqFQ3yERbIbps")
SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Client admin si la clé service_role est présente (pour bypasser les confirmations d'email)
supabase_admin = None
if SERVICE_ROLE_KEY:
    supabase_admin = create_client(SUPABASE_URL, SERVICE_ROLE_KEY)

app = Flask(__name__)
CORS(app)

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({
        'status': 'ok', 
        'message': 'Python backend is running!',
        'python_alive': True,
        'python_status': 'healthy'
    }), 200

# Helper pour la journalisation des actions administratives
def log_admin_action(admin_id, action, target_id=None, details=None):
    try:
        if not admin_id:
            return
        supabase.table('audit_logs').insert({
            'admin_id': admin_id,
            'action': action,
            'target_id': str(target_id) if target_id else None,
            'details': details or {},
            'created_at': datetime.now().isoformat()
        }).execute()
    except Exception as e:
        print(f"[ERROR] log_admin_action: {str(e)}")

# ==================== MARKETPLACE FEED ====================

@app.route('/api/marketplace/feed', methods=['GET'])
def marketplace_feed():
    role = request.args.get('role', 'demandeur')
    try:
        if role == 'aideur':
            response = supabase.table('leads')\
                .select('*, owner:users!owner_id(id, full_name, email, city, avatar_url, university, level)')\
                .in_('status', ['open', 'negotiating'])\
                .order('created_at', desc=True)\
                .execute()
        else:
            response = supabase.table('services')\
                .select('*, user:users!user_id(id, full_name, email, city, avatar_url, university, level, rating)')\
                .eq('status', 'active')\
                .order('created_at', desc=True)\
                .execute()
        
        result = []
        for item in response.data:
            if isinstance(item, dict):
                for key, value in item.items():
                    if hasattr(value, 'isoformat'):
                        item[key] = value.isoformat()
                result.append(item)
            else:
                result.append(item)
        
        return jsonify(result), 200
    except Exception as e:
        print(f"[ERROR] marketplace_feed: {str(e)}")
        return jsonify({'error': str(e), 'data': []}), 500

# ==================== SERVICES ====================

@app.route('/api/services', methods=['GET'])
def get_services():
    try:
        response = supabase.table('services')\
            .select('*, user:users!user_id(id, full_name, email, city, avatar_url)')\
            .eq('status', 'active')\
            .order('created_at', desc=True)\
            .execute()
        return jsonify(response.data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/services', methods=['POST'])
def create_service():
    try:
        data = request.json
        data['created_at'] = datetime.now().isoformat()
        data['status'] = 'active'
        response = supabase.table('services').insert(data).execute()
        return jsonify(response.data[0] if response.data else {}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/marketplace/my-annonces', methods=['GET'])
def get_my_items():
    user_id = request.headers.get('Authorization', '').replace('Bearer ', '')
    if not user_id:
        return jsonify({'error': 'User ID required'}), 400
    try:
        services_res = supabase.table('services').select('*').eq('user_id', user_id).order('created_at', desc=True).execute()
        leads_res = supabase.table('leads').select('*').eq('owner_id', user_id).order('created_at', desc=True).execute()
        return jsonify({'services': services_res.data, 'leads': leads_res.data}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ==================== ORDERS ====================

# Statuts possibles pour les commandes:
# pending, in_progress, delivered, revision, completed, cancelled, disputed, blocked

@app.route('/api/orders/my-orders', methods=['GET'])
def get_my_orders():
    user_id = request.headers.get('Authorization', '').replace('Bearer ', '')
    if not user_id:
        return jsonify({'error': 'User ID required'}), 400
    try:
        response = supabase.table('orders')\
            .select('*, service:services(*), lead:leads(*), seller:users!seller_id(id, first_name, last_name, full_name, avatar_url), buyer:users!buyer_id(id, first_name, last_name, full_name, avatar_url)')\
            .or_(f'buyer_id.eq.{user_id},seller_id.eq.{user_id}')\
            .order('created_at', desc=True)\
            .execute()
        return jsonify(response.data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/orders/<order_id>/status', methods=['PUT'])
def update_order_status(order_id):
    try:
        data = request.json
        new_status = data.get('status')
        updates = {
            'status': new_status,
            'updated_at': datetime.now().isoformat()
        }
        
        if new_status == 'in_progress':
            updates['accepted_at'] = datetime.now().isoformat()
        elif new_status == 'delivered':
            updates['delivered_at'] = datetime.now().isoformat()
        elif new_status == 'completed':
            updates['completed_at'] = datetime.now().isoformat()
        elif new_status == 'revision':
            updates['revision_requested_at'] = datetime.now().isoformat()
            if 'revision_message' in data:
                updates['revision_message'] = data['revision_message']
                order_data = supabase.table('orders').select('revisions_used').eq('id', order_id).execute()
                if order_data.data:
                    revisions_used = order_data.data[0].get('revisions_used', 0) + 1
                    updates['revisions_used'] = revisions_used
        elif new_status == 'cancelled':
            updates['cancelled_at'] = datetime.now().isoformat()
        elif new_status == 'disputed':
            updates['dispute_status'] = 'pending'
            updates['dispute_created_at'] = datetime.now().isoformat()
            if 'dispute_reason' in data:
                updates['dispute_reason'] = data['dispute_reason']
        elif new_status == 'blocked':
            updates['blocked_at'] = datetime.now().isoformat()
            if 'blocked_reason' in data:
                updates['blocked_reason'] = data['blocked_reason']
        
        response = supabase.table('orders').update(updates).eq('id', order_id).execute()
        return jsonify(response.data[0] if response.data else {}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/orders/create', methods=['POST'])
def create_order():
    try:
        data = request.json
        data['created_at'] = datetime.now().isoformat()
        data['updated_at'] = datetime.now().isoformat()
        data['status'] = 'pending'
        data['revisions_used'] = 0
        data['result_files'] = []
        data['is_pinned'] = False
        
        order_id = data.get('id') or f"order_{int(datetime.now().timestamp())}_{uuid.uuid4().hex[:8]}"
        data['id'] = order_id
        
        # Si delivery_deadline est fourni, le garder
        if 'delivery_deadline' not in data:
            data['delivery_deadline'] = None
        
        response = supabase.table('orders').insert(data).execute()
        return jsonify(response.data[0] if response.data else {}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ==================== PROPOSALS ====================

@app.route('/api/marketplace/proposals', methods=['GET'])
def get_proposals():
    user_id = request.headers.get('Authorization', '').replace('Bearer ', '')
    if not user_id:
        return jsonify({'error': 'User ID required'}), 400
    try:
        received = supabase.table('proposals')\
            .select('*, lead:leads(*), service:services(*), sender:users!sender_id(id, first_name, last_name, full_name, avatar_url)')\
            .eq('receiver_id', user_id)\
            .order('created_at', desc=True)\
            .execute()
        
        sent = supabase.table('proposals')\
            .select('*, lead:leads(*), service:services(*), receiver:users!receiver_id(id, first_name, last_name, full_name, avatar_url)')\
            .eq('sender_id', user_id)\
            .order('created_at', desc=True)\
            .execute()
        
        return jsonify({
            'received': received.data,
            'sent': sent.data
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/proposals', methods=['POST'])
def create_proposal():
    try:
        data = request.json
        data['created_at'] = datetime.now().isoformat()
        data['status'] = 'pending'
        data['is_pinned'] = False
        data['files'] = data.get('files', [])
        
        prop_id = data.get('id') or f"prop_{int(datetime.now().timestamp())}_{uuid.uuid4().hex[:8]}"
        data['id'] = prop_id
        
        response = supabase.table('proposals').insert(data).execute()
        return jsonify(response.data[0] if response.data else {}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/proposals/<prop_id>/status', methods=['PUT'])
def update_proposal_status(prop_id):
    try:
        data = request.json
        new_status = data.get('status')
        updates = {
            'status': new_status,
            'updated_at': datetime.now().isoformat()
        }
        
        if new_status == 'accepted':
            updates['accepted_at'] = datetime.now().isoformat()
        
        response = supabase.table('proposals').update(updates).eq('id', prop_id).execute()
        return jsonify(response.data[0] if response.data else {}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/proposals/counter-offer', methods=['POST'])
def create_counter_offer():
    try:
        data = request.json
        original_id = data.get('original_proposal_id')
        if original_id:
            supabase.table('proposals').update({
                'status': 'countered',
                'updated_at': datetime.now().isoformat()
            }).eq('id', original_id).execute()
        
        data['created_at'] = datetime.now().isoformat()
        data['status'] = 'pending'
        data['is_pinned'] = False
        data['is_counter_offer'] = True
        
        prop_id = data.get('id') or f"prop_{int(datetime.now().timestamp())}_{uuid.uuid4().hex[:8]}"
        data['id'] = prop_id
        
        response = supabase.table('proposals').insert(data).execute()
        return jsonify(response.data[0] if response.data else {}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/marketplace/propose', methods=['POST'])
def propose_from_marketplace():
    try:
        data = request.json
        data['created_at'] = datetime.now().isoformat()
        data['status'] = 'pending'
        data['is_pinned'] = False
        data['files'] = data.get('files', [])
        
        prop_id = f"prop_{int(datetime.now().timestamp())}_{uuid.uuid4().hex[:8]}"
        data['id'] = prop_id
        
        response = supabase.table('proposals').insert(data).execute()
        
        title = ""
        if data.get('lead_id'):
            lead = supabase.table('leads').select('title').eq('id', data['lead_id']).execute()
            if lead.data:
                title = lead.data[0].get('title', '')
        elif data.get('service_id'):
            service = supabase.table('services').select('title').eq('id', data['service_id']).execute()
            if service.data:
                title = service.data[0].get('title', '')
        
        return jsonify({
            'id': prop_id,
            'title': title,
            'status': 'pending'
        }), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ==================== LEADS ====================

@app.route('/api/leads', methods=['GET'])
def get_leads():
    try:
        response = supabase.table('leads')\
            .select('*, owner:users!owner_id(id, full_name, email, city, avatar_url)')\
            .in_('status', ['open', 'negotiating'])\
            .order('created_at', desc=True)\
            .execute()
        return jsonify(response.data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/leads', methods=['POST'])
def create_lead():
    try:
        data = request.json
        if not data.get('id'):
            data['id'] = f"lead_{int(datetime.now().timestamp())}_{uuid.uuid4().hex[:8]}"
        
        data['created_at'] = datetime.now().isoformat()
        data['status'] = data.get('status', 'open')
        data['files'] = data.get('files', [])
        
        response = supabase.table('leads').insert(data).execute()
        return jsonify(response.data[0] if response.data else {}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/leads/<lead_id>', methods=['PUT'])
def update_lead(lead_id):
    try:
        data = request.json
        data['updated_at'] = datetime.now().isoformat()
        response = supabase.table('leads').update(data).eq('id', lead_id).execute()
        return jsonify(response.data[0] if response.data else {}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/leads/<lead_id>', methods=['DELETE'])
def delete_lead(lead_id):
    try:
        supabase.table('leads').delete().eq('id', lead_id).execute()
        return jsonify({'success': True}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ==================== MESSAGES ====================

@app.route('/api/messages/conversations', methods=['GET'])
def get_conversations():
    user_id = request.headers.get('Authorization', '').replace('Bearer ', '')
    if not user_id:
        return jsonify({'error': 'User ID required'}), 400
    try:
        response = supabase.table('conversation_participants').select('conversation_id').eq('user_id', user_id).execute()
        conv_ids = [p['conversation_id'] for p in response.data] if response.data else []
        if not conv_ids:
            return jsonify([]), 200
        
        conversations = []
        for conv_id in conv_ids:
            participants = supabase.table('conversation_participants')\
                .select('user_id, users(id, first_name, last_name, email, avatar_url)')\
                .eq('conversation_id', conv_id).execute()
            last_msg = supabase.table('messages').select('*').eq('conversation_id', conv_id).order('created_at', desc=True).limit(1).execute()
            other_user = None
            for p in participants.data:
                if p['user_id'] != user_id:
                    other_user = p.get('users', {})
                    break
            conversations.append({
                'conversation_id': conv_id,
                'participant_id': other_user.get('id') if other_user else None,
                'first_name': other_user.get('first_name', '') if other_user else '',
                'last_name': other_user.get('last_name', '') if other_user else '',
                'avatar_url': other_user.get('avatar_url') if other_user else None,
                'last_message': last_msg.data[0]['content'] if last_msg.data else '',
                'updated_at': last_msg.data[0]['created_at'] if last_msg.data else datetime.now().isoformat()
            })
        return jsonify(conversations), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/messages/conversation/<conv_id>', methods=['GET'])
def get_messages(conv_id):
    try:
        response = supabase.table('messages').select('*, sender:users(id, full_name, avatar_url)').eq('conversation_id', conv_id).order('created_at', desc=False).execute()
        return jsonify(response.data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/messages/send', methods=['POST'])
def send_message():
    try:
        data = request.json
        data['created_at'] = datetime.now().isoformat()
        if 'conversation_id' not in data or not data['conversation_id']:
            conv_response = supabase.table('conversations').insert({}).execute()
            data['conversation_id'] = conv_response.data[0]['id']
            supabase.table('conversation_participants').insert([
                {'conversation_id': data['conversation_id'], 'user_id': data['sender_id']},
                {'conversation_id': data['conversation_id'], 'user_id': data['recipient_id']}
            ]).execute()
        response = supabase.table('messages').insert(data).execute()
        result = response.data[0] if response.data else {}
        result['sender'] = {'id': data['sender_id'], 'full_name': '', 'avatar_url': None}
        return jsonify(result), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ==================== UPLOAD ====================

@app.route('/api/upload', methods=['POST'])
def upload_file():
    return jsonify({'url': '/storage/mock-file.pdf'}), 200

# ==================== UNICOIN WALLET & FUNDS ====================

@app.route('/api/unicoin-wallets-check', methods=['GET'])
def check_unicoin_wallets():
    try:
        response = supabase.table('unicoin_wallets').select('count', count='exact').limit(1).execute()
        return jsonify({
            'exists': True,
            'count': response.count,
            'message': 'Table unicoin_wallets existe dans Supabase'
        }), 200
    except Exception as e:
        error_msg = str(e)
        if 'relation "unicoin_wallets" does not exist' in error_msg:
            return jsonify({
                'exists': False,
                'message': 'Table unicoin_wallets n\'existe PAS dans Supabase'
            }), 200
        return jsonify({'error': error_msg}), 500

@app.route('/api/user-wallet', methods=['GET'])
def get_user_wallet():
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({'error': 'user_id required'}), 400
    
    try:
        response = supabase.table('unicoin_wallets')\
            .select('*')\
            .eq('user_id', user_id)\
            .execute()
        
        if response.data:
            return jsonify(response.data[0]), 200
        else:
            return jsonify({'error': 'Wallet not found'}), 404
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/create-wallet', methods=['POST'])
def create_wallet():
    data = request.json
    user_id = data.get('user_id')
    balance = data.get('balance', 100)
    
    if not user_id:
        return jsonify({'error': 'user_id required'}), 400
    
    try:
        existing = supabase.table('unicoin_wallets')\
            .select('id')\
            .eq('user_id', user_id)\
            .execute()
        
        if existing.data:
            return jsonify({'wallet': existing.data[0], 'message': 'Wallet already exists'}), 200
        
        response = supabase.table('unicoin_wallets')\
            .insert({'user_id': user_id, 'balance': balance, 'held_balance': 0})\
            .execute()
        
        return jsonify(response.data[0] if response.data else {}), 201
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/add-unicoins', methods=['POST'])
def add_unicoins():
    data = request.json
    user_id = data.get('user_id')
    amount = data.get('amount', 0)
    reason = data.get('reason', 'Crédit manuel')
    
    if not user_id or amount <= 0:
        return jsonify({'error': 'user_id and amount required'}), 400
    
    try:
        wallet_response = supabase.table('unicoin_wallets')\
            .select('id, balance')\
            .eq('user_id', user_id)\
            .execute()
        
        if not wallet_response.data:
            new_wallet = supabase.table('unicoin_wallets')\
                .insert({'user_id': user_id, 'balance': amount, 'held_balance': 0})\
                .execute()
            wallet = new_wallet.data[0]
            
            supabase.table('unicoin_transactions').insert({
                'wallet_id': wallet['id'],
                'amount': amount,
                'type': 'deposit',
                'status': 'completed',
                'description': reason,
                'completed_at': datetime.now().isoformat()
            }).execute()
            
            return jsonify({'success': True, 'new_balance': amount}), 200
        else:
            wallet = wallet_response.data[0]
            
            supabase.table('unicoin_transactions').insert({
                'wallet_id': wallet['id'],
                'amount': amount,
                'type': 'deposit',
                'status': 'completed',
                'description': reason,
                'completed_at': datetime.now().isoformat()
            }).execute()
            
            new_balance = wallet['balance'] + amount
            supabase.table('unicoin_wallets')\
                .update({'balance': new_balance, 'updated_at': datetime.now().isoformat()})\
                .eq('id', wallet['id'])\
                .execute()
            
            # Log admin adjustment if admin_id is provided in request (not yet but could be)
            admin_id = data.get('admin_id')
            if admin_id:
                log_admin_action(admin_id, 'adjust_balance', user_id, {'amount': amount, 'reason': reason})
            
            return jsonify({'success': True, 'new_balance': new_balance}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/hold-funds', methods=['POST'])
def hold_funds():
    data = request.json
    user_id = data.get('user_id')
    amount = data.get('amount')
    order_id = data.get('order_id')
    
    if not user_id or not amount:
        return jsonify({'error': 'user_id and amount required'}), 400
    
    try:
        wallet_response = supabase.table('unicoin_wallets')\
            .select('id, balance, held_balance')\
            .eq('user_id', user_id)\
            .execute()
        
        if not wallet_response.data:
            return jsonify({'error': 'Wallet not found'}), 404
        
        wallet = wallet_response.data[0]
        
        if wallet['balance'] < amount:
            return jsonify({'error': 'Insufficient balance'}), 400
        
        new_balance = wallet['balance'] - amount
        new_held_balance = wallet.get('held_balance', 0) + amount
        
        supabase.table('unicoin_wallets')\
            .update({
                'balance': new_balance,
                'held_balance': new_held_balance,
                'updated_at': datetime.now().isoformat()
            })\
            .eq('id', wallet['id'])\
            .execute()
        
        supabase.table('unicoin_transactions').insert({
            'wallet_id': wallet['id'],
            'amount': -amount,
            'type': 'hold',
            'status': 'pending',
            'description': f'Fonds bloqués pour commande {order_id}',
            'reference_id': order_id,
            'created_at': datetime.now().isoformat()
        }).execute()
        
        return jsonify({'success': True, 'held_balance': new_held_balance}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/release-funds', methods=['POST'])
def release_funds():
    data = request.json
    seller_id = data.get('seller_id')
    buyer_id = data.get('buyer_id')
    amount = data.get('amount')
    order_id = data.get('order_id')
    
    if not seller_id or not amount:
        return jsonify({'error': 'seller_id and amount required'}), 400
    
    try:
        if buyer_id:
            buyer_wallet = supabase.table('unicoin_wallets')\
                .select('id, held_balance')\
                .eq('user_id', buyer_id)\
                .execute()
            
            if buyer_wallet.data:
                buyer = buyer_wallet.data[0]
                new_held = max(0, buyer.get('held_balance', 0) - amount)
                supabase.table('unicoin_wallets')\
                    .update({'held_balance': new_held, 'updated_at': datetime.now().isoformat()})\
                    .eq('id', buyer['id'])\
                    .execute()
        
        seller_wallet = supabase.table('unicoin_wallets')\
            .select('id, balance')\
            .eq('user_id', seller_id)\
            .execute()
        
        if not seller_wallet.data:
            new_wallet = supabase.table('unicoin_wallets')\
                .insert({'user_id': seller_id, 'balance': amount, 'held_balance': 0})\
                .execute()
            seller = new_wallet.data[0]
        else:
            seller = seller_wallet.data[0]
            new_balance = seller['balance'] + amount
            supabase.table('unicoin_wallets')\
                .update({'balance': new_balance, 'updated_at': datetime.now().isoformat()})\
                .eq('id', seller['id'])\
                .execute()
        
        supabase.table('unicoin_transactions').insert({
            'wallet_id': seller['id'],
            'amount': amount,
            'type': 'payment',
            'status': 'completed',
            'description': f'Paiement commande {order_id}',
            'reference_id': order_id,
            'completed_at': datetime.now().isoformat()
        }).execute()
        
        return jsonify({'success': True}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/refund-funds', methods=['POST'])
def refund_funds():
    data = request.json
    buyer_id = data.get('buyer_id')
    amount = data.get('amount')
    order_id = data.get('order_id')
    
    if not buyer_id or not amount:
        return jsonify({'error': 'buyer_id and amount required'}), 400
    
    try:
        buyer_wallet = supabase.table('unicoin_wallets')\
            .select('id, balance, held_balance')\
            .eq('user_id', buyer_id)\
            .execute()
        
        if buyer_wallet.data:
            buyer = buyer_wallet.data[0]
            new_held = max(0, buyer.get('held_balance', 0) - amount)
            new_balance = buyer['balance'] + amount
            
            supabase.table('unicoin_wallets')\
                .update({
                    'balance': new_balance,
                    'held_balance': new_held,
                    'updated_at': datetime.now().isoformat()
                })\
                .eq('id', buyer['id'])\
                .execute()
            
            supabase.table('unicoin_transactions').insert({
                'wallet_id': buyer['id'],
                'amount': amount,
                'type': 'refund',
                'status': 'completed',
                'description': f'Remboursement commande {order_id}',
                'reference_id': order_id,
                'completed_at': datetime.now().isoformat()
            }).execute()
        
        return jsonify({'success': True}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500
# ==================== ADMIN API ====================

@app.route('/api/admin/stats', methods=['GET'])
def get_admin_stats():
    try:
        # Nombre total d'utilisateurs
        users_count = supabase.table('users').select('id', count='exact').execute().count
        
        # Nombre total de services et leads
        services_count = supabase.table('services').select('id', count='exact').execute().count
        leads_count = supabase.table('leads').select('id', count='exact').execute().count
        
        # Volume UniCoin total
        wallets = supabase.table('unicoin_wallets').select('balance').execute()
        total_balance = sum(w['balance'] for w in wallets.data) if wallets.data else 0
        
        # Litiges en attente
        disputes_count = supabase.table('orders').select('id', count='exact').eq('dispute_status', 'pending').execute().count
        
        # Nouveaux utilisateurs aujourd'hui
        today = datetime.now().strftime('%Y-%m-%d')
        new_users = supabase.table('users').select('id', count='exact').gte('created_at', today).execute().count

        return jsonify({
            'usersCount': users_count,
            'itemsCount': services_count + leads_count,
            'totalBalance': total_balance,
            'activeDisputes': disputes_count,
            'newUsersToday': new_users,
            'pendingModeration': 0 # À implémenter avec un flag 'pending'
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/users', methods=['GET'])
def admin_get_users():
    try:
        query = supabase.table('users').select('*')
        
        role = request.args.get('role')
        status = request.args.get('status')
        search = request.args.get('search')
        
        if role:
            query = query.eq('role', role)
        if status:
            query = query.eq('status', status)
        
        response = query.order('created_at', desc=True).execute()
        
        users = response.data
        if search:
            search = search.lower()
            users = [u for u in users if search in u.get('full_name', '').lower() or search in u.get('email', '').lower()]
            
        return jsonify(users), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/users/<user_id>/verify', methods=['POST'])
def admin_verify_user(user_id):
    try:
        supabase.table('users').update({'status': 'verifie'}).eq('id', user_id).execute()
        # Log audit
        return jsonify({'success': True}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/users/<user_id>/unverify', methods=['POST'])
def admin_unverify_user(user_id):
    try:
        supabase.table('users').update({'status': 'en_attente'}).eq('id', user_id).execute()
        return jsonify({'success': True}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/users/bulk-verify', methods=['POST'])
def admin_bulk_verify_users():
    try:
        data = request.json
        user_ids = data.get('user_ids', [])
        if not user_ids:
            return jsonify({'success': True}), 200
        
        supabase.table('users').update({'status': 'verifie'}).in_('id', user_ids).execute()
        return jsonify({'success': True}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/create-admin', methods=['POST'])
def create_admin():
    try:
        data = request.json
        email = data.get('email', '').strip()
        password = data.get('password')
        first_name = data.get('first_name')
        last_name = data.get('last_name')
        admin_id = data.get('admin_id')

        if not email or not password:
            return jsonify({'detail': 'Email et mot de passe requis'}), 400

        user_id = None
        try:
            if supabase_admin:
                # Mode Admin: Création directe sans email de confirmation
                auth_response = supabase_admin.auth.admin.create_user({
                    'email': email,
                    'password': password,
                    'email_confirm': True,
                    'user_metadata': {
                        'first_name': first_name,
                        'last_name': last_name,
                        'role': 'admin'
                    }
                })
                user_id = auth_response.user.id
            else:
                # Mode standard: Utilise sign_up
                auth_response = supabase.auth.sign_up({
                    'email': email,
                    'password': password,
                    'options': {
                        'data': {
                            'first_name': first_name,
                            'last_name': last_name,
                            'role': 'admin'
                        }
                    }
                })
                if not auth_response.user:
                     return jsonify({'detail': 'Erreur lors de la création du compte Auth.'}), 400
                user_id = auth_response.user.id
                
                # Tentative d'auto-confirmation SQL (nécessite la fonction exec_sql)
                try:
                    confirm_sql = f"UPDATE auth.users SET email_confirmed_at = NOW(), confirmed_at = NOW() WHERE id = '{user_id}'"
                    supabase.rpc('exec_sql', {'sql': confirm_sql}).execute()
                except: pass

            # Création du profil public
            supabase.table('users').upsert({
                'id': user_id,
                'email': email,
                'full_name': f"{first_name} {last_name}",
                'status': 'verifie',
                'admin_role': 'admin',
                'created_at': datetime.now().isoformat()
            }).execute()

            # Création du portefeuille
            supabase.table('unicoin_wallets').upsert({
                'user_id': user_id,
                'balance': 0,
                'held_balance': 0
            }).execute()

            if admin_id:
                log_admin_action(admin_id, 'create_admin', user_id, {'email': email})

            return jsonify({'success': True, 'user_id': user_id}), 201

        except Exception as auth_error:
            error_msg = str(auth_error)
            if "Error sending confirmation email" in error_msg:
                return jsonify({
                    'detail': "Erreur Supabase: Impossible d'envoyer l'e-mail de confirmation. \n\n" + 
                              "POUR RÉGLER CELA : \n" +
                              "1. Désactivez 'Confirm Email' dans votre Dashboard Supabase (Settings > Auth) \n" +
                              "2. OU ajoutez SUPABASE_SERVICE_ROLE_KEY dans votre .env pour contourner la validation."
                }), 400
            if "User already registered" in error_msg:
                return jsonify({'detail': 'Cet email est déjà utilisé par un autre utilisateur.'}), 400
            return jsonify({'detail': f'Erreur Auth: {error_msg}'}), 500

    except Exception as e:
        return jsonify({'detail': f'Erreur Interne: {str(e)}'}), 500

@app.route('/api/admin/users/<user_id>/suspend', methods=['POST'])
def admin_suspend_user(user_id):
    data = request.json
    suspended = data.get('suspended', True)
    try:
        supabase.table('users').update({'suspended': suspended}).eq('id', user_id).execute()
        
        # Log suspension
        admin_id = data.get('admin_id')
        if admin_id:
            log_admin_action(admin_id, 'suspend_user' if suspended else 'unsuspend_user', user_id, {'reason': data.get('reason', '')})
            
        return jsonify({'success': True}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/users/<user_id>/ban', methods=['POST'])
def admin_ban_user(user_id):
    try:
        data = request.json
        admin_id = data.get('admin_id')
        
        # 1. Update user: banned = true, anonymize email, suspended = true
        anon_email = f"banned_{user_id[:8]}@uniskills.ma"
        supabase.table('users').update({
            'banned': True,
            'suspended': True,
            'email': anon_email
        }).eq('id', user_id).execute()
        
        # 2. Masquer les annonces (services et leads)
        supabase.table('services').update({'status': 'removed'}).eq('user_id', user_id).execute()
        supabase.table('leads').update({'status': 'removed'}).eq('owner_id', user_id).execute()
        
        # 3. Récupérer et confisquer le solde (remise à zéro)
        wallet_res = supabase.table('unicoin_wallets').select('id, balance').eq('user_id', user_id).execute()
        if wallet_res.data:
            wallet = wallet_res.data[0]
            if wallet['balance'] > 0:
                confiscated_amount = wallet['balance']
                # Mettre le solde à zéro
                supabase.table('unicoin_wallets').update({'balance': 0}).eq('id', wallet['id']).execute()
                # Enregistrer la transaction
                supabase.table('unicoin_transactions').insert({
                    'wallet_id': wallet['id'],
                    'amount': -confiscated_amount,
                    'type': 'admin_confiscation',
                    'status': 'completed',
                    'description': 'Saisie suite au bannissement du compte',
                    'completed_at': datetime.now().isoformat()
                }).execute()
        
        # 4. Log
        if admin_id:
            log_admin_action(admin_id, 'ban_user', user_id, {'reason': 'Violation des conditions', 'confiscated': True})
            
        return jsonify({'success': True}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/users/<user_id>/unban', methods=['POST'])
def admin_unban_user(user_id):
    try:
        data = request.json
        admin_id = data.get('admin_id')
        
        supabase.table('users').update({
            'banned': False,
            'suspended': False
        }).eq('id', user_id).execute()
        
        if admin_id:
            log_admin_action(admin_id, 'unban_user', user_id)
            
        return jsonify({'success': True}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/categories', methods=['GET', 'POST'])
def admin_categories():
    if request.method == 'GET':
        try:
            response = supabase.table('categories').select('*').order('name').execute()
            return jsonify(response.data), 200
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    else:
        try:
            data = request.json
            admin_id = data.get('admin_id')
            response = supabase.table('categories').insert({k: v for k, v in data.items() if k != 'admin_id'}).execute()
            
            if admin_id and response.data:
                log_admin_action(admin_id, 'create_category', response.data[0]['id'], {'name': data.get('name')})
                
            return jsonify(response.data[0]), 201
        except Exception as e:
            return jsonify({'error': str(e)}), 500

@app.route('/api/admin/categories/<cat_id>', methods=['PUT', 'DELETE'])
def admin_categories_modify(cat_id):
    if request.method == 'PUT':
        try:
            data = request.json
            response = supabase.table('categories').update(data).eq('id', cat_id).execute()
            return jsonify(response.data[0] if response.data else {}), 200
        except Exception as e:
            return jsonify({'error': str(e)}), 500
    elif request.method == 'DELETE':
        try:
            supabase.table('categories').delete().eq('id', cat_id).execute()
            return jsonify({'success': True}), 200
        except Exception as e:
            return jsonify({'error': str(e)}), 500

@app.route('/api/admin/reports', methods=['GET'])
def admin_get_reports():
    try:
        response = supabase.table('reports')\
            .select('*, reporter:users!reporter_id(full_name)')\
            .order('created_at', desc=True)\
            .execute()
        return jsonify(response.data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/reports/<report_id>/resolve', methods=['PUT'])
def admin_resolve_report(report_id):
    try:
        data = request.json
        action = data.get('action') # 'dismissed', 'resolved', 'deleted', 'suspended'
        admin_id = data.get('admin_id')
        report = supabase.table('reports').select('*').eq('id', report_id).execute()
        if not report.data:
            return jsonify({'error': 'Report not found'}), 404
        report_data = report.data[0]
        
        updates = {'status': 'resolved' if action != 'dismissed' else 'dismissed'}
        
        if action == 'suspended' and data.get('target_user_id'):
            supabase.table('users').update({'suspended': True}).eq('id', data['target_user_id']).execute()
            updates['resolution_notes'] = 'Utilisateur suspendu'
        elif action == 'warned' and data.get('target_user_id'):
            supabase.table('notifications').insert({
                'user_id': data['target_user_id'],
                'title': "⚠️ Avertissement de Modération",
                'message': "Votre comportement a été signalé et jugé contraire à nos règles. Veuillez respecter la charte de la plateforme.",
                'type': 'warning',
                'read': False
            }).execute()
            updates['resolution_notes'] = 'Utilisateur averti'
        elif action == 'deleted':
            target_type = report_data.get('target_type')
            target_id = report_data.get('target_id')
            if target_type == 'service':
                supabase.table('services').delete().eq('id', target_id).execute()
            elif target_type == 'lead':
                supabase.table('leads').delete().eq('id', target_id).execute()
            elif target_type == 'message':
                supabase.table('messages').delete().eq('id', target_id).execute()
            updates['resolution_notes'] = f'Contenu supprimé ({target_type})'
        response = supabase.table('reports').update(updates).eq('id', report_id).execute()
        
        if admin_id:
            log_admin_action(admin_id, 'resolve_report', report_id, {'resolution': action})
            
        return jsonify({'success': True}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/audit-logs', methods=['GET'])
def admin_get_audit_logs():
    try:
        response = supabase.table('audit_logs')\
            .select('*, admin:users!admin_id(full_name)')\
            .order('created_at', desc=True)\
            .limit(100)\
            .execute()
        return jsonify(response.data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/moderations/services', methods=['GET'])
def get_moderation_services():
    try:
        # Auto-reject pass
        banned_keywords = ['arnaque', 'examen', 'devoir', 'partiel', 'test en ligne']
        pending = supabase.table('services').select('*').eq('moderation_status', 'pending_review').execute()
        
        for item in pending.data:
            text = (item.get('title', '') + ' ' + item.get('description', '')).lower()
            if any(word in text for word in banned_keywords):
                # Auto reject
                supabase.table('services').update({
                    'moderation_status': 'rejected',
                    'moderation_reason': 'Rejet automatique : Contenu interdit (Triche académique ou Fraude)',
                    'status': 'removed'
                }).eq('id', item['id']).execute()
                
                # Notify
                supabase.table('notifications').insert({
                    'user_id': item['user_id'],
                    'title': "❌ Service rejeté automatiquement",
                    'message': f"❌ Votre service '{item['title']}' a été rejeté car il ne respecte pas nos conditions générales (Triche académique ou Fraude).",
                    'type': 'error',
                    'read': False
                }).execute()

        response = supabase.table('services')\
            .select('*, user:users!user_id(id, full_name, email)')\
            .eq('moderation_status', 'pending_review')\
            .order('created_at', desc=False)\
            .execute()
        return jsonify(response.data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/moderations/service/<service_id>', methods=['POST'])
def moderate_service(service_id):
    try:
        data = request.json
        new_status = data.get('moderation_status')
        admin_id = data.get('admin_id')
        reason = data.get('moderation_reason')
        
        # Determine actual status (e.g. if approved, make it active)
        actual_status = 'active' if new_status == 'approved' else ('removed' if new_status == 'rejected' else 'draft')
        
        supabase.table('services').update({
            'moderation_status': new_status,
            'moderation_reason': reason,
            'status': actual_status
        }).eq('id', service_id).execute()
        
        # Get service details to find the owner
        service_data = supabase.table('services').select('user_id, title').eq('id', service_id).execute()
        if service_data.data:
            user_id = service_data.data[0]['user_id']
            title = service_data.data[0]['title']
            
            # Prepare notification
            notif_title = ""
            notif_content = ""
            
            if new_status == 'approved':
                notif_title = "✅ Service en ligne"
                notif_content = f"✅ Votre service '{title}' est en ligne"
            elif new_status == 'rejected':
                notif_title = "❌ Service rejeté"
                notif_content = f"❌ Rejeté pour : {reason or 'Non conforme'}"
            elif new_status == 'revision':
                notif_title = "🔄 Modification demandée"
                notif_content = f"🔄 Veuillez modifier votre annonce '{title}'"
                
            if notif_title:
                supabase.table('notifications').insert({
                    'user_id': user_id,
                    'title': notif_title,
                    'message': notif_content,
                    'type': 'info',
                    'read': False
                }).execute()
        
        if admin_id:
            log_admin_action(admin_id, f'moderate_service_{new_status}', service_id)
            
        return jsonify({'success': True}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/moderations/leads', methods=['GET'])
def get_moderation_leads():
    try:
        # Auto-reject pass
        banned_keywords = ['arnaque', 'examen', 'devoir', 'partiel', 'test en ligne']
        pending = supabase.table('leads').select('*').eq('moderation_status', 'pending_review').execute()
        
        for item in pending.data:
            text = (item.get('title', '') + ' ' + item.get('description', '')).lower()
            if any(word in text for word in banned_keywords):
                # Auto reject
                supabase.table('leads').update({
                    'moderation_status': 'rejected',
                    'moderation_reason': 'Rejet automatique : Contenu interdit (Triche académique ou Fraude)',
                    'status': 'removed'
                }).eq('id', item['id']).execute()
                
                # Notify
                supabase.table('notifications').insert({
                    'user_id': item['owner_id'],
                    'title': "❌ Demande rejetée automatiquement",
                    'message': f"❌ Votre demande '{item['title']}' a été rejetée car elle ne respecte pas nos conditions générales (Triche académique ou Fraude).",
                    'type': 'error',
                    'read': False
                }).execute()

        response = supabase.table('leads')\
            .select('*, owner:users!owner_id(id, full_name, email)')\
            .eq('moderation_status', 'pending_review')\
            .order('created_at', desc=False)\
            .execute()
        return jsonify(response.data), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/moderations/lead/<lead_id>', methods=['POST'])
def moderate_lead(lead_id):
    try:
        data = request.json
        new_status = data.get('moderation_status')
        admin_id = data.get('admin_id')
        reason = data.get('moderation_reason')
        
        # Determine actual status
        actual_status = 'open' if new_status == 'approved' else ('removed' if new_status == 'rejected' else 'draft')
        
        supabase.table('leads').update({
            'moderation_status': new_status,
            'moderation_reason': reason,
            'status': actual_status
        }).eq('id', lead_id).execute()
        
        # Get lead details to find the owner
        lead_data = supabase.table('leads').select('owner_id, title').eq('id', lead_id).execute()
        if lead_data.data:
            owner_id = lead_data.data[0]['owner_id']
            title = lead_data.data[0]['title']
            
            # Prepare notification
            notif_title = ""
            notif_content = ""
            
            if new_status == 'approved':
                notif_title = "✅ Demande en ligne"
                notif_content = f"✅ Votre demande '{title}' est en ligne"
            elif new_status == 'rejected':
                notif_title = "❌ Demande rejetée"
                notif_content = f"❌ Rejeté pour : {reason or 'Non conforme'}"
            elif new_status == 'revision':
                notif_title = "🔄 Modification demandée"
                notif_content = f"🔄 Veuillez modifier votre annonce '{title}'"
                
            if notif_title:
                supabase.table('notifications').insert({
                    'user_id': owner_id,
                    'title': notif_title,
                    'message': notif_content,
                    'type': 'info',
                    'read': False
                }).execute()
        
        if admin_id:
            log_admin_action(admin_id, f'moderate_lead_{new_status}', lead_id)
            
        return jsonify({'success': True}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/moderations/flagged', methods=['GET'])
def get_flagged_content():
    try:
        # A mock implementation or actual query that finds records where moderation_flagged_words is not null or empty
        # Requires advanced filtering which might be complex, so we just fetch all pending
        services = supabase.table('services').select('*').eq('moderation_status', 'pending_review').execute()
        leads = supabase.table('leads').select('*').eq('moderation_status', 'pending_review').execute()
        
        flagged = []
        for s in services.data:
            if s.get('moderation_flagged_words'):
                flagged.append({'type': 'service', 'data': s})
        for l in leads.data:
            if l.get('moderation_flagged_words'):
                flagged.append({'type': 'lead', 'data': l})
                
        return jsonify(flagged), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/moderations/summary', methods=['GET'])
def get_moderation_summary():
    try:
        # 1. Services en attente
        services_pending = supabase.table('services').select('id', count='exact').eq('moderation_status', 'pending_review').execute()
        
        # 2. Demandes en attente
        leads_pending = supabase.table('leads').select('id', count='exact').eq('moderation_status', 'pending_review').execute()
        
        # 3. Signalements
        reports_pending = supabase.table('reports').select('id', count='exact').eq('status', 'pending').execute()
        
        # 4. Approuvés ce mois (mocked count via query)
        now = datetime.now()
        first_day = now.replace(day=1).isoformat()
        services_approved = supabase.table('services').select('id', count='exact').eq('moderation_status', 'approved').gte('updated_at', first_day).execute()
        leads_approved = supabase.table('leads').select('id', count='exact').eq('moderation_status', 'approved').gte('updated_at', first_day).execute()
        approved_this_month = (services_approved.count or 0) + (leads_approved.count or 0)
        
        # 5. Alertes
        alerts = []
        
        # Services avec mots interdits
        services_flagged = supabase.table('services').select('id, title, moderation_flagged_words').eq('moderation_status', 'pending_review').execute()
        flagged_count = len([s for s in services_flagged.data if s.get('moderation_flagged_words')])
        if flagged_count > 0:
            alerts.append(f"{flagged_count} services avec mots interdits (sévérité HIGH) → action immédiate")
            
        # Demandes budget anormal (<10 UC ou >10000 UC)
        leads_abnormal = supabase.table('leads').select('id, budget').eq('moderation_status', 'pending_review').execute()
        abnormal_count = len([l for l in leads_abnormal.data if l.get('budget', 0) < 10 or l.get('budget', 0) > 10000])
        if abnormal_count > 0:
            alerts.append(f"{abnormal_count} demande{'s' if abnormal_count > 1 else ''} avec budget anormal (<10 UC ou >10000 UC)")
            
        # Signalements en attente depuis +48h
        two_days_ago = (datetime.now() - timedelta(days=2)).isoformat()
        reports_old = supabase.table('reports').select('id', count='exact').eq('status', 'pending').lte('created_at', two_days_ago).execute()
        if reports_old.count and reports_old.count > 0:
            alerts.append(f"{reports_old.count} signalement{'s' if reports_old.count > 1 else ''} en attente depuis +48h")

        return jsonify({
            'stats': {
                'services_pending': services_pending.count or 0,
                'leads_pending': leads_pending.count or 0,
                'reports': reports_pending.count or 0,
                'approved_month': approved_this_month
            },
            'alerts': alerts
        }), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/archives', methods=['GET'])
def get_archives():
    try:
        services = supabase.table('services').select('*, user:users!user_id(full_name)').eq('status', 'removed').execute()
        leads = supabase.table('leads').select('*, owner:users!owner_id(full_name)').eq('status', 'removed').execute()
        
        results = []
        for s in services.data:
            s['item_type'] = 'service'
            results.append(s)
        for l in leads.data:
            l['item_type'] = 'lead'
            results.append(l)
            
        results.sort(key=lambda x: x.get('updated_at', x.get('created_at')), reverse=True)
        return jsonify(results), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/archives/restore', methods=['POST'])
def restore_archive():
    try:
        data = request.json
        item_id = data.get('id')
        item_type = data.get('item_type')
        admin_id = data.get('admin_id')
        
        if item_type == 'service':
            supabase.table('services').update({'status': 'active'}).eq('id', item_id).execute()
        else:
            supabase.table('leads').update({'status': 'open'}).eq('id', item_id).execute()
            
        if admin_id:
            log_admin_action(admin_id, 'restore_archive', item_id, {'type': item_type})
            
        return jsonify({'success': True}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/admin/archives/hard-delete', methods=['DELETE'])
def hard_delete_archive():
    try:
        data = request.json
        item_id = data.get('id')
        item_type = data.get('item_type')
        admin_id = data.get('admin_id')
        
        if item_type == 'service':
            supabase.table('services').delete().eq('id', item_id).execute()
        else:
            supabase.table('leads').delete().eq('id', item_id).execute()
            
        if admin_id:
            log_admin_action(admin_id, 'hard_delete_archive', item_id, {'type': item_type})
            
        return jsonify({'success': True}), 200
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ==================== LANCEMENT ====================

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5051))
    print(f"[Python] Starting Flask backend on port {port}")
    print(f"[Python] Supabase URL: {SUPABASE_URL}")
    app.run(host='127.0.0.1', port=port, debug=True)