import sqlite3
import time
import uuid
import json
import os
from pathlib import Path
from typing import List, Dict, Optional

# ==============================================================================
# FIREBASE FIRESTORE DATABASE DRIVER (PRIMARY)
# ==============================================================================
FIREBASE_ACTIVE = False
firestore_db = None

# Locate serviceAccountKey.json in root or backend directory
cred_path = Path(__file__).resolve().parent.parent / "serviceAccountKey.json"
if not cred_path.exists():
    cred_path = Path(__file__).resolve().parent / "serviceAccountKey.json"

try:
    import firebase_admin
    from firebase_admin import credentials, firestore
    
    if cred_path.exists():
        if not firebase_admin._apps:
            cred = credentials.Certificate(str(cred_path))
            firebase_admin.initialize_app(cred)
        firestore_db = firestore.client()
        FIREBASE_ACTIVE = True
        print(f"[Firebase DB] Successfully connected to Firebase Firestore project using {cred_path.name}")
    else:
        print(f"[Firebase DB] serviceAccountKey.json not found. Operating with SQLite storage.")
except Exception as e:
    print(f"[Firebase DB] Connection error ({e}). Operating with SQLite storage.")


# ==============================================================================
# SQLITE LOCAL STORAGE FALLBACK
# ==============================================================================
DB_PATH = Path(__file__).resolve().parent / "healio.db"

def get_connection():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        username TEXT PRIMARY KEY,
        password_hash TEXT NOT NULL,
        created_at REAL NOT NULL
    );
    """)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS chat_sessions (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        title TEXT NOT NULL,
        created_at REAL NOT NULL,
        updated_at REAL NOT NULL
    );
    """)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS chat_messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        username TEXT NOT NULL,
        type TEXT NOT NULL,
        text TEXT NOT NULL,
        emotions TEXT,
        timestamp TEXT NOT NULL,
        created_at REAL NOT NULL
    );
    """)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS journal_entries (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        mood TEXT,
        created_at REAL NOT NULL,
        updated_at REAL NOT NULL
    );
    """)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS mood_logs (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        mood_emoji TEXT NOT NULL,
        mood_label TEXT NOT NULL,
        created_at REAL NOT NULL
    );
    """)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS user_settings (
        username TEXT PRIMARY KEY,
        theme TEXT DEFAULT 'light',
        font_size TEXT DEFAULT 'medium',
        ai_tone TEXT DEFAULT 'Supportive',
        daily_reminder INTEGER DEFAULT 0,
        mood_reminder INTEGER DEFAULT 0,
        journal_reminder INTEGER DEFAULT 0,
        updated_at REAL NOT NULL
    );
    """)
    conn.commit()
    conn.close()

init_db()

# ==============================================================================
# USER AUTHENTICATION API
# ==============================================================================
def db_register_user_sqlite(username: str, password_hash: str) -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)",
            (username, password_hash, time.time())
        )
        cursor.execute(
            "INSERT OR IGNORE INTO user_settings (username, theme, font_size, ai_tone, updated_at) VALUES (?, ?, ?, ?, ?)",
            (username, 'light', 'medium', 'Supportive', time.time())
        )
        conn.commit()
        return True
    except sqlite3.IntegrityError:
        return False
    finally:
        conn.close()

def db_register_user(username: str, password_hash: str) -> bool:
    now = time.time()
    if FIREBASE_ACTIVE and firestore_db:
        try:
            doc_ref = firestore_db.collection("users").document(username)
            if doc_ref.get().exists:
                return False
            doc_ref.set({
                "username": username,
                "password_hash": password_hash,
                "created_at": now
            })
            firestore_db.collection("user_settings").document(username).set({
                "username": username,
                "theme": "light",
                "font_size": "medium",
                "ai_tone": "Supportive",
                "daily_reminder": 0,
                "mood_reminder": 0,
                "journal_reminder": 0,
                "updated_at": now
            })
            db_register_user_sqlite(username, password_hash)
            return True
        except Exception as e:
            print(f"[Firebase error] db_register_user: {e}")

    return db_register_user_sqlite(username, password_hash)

def db_verify_user(username: str, password_hash: str) -> bool:
    if FIREBASE_ACTIVE and firestore_db:
        try:
            doc = firestore_db.collection("users").document(username).get()
            if doc.exists:
                return doc.to_dict().get("password_hash") == password_hash
        except Exception as e:
            print(f"[Firebase error] db_verify_user: {e}")

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT password_hash FROM users WHERE username = ?", (username,))
    row = cursor.fetchone()
    conn.close()
    if row and row["password_hash"] == password_hash:
        return True
    return False

