import sqlite3
import time
import uuid
import json
from pathlib import Path
from typing import List, Dict, Optional

DB_PATH = Path(__file__).resolve().parent / "healio.db"

def get_connection():
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()

    # 1. Users Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        username TEXT PRIMARY KEY,
        password_hash TEXT NOT NULL,
        created_at REAL NOT NULL
    );
    """)

    # 2. Chat Sessions Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS chat_sessions (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        title TEXT NOT NULL,
        created_at REAL NOT NULL,
        updated_at REAL NOT NULL
    );
    """)

    # 3. Chat Messages Table
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

    # 4. Journal Entries Table
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

    # 5. Mood Logs Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS mood_logs (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        mood_emoji TEXT NOT NULL,
        mood_label TEXT NOT NULL,
        created_at REAL NOT NULL
    );
    """)

    # 6. User Settings Table
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

# --- User Auth Helpers ---
def db_register_user(username: str, password_hash: str) -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)",
            (username, password_hash, time.time())
        )
        # Init default user settings
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

def db_verify_user(username: str, password_hash: str) -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT password_hash FROM users WHERE username = ?",
        (username,)
    )
    row = cursor.fetchone()
    conn.close()
    if row and row["password_hash"] == password_hash:
        return True
    return False

# --- Chat Sessions Helpers ---
def create_chat_session(username: str, title: str = "New Conversation", session_id: Optional[str] = None) -> str:
    conn = get_connection()
    cursor = conn.cursor()
    sid = session_id or f"sess_{uuid.uuid4().hex[:12]}"
    now = time.time()
    cursor.execute(
        "INSERT INTO chat_sessions (id, username, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
        (sid, username, title, now, now)
    )
    conn.commit()
    conn.close()
    return sid

def get_user_sessions(username: str) -> List[Dict]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM chat_sessions WHERE username = ? ORDER BY updated_at DESC",
        (username,)
    )
    rows = cursor.fetchall()
    sessions = []
    for r in rows:
        # Get last message preview
        cursor.execute(
            "SELECT text, timestamp FROM chat_messages WHERE session_id = ? ORDER BY created_at DESC LIMIT 1",
            (r["id"],)
        )
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
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM chat_messages WHERE session_id = ? AND username = ? ORDER BY created_at ASC",
        (session_id, username)
    )
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def save_chat_message(session_id: str, username: str, msg_type: str, text: str, emotions: str = "", timestamp: str = "") -> Dict:
    conn = get_connection()
    cursor = conn.cursor()
    msg_id = f"msg_{uuid.uuid4().hex[:12]}"
    now = time.time()
    
    cursor.execute(
        "INSERT INTO chat_messages (id, session_id, username, type, text, emotions, timestamp, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
        (msg_id, session_id, username, msg_type, text, emotions, timestamp, now)
    )
    # Update session updated_at timestamp
    cursor.execute(
        "UPDATE chat_sessions SET updated_at = ? WHERE id = ?",
        (now, session_id)
    )
    conn.commit()
    conn.close()
    return {
        "id": msg_id,
        "session_id": session_id,
        "username": username,
        "type": msg_type,
        "text": text,
        "emotions": emotions,
        "timestamp": timestamp,
        "created_at": now
    }

def update_session_title(session_id: str, title: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE chat_sessions SET title = ?, updated_at = ? WHERE id = ?",
        (title, time.time(), session_id)
    )
    conn.commit()
    conn.close()

def delete_chat_session(session_id: str, username: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM chat_messages WHERE session_id = ? AND username = ?", (session_id, username))
    cursor.execute("DELETE FROM chat_sessions WHERE id = ? AND username = ?", (session_id, username))
    conn.commit()
    conn.close()

def clear_all_user_sessions(username: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM chat_messages WHERE username = ?", (username,))
    cursor.execute("DELETE FROM chat_sessions WHERE username = ?", (username,))
    conn.commit()
    conn.close()

# --- Journal Helpers ---
def create_journal_entry(username: str, title: str, content: str, mood: Optional[str] = None) -> Dict:
    conn = get_connection()
    cursor = conn.cursor()
    entry_id = f"jour_{uuid.uuid4().hex[:12]}"
    now = time.time()
    cursor.execute(
        "INSERT INTO journal_entries (id, username, title, content, mood, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
        (entry_id, username, title, content, mood, now, now)
    )
    conn.commit()
    conn.close()
    return {
        "id": entry_id,
        "username": username,
        "title": title,
        "content": content,
        "mood": mood,
        "created_at": now,
        "updated_at": now
    }

def get_user_journal_entries(username: str) -> List[Dict]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM journal_entries WHERE username = ? ORDER BY created_at DESC",
        (username,)
    )
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

def update_journal_entry(entry_id: str, username: str, title: str, content: str, mood: Optional[str] = None) -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    now = time.time()
    cursor.execute(
        "UPDATE journal_entries SET title = ?, content = ?, mood = ?, updated_at = ? WHERE id = ? AND username = ?",
        (title, content, mood, now, entry_id, username)
    )
    affected = cursor.rowcount
    conn.commit()
    conn.close()
    return affected > 0

def delete_journal_entry(entry_id: str, username: str) -> bool:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM journal_entries WHERE id = ? AND username = ?", (entry_id, username))
    affected = cursor.rowcount
    conn.commit()
    conn.close()
    return affected > 0

def clear_all_user_journal(username: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM journal_entries WHERE username = ?", (username,))
    conn.commit()
    conn.close()

# --- Mood Logs Helpers ---
def save_mood_log(username: str, mood_emoji: str, mood_label: str) -> Dict:
    conn = get_connection()
    cursor = conn.cursor()
    log_id = f"mood_{uuid.uuid4().hex[:12]}"
    now = time.time()
    cursor.execute(
        "INSERT INTO mood_logs (id, username, mood_emoji, mood_label, created_at) VALUES (?, ?, ?, ?, ?)",
        (log_id, username, mood_emoji, mood_label, now)
    )
    conn.commit()
    conn.close()
    return {
        "id": log_id,
        "username": username,
        "mood_emoji": mood_emoji,
        "mood_label": mood_label,
        "created_at": now
    }

def get_latest_mood_log(username: str) -> Optional[Dict]:
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT * FROM mood_logs WHERE username = ? ORDER BY created_at DESC LIMIT 1",
        (username,)
    )
    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

# --- User Settings Helpers ---
def get_user_settings(username: str) -> Dict:
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
    conn = get_connection()
    cursor = conn.cursor()
    now = time.time()
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
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM mood_logs WHERE username = ?", (username,))
    cursor.execute("DELETE FROM user_settings WHERE username = ?", (username,))
    conn.commit()
    conn.close()

# Initialize DB structure on import
init_db()
