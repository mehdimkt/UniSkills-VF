
import sqlite3
import os
import shutil

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../uniskills.db')
SOURCE_DB = DB_PATH

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    # Ensure /tmp/uniskills.db exists by copying or creating it
    if not os.path.exists(DB_PATH):
        if os.path.exists(SOURCE_DB):
            try:
                shutil.copy2(SOURCE_DB, DB_PATH)
                print(f"[Database] Copied initial database from {SOURCE_DB}")
            except Exception as e:
                print(f"[Database] Error copying database: {e}")
        else:
            print("[Database] Source database not found, a new one will be created.")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.executescript('''
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          first_name TEXT NOT NULL,
          last_name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          city TEXT,
          university TEXT,
          level TEXT,
          role TEXT DEFAULT 'demandeur',
          status TEXT DEFAULT 'non_verifie',
          avatar_url TEXT,
          bio TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS services (
          id TEXT PRIMARY KEY,
          owner_id TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          price REAL NOT NULL,
          category TEXT,
          delivery_time INTEGER,
          image_url TEXT,
          status TEXT DEFAULT 'active',
          FOREIGN KEY(owner_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS leads (
          id TEXT PRIMARY KEY,
          owner_id TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          budget REAL NOT NULL,
          category TEXT,
          deadline DATETIME,
          image_url TEXT,
          status TEXT DEFAULT 'open',
          FOREIGN KEY(owner_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS orders (
          id TEXT PRIMARY KEY,
          service_id TEXT,
          lead_id TEXT,
          buyer_id TEXT NOT NULL,
          seller_id TEXT NOT NULL,
          amount REAL NOT NULL,
          status TEXT DEFAULT 'pending',
          progress INTEGER DEFAULT 0,
          description TEXT,
          duration TEXT DEFAULT '48h',
          files TEXT DEFAULT '[]',
          is_pinned BOOLEAN DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(buyer_id) REFERENCES users(id),
          FOREIGN KEY(seller_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS messages (
          id TEXT PRIMARY KEY,
          conversation_id TEXT NOT NULL,
          sender_id TEXT NOT NULL,
          content TEXT NOT NULL,
          file_url TEXT,
          is_read BOOLEAN DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(conversation_id) REFERENCES conversations(id)
        );

        CREATE TABLE IF NOT EXISTS conversations (
          id TEXT PRIMARY KEY,
          participant_one TEXT NOT NULL,
          participant_two TEXT NOT NULL,
          service_id TEXT,
          lead_id TEXT,
          last_message TEXT,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(participant_one) REFERENCES users(id),
          FOREIGN KEY(participant_two) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS proposals (
          id TEXT PRIMARY KEY,
          lead_id TEXT,
          service_id TEXT,
          sender_id TEXT NOT NULL,
          content TEXT NOT NULL,
          budget REAL,
          status TEXT DEFAULT 'pending',
          is_pinned BOOLEAN DEFAULT 0,
          files TEXT DEFAULT '[]',
          deadline TEXT DEFAULT 'A définir',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY(lead_id) REFERENCES leads(id),
          FOREIGN KEY(service_id) REFERENCES services(id),
          FOREIGN KEY(sender_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS lead_files (
          id TEXT PRIMARY KEY,
          lead_id TEXT NOT NULL,
          file_url TEXT NOT NULL,
          file_type TEXT,
          FOREIGN KEY(lead_id) REFERENCES leads(id)
        );
    ''')

    # Migration for missing columns
    try:
        cursor.execute("SELECT service_id FROM proposals LIMIT 1")
    except sqlite3.OperationalError:
        print("[Database] Migrating: Adding service_id to proposals")
        cursor.execute("ALTER TABLE proposals ADD COLUMN service_id TEXT")
    
    try:
        cursor.execute("SELECT lead_id FROM proposals LIMIT 1")
    except sqlite3.OperationalError:
        print("[Database] Migrating: Adding lead_id to proposals")
        cursor.execute("ALTER TABLE proposals ADD COLUMN lead_id TEXT")
        
    try:
        cursor.execute("SELECT is_pinned FROM orders LIMIT 1")
    except sqlite3.OperationalError:
        print("[Database] Migrating: Adding is_pinned, description, duration, files to orders")
        cursor.execute("ALTER TABLE orders ADD COLUMN description TEXT")
        cursor.execute("ALTER TABLE orders ADD COLUMN duration TEXT DEFAULT '48h'")
        cursor.execute("ALTER TABLE orders ADD COLUMN files TEXT DEFAULT '[]'")
        cursor.execute("ALTER TABLE orders ADD COLUMN is_pinned BOOLEAN DEFAULT 0")

    try:
        cursor.execute("SELECT is_pinned FROM proposals LIMIT 1")
    except sqlite3.OperationalError:
        print("[Database] Migrating: Adding is_pinned, files, deadline to proposals")
        cursor.execute("ALTER TABLE proposals ADD COLUMN is_pinned BOOLEAN DEFAULT 0")
        cursor.execute("ALTER TABLE proposals ADD COLUMN files TEXT DEFAULT '[]'")
        cursor.execute("ALTER TABLE proposals ADD COLUMN deadline TEXT DEFAULT 'A définir'")

    try:
        cursor.execute("SELECT service_id FROM conversations LIMIT 1")
    except sqlite3.OperationalError:
        print("[Database] Migrating: Adding service_id to conversations")
        cursor.execute("ALTER TABLE conversations ADD COLUMN service_id TEXT")

    try:
        cursor.execute("SELECT files FROM leads LIMIT 1")
    except sqlite3.OperationalError:
        print("[Database] Migrating: Adding files to leads")
        cursor.execute("ALTER TABLE leads ADD COLUMN files TEXT DEFAULT '[]'")

    conn.commit()
    conn.commit()

    # Seed data
    cursor.execute('SELECT COUNT(*) FROM users')
    if cursor.fetchone()[0] == 0:
        cursor.executemany('''
            INSERT INTO users (id, first_name, last_name, email, password_hash, city, role, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', [
            ('u1', 'Mehdi', 'A.', 'mehdi@example.com', 'hash', 'Casablanca', 'demandeur', 'verifie'),
            ('u2', 'Salma', 'R.', 'salma@example.com', 'hash', 'Rabat', 'demandeur', 'verifie'),
            ('u3', 'Amine', 'K.', 'amine@example.com', 'hash', 'Rabat', 'aideur', 'verifie'),
            ('u4', 'Yassine', 'M.', 'yassine@example.com', 'hash', 'Marrakech', 'aideur', 'verifie')
        ])

    cursor.execute('SELECT COUNT(*) FROM services')
    if cursor.fetchone()[0] == 0:
        cursor.executemany('''
            INSERT INTO services (id, owner_id, title, description, price, category, delivery_time, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', [
            ('s1', 'u3', 'Expert Python & Data Science', 'Étudiant en 5ème année, spécialisé en IA et Data.', 100, 'Informatique', 2, 'active'),
            ('s2', 'u4', 'Design Logo & Branding Club', 'Identité visuelle moderne pour vos événements.', 350, 'Design', 4, 'active'),
            ('s3', 'u3', 'Optimisation Algorithmique', 'Analyse de complexité et optimisation C++/Python.', 250, 'Informatique', 3, 'active'),
            ('s4', 'u4', 'Montage Vidéo After Effects', 'Montage pro pour vos présentations et concours.', 200, 'Design', 5, 'active'),
            ('s5', 'u3', 'Cours Particuliers Maths Spé', 'Préparation intensive aux concours nationaux.', 150, 'Soutien Scolaire', 1, 'active')
        ])

    cursor.execute('SELECT COUNT(*) FROM leads')
    if cursor.fetchone()[0] == 0:
        cursor.executemany('''
            INSERT INTO leads (id, owner_id, title, description, budget, category, deadline, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', [
            ('l1', 'u1', 'Besoin Aide Algèbre S2 - ENSEM', 'Je galère sur les espaces vectoriels. Cherche un tuteur pour 3 séances.', 150, 'Soutien Scolaire', '2026-05-15', 'open'),
            ('l2', 'u2', 'Correction Rapport de Stage PFE', 'Besoin d\'une relecture attentive et correction orthographe.', 300, 'Rédaction', '2026-05-20', 'open'),
            ('l3', 'u1', 'App de gestion de stock Flutter', 'Besoin d\'une base solide pour un projet tutoré.', 800, 'Informatique', '2026-06-01', 'open'),
            ('l4', 'u2', 'Traduction Français-Arabe Technique', 'Traduction de 10 pages de spécifications techniques.', 400, 'Rédaction', '2026-05-30', 'open')
        ])

    cursor.execute('SELECT COUNT(*) FROM orders')
    if cursor.fetchone()[0] == 0:
        cursor.executemany('''
            INSERT INTO orders (id, service_id, buyer_id, seller_id, amount, status, progress)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', [
            ('o1', 's1', 'u1', 'u3', 100, 'completed', 100),
            ('o2', 's2', 'u2', 'u4', 350, 'in_progress', 45)
        ])

    conn.commit()
    conn.close()