# ==============================================================================
# CHAT SESSIONS & MESSAGES API
# ==============================================================================
def create_chat_session(username: str, title: str = "New Conversation", session_id: Optional[str] = None) -> str:
    sid = session_id or f"sess_{uuid.uuid4().hex[:12]}"
    now = time.time()
    
    if FIREBASE_ACTIVE and firestore_db:
        try:
            firestore_db.collection("chat_sessions").document(sid).set({
                "id": sid,
                "username": username,
                "title": title,
                "created_at": now,
                "updated_at": now
            })
        except Exception as e:
            print(f"[Firebase error] create_chat_session: {e}")

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT OR REPLACE INTO chat_sessions (id, username, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        (sid, username, title, now, now)
    )
    conn.commit()
    conn.close()
    return sid

def get_user_sessions(username: str) -> List[Dict]:
    if FIREBASE_ACTIVE and firestore_db:
        try:
            query = firestore_db.collection("chat_sessions").where("username", "==", username).get()
            sessions = [d.to_dict() for d in query]
            sessions.sort(key=lambda x: x.get("updated_at", 0), reverse=True)
            for s in sessions:
                msgs = firestore_db.collection("chat_messages").where("session_id", "==", s["id"]).get()
                msg_list = [m.to_dict() for m in msgs]
                msg_list.sort(key=lambda x: x.get("created_at", 0), reverse=True)
                if msg_list:
                    s["last_message"] = msg_list[0].get("text", "")
                    s["last_timestamp"] = msg_list[0].get("timestamp", "")
                else:
                    s["last_message"] = ""
                    s["last_timestamp"] = ""
            return sessions
        except Exception as e:
            print(f"[Firebase error] get_user_sessions: {e}")

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM chat_sessions WHERE username = ? ORDER BY updated_at DESC", (username,))
    rows = cursor.fetchall()
    sessions = []
    for r in rows:
        cursor.execute("SELECT text, timestamp FROM chat_messages WHERE session_id = ? ORDER BY created_at DESC LIMIT 1", (r["id"],))
        last_msg = cursor.fetchone()
        sessions.append({
            "id": r["id"],
            "username": r["username"],
            "title": r["title"],
            "created_at": r["created_at"],
            "updated_at": r["updated_at"],
            "last_message": last_msg["text"] if last_msg else "",
            "last_timestamp": last_msg["timestamp"] if last_msg else ""
        })
    conn.close()
    return sessions

def get_session_messages(session_id: str, username: str) -> List[Dict]:
    if FIREBASE_ACTIVE and firestore_db:
        try:
            query = firestore_db.collection("chat_messages").where("session_id", "==", session_id).where("username", "==", username).get()
            msgs = [m.to_dict() for m in query]
            msgs.sort(key=lambda x: x.get("created_at", 0))
            return msgs
        except Exception as e:
            print(f"[Firebase error] get_session_messages: {e}")

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM chat_messages WHERE session_id = ? AND username = ? ORDER BY created_at ASC", (session_id, username))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def save_chat_message(session_id: str, username: str, msg_type: str, text: str, emotions: str = "", timestamp: str = "") -> Dict:
    msg_id = f"msg_{uuid.uuid4().hex[:12]}"
    now = time.time()
    msg_data = {
        "id": msg_id,
        "session_id": session_id,
        "username": username,
        "type": msg_type,
        "text": text,
        "emotions": emotions,
        "timestamp": timestamp,
        "created_at": now
    }

    if FIREBASE_ACTIVE and firestore_db:
        try:
            firestore_db.collection("chat_messages").document(msg_id).set(msg_data)
            firestore_db.collection("chat_sessions").document(session_id).update({"updated_at": now})
        except Exception as e:
            print(f"[Firebase error] save_chat_message: {e}")

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO chat_messages (id, session_id, username, type, text, emotions, timestamp, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (msg_id, session_id, username, msg_type, text, emotions, timestamp, now)
    )
    cursor.execute("UPDATE chat_sessions SET updated_at = ? WHERE id = ?", (now, session_id))
    conn.commit()
    conn.close()
    return msg_data

def update_session_title(session_id: str, title: str):
    now = time.time()
    if FIREBASE_ACTIVE and firestore_db:
        try:
            firestore_db.collection("chat_sessions").document(session_id).update({"title": title, "updated_at": now})
        except Exception as e:
            print(f"[Firebase error] update_session_title: {e}")

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE chat_sessions SET title = ?, updated_at = ? WHERE id = ?", (title, now, session_id))
    conn.commit()
    conn.close()

def delete_chat_session(session_id: str, username: str):
    if FIREBASE_ACTIVE and firestore_db:
        try:
            msgs = firestore_db.collection("chat_messages").where("session_id", "==", session_id).where("username", "==", username).get()
            for m in msgs:
                m.reference.delete()
            firestore_db.collection("chat_sessions").document(session_id).delete()
        except Exception as e:
            print(f"[Firebase error] delete_chat_session: {e}")

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM chat_messages WHERE session_id = ? AND username = ?", (session_id, username))
    cursor.execute("DELETE FROM chat_sessions WHERE id = ? AND username = ?", (session_id, username))
    conn.commit()
    conn.close()

