
from server.models.database import get_db_connection
import uuid

class MessageController:
    @staticmethod
    def get_conversations(user_id):
        conn = get_db_connection()
        cursor = conn.cursor()
        query = '''
            SELECT c.id as conversation_id,
                   c.participant_one,
                   c.participant_two,
                   c.service_id,
                   c.lead_id,
                   c.last_message,
                   c.updated_at,
                   u.id as participant_id,
                   u.first_name, u.last_name, u.avatar_url, u.university, u.city,
                   u.role as participant_role,
                   s.title as service_title, s.image_url as service_image,
                   l.title as lead_title, l.image_url as lead_image
            FROM conversations c
            JOIN users u ON (u.id = c.participant_one OR u.id = c.participant_two) AND u.id != ?
            LEFT JOIN services s ON c.service_id = s.id
            LEFT JOIN leads l ON c.lead_id = l.id
            WHERE c.participant_one = ? OR c.participant_two = ?
            ORDER BY c.updated_at DESC
        '''
        cursor.execute(query, (user_id, user_id, user_id))
        conversations = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return conversations, 200

    @staticmethod
    def get_messages(conversation_id):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM messages WHERE conversation_id = ? ORDER BY created_at ASC', (conversation_id,))
        messages = [dict(row) for row in cursor.fetchall()]
        conn.close()
        return messages, 200

    @staticmethod
    def send_message(data):
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            
            conversation_id = data.get('conversation_id')
            sender_id = data.get('sender_id')
            recipient_id = data.get('recipient_id')
            content = data.get('content')
            service_id = data.get('service_id')
            lead_id = data.get('lead_id')
            
            # Create conversation if it doesn't exist
            if not conversation_id:
                # Check for existing conversation between these two for this service/lead
                if service_id:
                    cursor.execute('SELECT id FROM conversations WHERE ((participant_one = ? AND participant_two = ?) OR (participant_one = ? AND participant_two = ?)) AND service_id = ?', (sender_id, recipient_id, recipient_id, sender_id, service_id))
                elif lead_id:
                    cursor.execute('SELECT id FROM conversations WHERE ((participant_one = ? AND participant_two = ?) OR (participant_one = ? AND participant_two = ?)) AND lead_id = ?', (sender_id, recipient_id, recipient_id, sender_id, lead_id))
                else:
                    cursor.execute('SELECT id FROM conversations WHERE ((participant_one = ? AND participant_two = ?) OR (participant_one = ? AND participant_two = ?)) AND service_id IS NULL AND lead_id IS NULL', (sender_id, recipient_id, recipient_id, sender_id))
                
                row = cursor.fetchone()
                if row:
                    conversation_id = row['id']
                else:
                    conversation_id = str(uuid.uuid4())
                    cursor.execute('''
                        INSERT INTO conversations (id, participant_one, participant_two, service_id, lead_id, last_message)
                        VALUES (?, ?, ?, ?, ?, ?)
                    ''', (conversation_id, sender_id, recipient_id, service_id, lead_id, content))
            
            # Insert message
            msg_id = str(uuid.uuid4())
            cursor.execute('''
                INSERT INTO messages (id, conversation_id, sender_id, content)
                VALUES (?, ?, ?, ?)
            ''', (msg_id, conversation_id, sender_id, content))
            
            # Update conversation last message and timestamp
            cursor.execute('UPDATE conversations SET last_message = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', (content, conversation_id))
            
            conn.commit()
            conn.close()
            return {"status": "success", "conversation_id": conversation_id, "id": msg_id}, 201
        except Exception as e:
            return {"error": str(e)}, 500
