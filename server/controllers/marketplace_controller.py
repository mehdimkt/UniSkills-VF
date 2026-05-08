
from server.models.database import get_db_connection
import json

class MarketplaceController:
    @staticmethod
    def get_feed(role, category=None):
        conn = get_db_connection()
        cursor = conn.cursor()
        
        if role == 'aideur':
            query = '''
                SELECT l.*, u.first_name || " " || u.last_name as owner_name, u.city as owner_city,
                (SELECT COUNT(*) FROM orders o WHERE o.lead_id = l.id) as orders_count
                FROM leads l
                JOIN users u ON l.owner_id = u.id
                WHERE l.status = "open"
            '''
        else:
            query = '''
                SELECT s.*, u.first_name || " " || u.last_name as owner_name, u.city as owner_city,
                (SELECT COUNT(*) FROM orders o WHERE o.service_id = s.id) as orders_count
                FROM services s
                JOIN users u ON s.owner_id = u.id
                WHERE s.status = "active"
            '''
            
        params = []
        if category:
            query += ' AND category = ?'
            params.append(category)
            
        cursor.execute(query, params)
        items = []
        for row in cursor.fetchall():
            item = dict(row)
            # Map database keys to frontend MarketplaceItem keys
            item['owner_name'] = item.get('owner_name', 'Utilisateur')
            item['city'] = item.get('owner_city', 'Casablanca')
            item['orders_count'] = item.get('orders_count', 0)
            
            if role == 'aideur':
                item['type'] = 'lead'
                item['price'] = item.get('budget', 0)
                item['full_description'] = item.get('description', '')
                item['deadline'] = item.get('deadline', 'Non définie')
                # Simulated reviews for demo
                item['rating'] = 4.8
                item['reviewsCount'] = 12 + item['orders_count']
            else:
                item['type'] = 'service'
                item['full_description'] = item.get('description', '')
                # Simulated reviews for demo
                item['rating'] = 4.9
                item['reviewsCount'] = 25 + item['orders_count']
            
            items.append(item)
            
        conn.close()
        return items, 200

    @staticmethod
    def create_lead(data):
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO leads (id, owner_id, title, description, budget, category, deadline, image_url, status, files)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                data.get('id'),
                data.get('owner_id'),
                data.get('title'),
                data.get('description'),
                data.get('price'),
                data.get('category'),
                data.get('deadline'),
                data.get('image_url'),
                data.get('status', 'open'),
                json.dumps(data.get('files', []))
            ))
            conn.commit()
            conn.close()
            return {"status": "success"}, 201
        except Exception as e:
            return {"error": str(e)}, 500

    @staticmethod
    def create_service(data):
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute('''
                INSERT INTO services (id, owner_id, title, description, price, category, delivery_time, image_url, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                data.get('id'),
                data.get('owner_id'),
                data.get('title'),
                data.get('description'),
                data.get('price'),
                data.get('category'),
                data.get('delivery_time'),
                data.get('image_url'),
                data.get('status', 'active')
            ))
            conn.commit()
            conn.close()
            return {"status": "success"}, 201
        except Exception as e:
            return {"error": str(e)}, 500

    @staticmethod
    def get_orders(user_id):
        if not user_id:
            return {"error": "Unauthorized"}, 401
            
        conn = get_db_connection()
        cursor = conn.cursor()
        query = '''
            SELECT o.*, 
                   b.first_name || " " || b.last_name as buyer_name,
                   s.first_name || " " || s.last_name as seller_name,
                   COALESCE(svc.title, ld.title) as item_title,
                   COALESCE(svc.image_url, ld.image_url) as item_image
            FROM orders o
            JOIN users b ON o.buyer_id = b.id
            JOIN users s ON o.seller_id = s.id
            LEFT JOIN services svc ON o.service_id = svc.id
            LEFT JOIN leads ld ON o.lead_id = ld.id
            WHERE o.buyer_id = ? OR o.seller_id = ?
            ORDER BY o.updated_at DESC
        '''
        cursor.execute(query, (user_id, user_id))
        orders = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return orders, 200

    @staticmethod
    def create_order(data):
        print(f"[DEBUG] Creating order with data: {data}")
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            order_id = data.get('id')
            cursor.execute('''
                INSERT INTO orders (id, service_id, lead_id, buyer_id, seller_id, amount, status)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (
                order_id,
                data.get('service_id'),
                data.get('lead_id'),
                data.get('buyer_id'),
                data.get('seller_id'),
                data.get('amount'),
                data.get('status', 'pending')
            ))
            conn.commit()
            print(f"[DEBUG] Order created successfully: {order_id}")
            conn.close()
            return {"status": "success", "id": order_id}, 201
        except Exception as e:
            print(f"[DEBUG] Error creating order: {str(e)}")
            return {"error": str(e)}, 500

    @staticmethod
    def update_order(order_id, updates):
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            
            set_clauses = []
            params = []
            for key, value in updates.items():
                # Map frontend keys to DB keys if needed
                db_key = key
                if key == 'isPinned': db_key = 'is_pinned'
                
                # Check if column exists in set of allowed columns to avoid SQL injection
                allowed_columns = ['status', 'progress', 'description', 'duration', 'files', 'is_pinned', 'amount', 'title']
                if db_key in allowed_columns:
                    set_clauses.append(f"{db_key} = ?")
                    # Handle json serializing files if it's a list/dict
                    if db_key == 'files' and not isinstance(value, str):
                        params.append(json.dumps(value))
                    else:
                        params.append(value)
            
            if not set_clauses:
                return {"error": "No valid updates provided"}, 400
                
            query = f"UPDATE orders SET {', '.join(set_clauses)}, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
            params.append(order_id)
            
            cursor.execute(query, params)
            conn.commit()
            conn.close()
            return {"status": "success"}, 200
        except Exception as e:
            return {"error": str(e)}, 500

    @staticmethod
    def update_proposal(prop_id, updates):
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            
            set_clauses = []
            params = []
            for key, value in updates.items():
                db_key = key
                if key == 'isPinned': db_key = 'is_pinned'
                
                allowed_columns = ['status', 'content', 'budget', 'is_pinned', 'files', 'deadline']
                if db_key in allowed_columns:
                    set_clauses.append(f"{db_key} = ?")
                    if db_key == 'files' and not isinstance(value, str):
                        params.append(json.dumps(value))
                    else:
                        params.append(value)
            
            if not set_clauses:
                return {"error": "No valid updates provided"}, 400
                
            query = f"UPDATE proposals SET {', '.join(set_clauses)} WHERE id = ?"
            params.append(prop_id)
            
            cursor.execute(query, params)
            conn.commit()
            conn.close()
            return {"status": "success"}, 200
        except Exception as e:
            return {"error": str(e)}, 500

    @staticmethod
    def create_proposal(data):
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            prop_id = data.get('id')
            cursor.execute('''
                INSERT INTO proposals (id, lead_id, service_id, sender_id, content, budget)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (
                prop_id,
                data.get('lead_id'),
                data.get('service_id'),
                data.get('sender_id'),
                data.get('content'),
                data.get('budget')
            ))
            conn.commit()
            conn.close()
            return {"status": "success", "id": prop_id}, 201
        except Exception as e:
            return {"error": str(e)}, 500

    @staticmethod
    def get_proposals(user_id):
        if not user_id:
            return {"error": "Unauthorized"}, 401
            
        conn = get_db_connection()
        cursor = conn.cursor()
        # Get proposals sent BY me or FOR my leads/services
        query = '''
            SELECT p.*, 
                   u.first_name || " " || u.last_name as sender_name,
                   COALESCE(ld.title, svc.title) as lead_title,
                   COALESCE(ld.image_url, svc.image_url) as lead_image
            FROM proposals p
            JOIN users u ON p.sender_id = u.id
            LEFT JOIN leads ld ON p.lead_id = ld.id
            LEFT JOIN services svc ON p.service_id = svc.id
            WHERE p.sender_id = ? OR ld.owner_id = ? OR svc.owner_id = ?
            ORDER BY p.created_at DESC
        '''
        cursor.execute(query, (user_id, user_id, user_id))
        proposals = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return proposals, 200

    @staticmethod
    def update_lead(lead_id, updates):
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            
            set_clauses = []
            params = []
            for key, value in updates.items():
                db_key = key
                if key == 'price': db_key = 'budget'
                
                allowed_columns = ['title', 'description', 'budget', 'category', 'deadline', 'image_url', 'status', 'files']
                if db_key in allowed_columns:
                    set_clauses.append(f"{db_key} = ?")
                    if db_key == 'files' and not isinstance(value, str):
                        params.append(json.dumps(value))
                    else:
                        params.append(value)
            
            if not set_clauses:
                return {"error": "No valid updates provided"}, 400
                
            query = f"UPDATE leads SET {', '.join(set_clauses)} WHERE id = ?"
            params.append(lead_id)
            
            cursor.execute(query, params)
            conn.commit()
            conn.close()
            return {"status": "success"}, 200
        except Exception as e:
            return {"error": str(e)}, 500

    @staticmethod
    def delete_item(item_type, item_id, user_id):
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            table = 'leads' if item_type == 'lead' else 'services'
            cursor.execute(f'DELETE FROM {table} WHERE id = ? AND owner_id = ?', (item_id, user_id))
            conn.commit()
            conn.close()
            return {"status": "success"}, 200
        except Exception as e:
            return {"error": str(e)}, 500

    @staticmethod
    def get_my_items(user_id):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM leads WHERE owner_id = ?', (user_id,))
        leads = [dict(row) for row in cursor.fetchall()]
        cursor.execute('SELECT * FROM services WHERE owner_id = ?', (user_id,))
        services = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return {"leads": leads, "services": services}, 200