def clear_all_user_sessions(username: str):
    if FIREBASE_ACTIVE and firestore_db:
        try:
            sessions = firestore_db.collection("chat_sessions").where("username", "==", username).get()
            for s in sessions:
                s.reference.delete()
            msgs = firestore_db.collection("chat_messages").where("username", "==", username).get()
            for m in msgs:
                m.reference.delete()
        except Exception as e:
            print(f"[Firebase error] clear_all_user_sessions: {e}")

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM chat_messages WHERE username = ?", (username,))
    cursor.execute("DELETE FROM chat_sessions WHERE username = ?", (username,))
    conn.commit()
    conn.close()

# ==============================================================================
# JOURNAL ENTRIES API
# ==============================================================================
def create_journal_entry(username: str, title: str, content: str, mood: Optional[str] = None) -> Dict:
    entry_id = f"jour_{uuid.uuid4().hex[:12]}"
    now = time.time()
    entry_data = {
        "id": entry_id,
        "username": username,
        "title": title,
        "content": content,
        "mood": mood,
        "created_at": now,
        "updated_at": now
    }

    if FIREBASE_ACTIVE and firestore_db:
        try:
            firestore_db.collection("journal_entries").document(entry_id).set(entry_data)
        except Exception as e:
            print(f"[Firebase error] create_journal_entry: {e}")

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO journal_entries (id, username, title, content, mood, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (entry_id, username, title, content, mood, now, now)
    )
    conn.commit()
    conn.close()
    return entry_data

def get_user_journal_entries(username: str) -> List[Dict]:
    if FIREBASE_ACTIVE and firestore_db:
        try:
            query = firestore_db.collection("journal_entries").where("username", "==", username).get()
            entries = [e.to_dict() for e in query]
            entries.sort(key=lambda x: x.get("created_at", 0), reverse=True)
            return entries
        except Exception as e:
            print(f"[Firebase error] get_user_journal_entries: {e}")

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM journal_entries WHERE username = ? ORDER BY created_at DESC", (username,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def update_journal_entry(entry_id: str, username: str, title: str, content: str, mood: Optional[str] = None) -> bool:
    now = time.time()
    if FIREBASE_ACTIVE and firestore_db:
        try:
            firestore_db.collection("journal_entries").document(entry_id).update({
                "title": title,
                "content": content,
                "mood": mood,
                "updated_at": now
            })
        except Exception as e:
            print(f"[Firebase error] update_journal_entry: {e}")

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE journal_entries SET title = ?, content = ?, mood = ?, updated_at = ? WHERE id = ? AND username = ?",
        (title, content, mood, now, entry_id, username)
    )
    conn.commit()
    conn.close()
    return True

def delete_journal_entry(entry_id: str, username: str) -> bool:
    if FIREBASE_ACTIVE and firestore_db:
        try:
            firestore_db.collection("journal_entries").document(entry_id).delete()
        except Exception as e:
            print(f"[Firebase error] delete_journal_entry: {e}")

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM journal_entries WHERE id = ? AND username = ?", (entry_id, username))
    conn.commit()
    conn.close()
    return True

def clear_all_user_journal(username: str):
    if FIREBASE_ACTIVE and firestore_db:
        try:
            entries = firestore_db.collection("journal_entries").where("username", "==", username).get()
            for e in entries:
                e.reference.delete()
        except Exception as e:
            print(f"[Firebase error] clear_all_user_journal: {e}")

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM journal_entries WHERE username = ?", (username,))
    conn.commit()
    conn.close()

# ==============================================================================
# MOOD LOGS API
# ==============================================================================
def save_mood_log(username: str, mood_emoji: str, mood_label: str) -> Dict:
    log_id = f"mood_{uuid.uuid4().hex[:12]}"
    now = time.time()
    log_data = {
        "id": log_id,
        "username": username,
        "mood_emoji": mood_emoji,
        "mood_label": mood_label,
        "created_at": now
    }

    if FIREBASE_ACTIVE and firestore_db:
        try:
            firestore_db.collection("mood_logs").document(log_id).set(log_data)
        except Exception as e:
            print(f"[Firebase error] save_mood_log: {e}")

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT INTO mood_logs (id, username, mood_emoji, mood_label, created_at) VALUES (?, ?, ?, ?, ?)",
        (log_id, username, mood_emoji, mood_label, now)
    )
    conn.commit()
    conn.close()
    return log_data

