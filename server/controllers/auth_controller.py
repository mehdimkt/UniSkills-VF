
import hashlib
import uuid
import sqlite3
from server.models.database import get_db_connection

class AuthController:
    @staticmethod
    def register(data):
        conn = get_db_connection()
        cursor = conn.cursor()
        user_id = str(uuid.uuid4())
        
        if not data.get('password') or not data.get('email'):
            return {"error": "Email and password are required."}, 400
            
        password_hash = hashlib.sha256(data['password'].encode()).hexdigest()
        
        try:
            cursor.execute('''
                INSERT INTO users (id, first_name, last_name, email, password_hash, city, university, level)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ''', (user_id, data.get('first_name'), data.get('last_name'), data.get('email'), password_hash, 
                  data.get('city'), data.get('university'), data.get('level')))
            conn.commit()
            return {"token": user_id, "user": {"id": user_id, "email": data['email'], "role": "demandeur"}}, 201
        except sqlite3.IntegrityError:
            return {"error": "Cet email est déjà utilisé."}, 400
        finally:
            conn.close()

    @staticmethod
    def login(email, password):
        if not email or not password:
            return {"error": "Email and password are required."}, 400
            
        conn = get_db_connection()
        cursor = conn.cursor()
        password_hash = hashlib.sha256(password.encode()).hexdigest()
        
        cursor.execute('SELECT * FROM users WHERE email = ? AND password_hash = ?', (email, password_hash))
        user = cursor.fetchone()
        conn.close()
        
        if user:
            user_dict = dict(user)
            return {
                "token": user_dict['id'],
                "user": {
                    "id": user_dict['id'],
                    "first_name": user_dict['first_name'],
                    "last_name": user_dict['last_name'],
                    "email": user_dict['email'],
                    "role": user_dict['role'],
                    "university": user_dict['university']
                }
            }, 200
        else:
            return {"error": "Identifiants invalides."}, 401

    @staticmethod
    def get_profile(user_id):
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute('SELECT id, first_name, last_name, email, city, university, level, role, status, avatar_url, bio FROM users WHERE id = ?', (user_id,))
        user = cursor.fetchone()
        conn.close()
        if user:
            return dict(user), 200
        return {"error": "User not found"}, 404

    @staticmethod
    def update_profile(user_id, data):
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute('''
                UPDATE users 
                SET first_name = ?, last_name = ?, city = ?, university = ?, bio = ?, avatar_url = ?
                WHERE id = ?
            ''', (
                data.get('first_name'),
                data.get('last_name'),
                data.get('city'),
                data.get('university'),
                data.get('bio'),
                data.get('avatar_url'),
                user_id
            ))
            conn.commit()
            conn.close()
            return {"status": "success"}, 200
        except Exception as e:
            return {"error": str(e)}, 500
