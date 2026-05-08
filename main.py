import os
import uuid
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from supabase import create_client, Client
from dotenv import load_dotenv

# Charger les variables d'environnement
load_dotenv()

# Configuration Supabase
SUPABASE_URL = os.getenv("VITE_SUPABASE_URL", "https://gwdhvmfrzmtpsuozooqn.supabase.co")
SUPABASE_KEY = os.getenv("VITE_SUPABASE_ANON_KEY", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd3ZGh2bWZyem10cHN1b3pvb3FuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc4ODYzMjQsImV4cCI6MjA5MzQ2MjMyNH0.JgM2jtIgjN_mVx-EKrjsnCnonAV3HoWqFQ3yERbIbps")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

app = Flask(__name__)
CORS(app)

# ==================== HEALTH CHECK ====================

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'ok', 'message': 'Python backend is running!'}), 200

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
# ==================== LANCEMENT ====================

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5051))
    print(f"[Python] Starting Flask backend on port {port}")
    print(f"[Python] Supabase URL: {SUPABASE_URL}")
    app.run(host='127.0.0.1', port=port, debug=True)