def get_latest_mood_log(username: str) -> Optional[Dict]:
    if FIREBASE_ACTIVE and firestore_db:
        try:
            logs = firestore_db.collection("mood_logs").where("username", "==", username).get()
            log_list = [l.to_dict() for l in logs]
            log_list.sort(key=lambda x: x.get("created_at", 0), reverse=True)
            if log_list:
                return log_list[0]
        except Exception as e:
            print(f"[Firebase error] get_latest_mood_log: {e}")

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM mood_logs WHERE username = ? ORDER BY created_at DESC LIMIT 1", (username,))
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

# ==============================================================================
# USER SETTINGS API
# ==============================================================================
def get_user_settings(username: str) -> Dict:
    if FIREBASE_ACTIVE and firestore_db:
        try:
            doc = firestore_db.collection("user_settings").document(username).get()
            if doc.exists:
                return doc.to_dict()
            now = time.time()
            default_settings = {
                "username": username,
                "theme": "light",
                "font_size": "medium",
                "ai_tone": "Supportive",
                "daily_reminder": 0,
                "mood_reminder": 0,
                "journal_reminder": 0,
                "updated_at": now
            }
            firestore_db.collection("user_settings").document(username).set(default_settings)
            return default_settings
        except Exception as e:
            print(f"[Firebase error] get_user_settings: {e}")

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM user_settings WHERE username = ?", (username,))
    row = cursor.fetchone()
    if not row:
        now = time.time()
        cursor.execute(
            "INSERT INTO user_settings (username, theme, font_size, ai_tone, updated_at) VALUES (?, ?, ?, ?, ?)",
            (username, 'light', 'medium', 'Supportive', now)
        )
        conn.commit()
        cursor.execute("SELECT * FROM user_settings WHERE username = ?", (username,))
        row = cursor.fetchone()
    conn.close()
    return dict(row)

def update_user_settings(username: str, theme: str, font_size: str, ai_tone: str, daily_reminder: int = 0, mood_reminder: int = 0, journal_reminder: int = 0) -> Dict:
    now = time.time()
    settings_data = {
        "username": username,
        "theme": theme,
        "font_size": font_size,
        "ai_tone": ai_tone,
        "daily_reminder": daily_reminder,
        "mood_reminder": mood_reminder,
        "journal_reminder": journal_reminder,
        "updated_at": now
    }

    if FIREBASE_ACTIVE and firestore_db:
        try:
            firestore_db.collection("user_settings").document(username).set(settings_data, merge=True)
        except Exception as e:
            print(f"[Firebase error] update_user_settings: {e}")

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """UPDATE user_settings 
           SET theme = ?, font_size = ?, ai_tone = ?, daily_reminder = ?, mood_reminder = ?, journal_reminder = ?, updated_at = ? 
           WHERE username = ?""",
        (theme, font_size, ai_tone, daily_reminder, mood_reminder, journal_reminder, now, username)
    )
    if cursor.rowcount == 0:
        cursor.execute(
            """INSERT INTO user_settings (username, theme, font_size, ai_tone, daily_reminder, mood_reminder, journal_reminder, updated_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (username, theme, font_size, ai_tone, daily_reminder, mood_reminder, journal_reminder, now)
        )
    conn.commit()
    conn.close()
    return get_user_settings(username)

def export_all_user_data(username: str) -> Dict:
    sessions = get_user_sessions(username)
    full_sessions = []
    for s in sessions:
        msgs = get_session_messages(s["id"], username)
        full_sessions.append({
            "session": s,
            "messages": msgs
        })
    journal = get_user_journal_entries(username)
    settings = get_user_settings(username)
    
    if FIREBASE_ACTIVE and firestore_db:
        try:
            moods = [l.to_dict() for l in firestore_db.collection("mood_logs").where("username", "==", username).get()]
        except Exception:
            moods = []
    else:
        conn = get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM mood_logs WHERE username = ? ORDER BY created_at DESC", (username,))
        moods = [dict(r) for r in cursor.fetchall()]
        conn.close()

    return {
        "username": username,
        "exported_at": time.time(),
        "chat_sessions": full_sessions,
        "journal_entries": journal,
        "mood_history": moods,
        "settings": settings
    }

def wipe_all_user_data(username: str):
    clear_all_user_sessions(username)
    clear_all_user_journal(username)
    
    if FIREBASE_ACTIVE and firestore_db:
        try:
            logs = firestore_db.collection("mood_logs").where("username", "==", username).get()
            for l in logs:
                l.reference.delete()
            firestore_db.collection("user_settings").document(username).delete()
        except Exception as e:
            print(f"[Firebase error] wipe_all_user_data: {e}")

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM mood_logs WHERE username = ?", (username,))
    cursor.execute("DELETE FROM user_settings WHERE username = ?", (username,))
    conn.commit()
    conn.close()
