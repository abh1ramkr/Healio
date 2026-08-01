import os
import tempfile
import base64
import hashlib
import time
from pathlib import Path
from typing import Optional, List, Dict
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import whisper
import requests
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from gtts import gTTS

# Firebase Admin SDK
try:
    import firebase_admin
    from firebase_admin import credentials, firestore
    FIREBASE_AVAILABLE = True
except ImportError:
    FIREBASE_AVAILABLE = False

import db_manager

# Load environment variables
env_path = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(env_path)

# Initialize Firebase if credential file exists
db = None
if FIREBASE_AVAILABLE:
    cred_path = os.getenv("FIREBASE_CREDENTIALS_PATH", "serviceAccountKey.json")
    if Path(cred_path).exists():
        try:
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
            db = firestore.client()
            print(f"[Firebase] Initialized Firestore successfully using {cred_path}")
        except Exception as e:
            print(f"[Firebase] Error initializing Firebase: {e}")
    else:
        print(f"[Firebase] Credential file '{cred_path}' not found. Using local structured storage fallback.")

# In-memory/local storage fallback for users and vector chat history
fallback_users: Dict[str, Dict] = {
    "admin": {
        "username": "admin",
        "password_hash": hashlib.sha256("password".encode()).hexdigest(),
        "created_at": time.time()
    },
    "121": {
        "username": "121",
        "password_hash": hashlib.sha256("123".encode()).hexdigest(),
        "created_at": time.time()
    }
}
fallback_history: Dict[str, List[Dict]] = {}

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

# Load Whisper model for audio and video transcription
model = whisper.load_model("base")

# Load the fine-tuned GoEmotions model and tokenizer
emotion_model_name = "speedthrill/goemotions-finetuned"
tokenizer = AutoTokenizer.from_pretrained(emotion_model_name)
emotion_model = AutoModelForSequenceClassification.from_pretrained(emotion_model_name)

# Emotion labels
emotion_labels = ['admiration', 'amusement', 'anger', 'annoyance', 'approval', 'caring',
    'confusion', 'curiosity', 'desire', 'disappointment', 'disapproval', 'disgust', 'embarrassment',
    'excitement', 'fear', 'gratitude', 'grief', 'joy', 'love', 'nervousness', 'optimism', 'pride',
    'realization', 'relief', 'remorse', 'sadness', 'surprise', 'neutral']

API_KEY = os.getenv("GEMINI_API_KEY", "AIzaSyBa66toL3k0j5ySsxcTt3O9lXDrwtbJz5o")
FALLBACK_MODELS = [
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
    "gemini-pro"
]

def get_gemini_response(user_input, emotions, username="default"):
    # Reload environment variables to pick up any new API key in .env
    load_dotenv(env_path, override=True)
    api_key = os.getenv("GEMINI_API_KEY", API_KEY)

    user_history = get_chat_history_db(username)
    history_text = "\n".join([f"User: {h[0]}\nBot: {h[2]}" for h in user_history[-5:]])
    top_emotion = emotions[0][0] if emotions else "neutral"

    prompt = (
        f"You are an expert mental health consultant and therapist named HEALIO.\n"
        f"Chat History:\n{history_text}\n\n"
        f"The user is experiencing the emotion: {top_emotion}.\n"
        f"User input: '{user_input}'\n\n"
        f"Respond as a deeply caring, empathetic mental health companion:\n"
        f"1. Acknowledge and validate their emotion directly.\n"
        f"2. Offer tailored, actionable mental wellness coping advice or exercises relevant to their exact situation.\n"
        f"3. End with a gentle, thoughtful follow-up question.\n"
        f"Keep the tone warm, soothing, professional, and concise (2-4 sentences).\n"
    )

    # 1. Try official google-generativeai SDK if available
    if GENAI_AVAILABLE and api_key and len(api_key) > 10:
        try:
            genai.configure(api_key=api_key)
            for m_name in ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro"]:
                try:
                    g_model = genai.GenerativeModel(m_name)
                    res = g_model.generate_content(prompt)
                    if res and res.text and len(res.text.strip()) > 10:
                        return res.text.strip()
                except Exception as inner_e:
                    print(f"GenAI SDK model {m_name} error: {inner_e}")
                    continue
        except Exception as e:
            print(f"GenAI SDK config error: {e}")

    # 2. Try REST API endpoints as secondary LLM fallback
    payload = {"contents": [{"parts": [{"text": prompt}]}]}
    headers = {"Content-Type": "application/json"}

    if api_key and len(api_key) > 10:
        for model_name in FALLBACK_MODELS:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
            try:
                response = requests.post(url, headers=headers, json=payload, timeout=10)
                if response.status_code == 200:
                    response_data = response.json()
                    if 'candidates' in response_data and response_data['candidates']:
                        candidate_text = response_data['candidates'][0]['content']['parts'][0]['text']
                        if candidate_text and len(candidate_text.strip()) > 10:
                            return candidate_text.strip()
                else:
                    print(f"Gemini API model {model_name} returned status {response.status_code}: {response.text[:150]}")
            except Exception as e:
                print(f"Gemini REST API model {model_name} error: {e}")
                continue

    # 3. Rich, dynamic contextual fallback generator
    return generate_dynamic_empathetic_response(user_input, emotions)

def generate_vector_embedding(text: str) -> List[float]:
    if not text:
        return [0.0] * 64
    try:
        encoded = tokenizer(text, max_length=64, padding="max_length", truncation=True, return_tensors="pt")
        input_ids = encoded["input_ids"].float()
        normalized = torch.nn.functional.normalize(input_ids, p=2, dim=1)
        vector_list = normalized[0].tolist()
        return [round(val, 6) for val in vector_list]
    except Exception as e:
        print(f"Vector embedding calculation error: {e}")
        return [round((hash(text + str(i)) % 1000) / 1000.0, 6) for i in range(64)]

def register_user_db(username: str, password: str) -> bool:
    password_hash = hash_password(password)
    # Always register in SQLite db_manager
    sqlite_success = db_manager.db_register_user(username, password_hash)
    if db is not None:
        try:
            doc_ref = db.collection("users").document(username)
            if not doc_ref.get().exists:
                doc_ref.set({
                    "username": username,
                    "password_hash": password_hash,
                    "created_at": firestore.SERVER_TIMESTAMP
                })
        except Exception as e:
            print(f"Firestore register error: {e}")
    
    if username not in fallback_users:
        fallback_users[username] = {
            "username": username,
            "password_hash": password_hash,
            "created_at": time.time()
        }
    return sqlite_success

def verify_user_db(username: str, password: str) -> bool:
    password_hash = hash_password(password)
    if db_manager.db_verify_user(username, password_hash):
        return True
    if db is not None:
        try:
            doc_ref = db.collection("users").document(username)
            doc = doc_ref.get()
            if doc.exists:
                data = doc.to_dict()
                return data.get("password_hash") == password_hash
        except Exception as e:
            print(f"Firestore login verify error: {e}")
    
    user = fallback_users.get(username)
    if user:
        return user["password_hash"] == password_hash
    return False

def save_chat_turn_db(username: str, user_text: str, emotions_text: str, bot_response: str):
    vector = generate_vector_embedding(f"{user_text} {bot_response}")
    timestamp = time.time()
    turn_data = {
        "user_text": user_text,
        "emotions": emotions_text,
        "bot_response": bot_response,
        "vector": vector,
        "timestamp": timestamp
    }
    
    if db is not None:
        try:
            user_ref = db.collection("users").document(username)
            user_ref.collection("history").add(turn_data)
        except Exception as e:
            print(f"Firestore save chat turn error: {e}")
            
    if username not in fallback_history:
        fallback_history[username] = []
    fallback_history[username].append(turn_data)

def get_chat_history_db(username: str) -> List[tuple]:
    history_tuples = []
    if db is not None:
        try:
            user_ref = db.collection("users").document(username)
            docs = user_ref.collection("history").order_by("timestamp").stream()
            for doc in docs:
                d = doc.to_dict()
                history_tuples.append((d.get("user_text", ""), d.get("emotions", ""), d.get("bot_response", "")))
            if history_tuples:
                return history_tuples
        except Exception as e:
            print(f"Firestore get history error: {e}")

    user_turns = fallback_history.get(username, [])
    for d in user_turns:
        history_tuples.append((d.get("user_text", ""), d.get("emotions", ""), d.get("bot_response", "")))
    return history_tuples

import random

try:
    import google.generativeai as genai
    GENAI_AVAILABLE = True
except ImportError:
    GENAI_AVAILABLE = False

def generate_dynamic_empathetic_response(user_input: str, emotions: list) -> str:
    top_emotion = emotions[0][0] if emotions else "neutral"
    user_lower = user_input.lower()

    # Dynamic variations pool
    openers = [
        f"I hear you, and I appreciate you opening up about this.",
        f"Thank you for sharing how you feel with me. Experiencing {top_emotion} is completely valid.",
        f"I hear how much weight this is placing on your mind right now.",
        f"Taking a moment to express what you're going through takes real courage."
    ]
    opener = random.choice(openers)

    if "corporate" in user_lower or "job" in user_lower or "work" in user_lower or "career" in user_lower or "interview" in user_lower or "hired" in user_lower:
        advice_options = [
            f"The job market and career pursuit can feel deeply frustrating when results take time. "
            f"When dealing with {top_emotion}, it's helpful to separate your personal worth from the hiring process. "
            f"Focus on one small action today—whether updating a single skill or taking a restful break. "
            f"What specific role or field are you aiming for, and how can I help you prepare or unwind?",

            f"Searching for a role and facing setbacks can feel emotionally draining. "
            f"Remember that your perseverance is commendable, even when it feels unrecognized. "
            f"Try breaking your job search into 30-minute daily blocks so it doesn't consume your entire emotional energy. "
            f"How are you managing your daily routine and stress while applying?"
        ]
        return f"{opener} {random.choice(advice_options)}"

    elif "sleep" in user_lower or "insomnia" in user_lower or "night" in user_lower or "bed" in user_lower or "racing" in user_lower:
        advice_options = [
            f"Rest is so vital, yet a racing mind makes sleep feel impossible. "
            f"When feeling {top_emotion} at night, try writing down all your thoughts on paper to clear your mental queue, then practice 4-7-8 breathing. "
            f"Would you like to try a guided breathing session with me right now?",

            f"Struggling with sleep can affect every part of your day. "
            f"Creating a soothing, low-light routine 30 minutes before bed can help signal your body to relax. "
            f"What time do you usually try to sleep, and what thoughts tend to keep you awake?"
        ]
        return f"{opener} {random.choice(advice_options)}"

    elif "family" in user_lower or "relationship" in user_lower or "friend" in user_lower or "parent" in user_lower or "partner" in user_lower or "home" in user_lower:
        advice_options = [
            f"Family dynamics and personal relationships touch our deepest emotions. "
            f"It is natural to feel {top_emotion} when communication or expectations clash. "
            f"Setting gentle emotional boundaries is essential for your well-being. "
            f"How can you give yourself a little space to recharge today?",

            f"Navigating relationship complexities requires patience with yourself above all. "
            f"Remember that you can control your responses and self-care, even when you can't control others' actions. "
            f"Would you like to talk more about what happened?"
        ]
        return f"{opener} {random.choice(advice_options)}"

    elif "anxious" in user_lower or "overwhelmed" in user_lower or "panic" in user_lower or "stress" in user_lower or "worry" in user_lower:
        advice_options = [
            f"Feeling overwhelmed or anxious can make every small task feel like a mountain. "
            f"Let's practice the 5-4-3-2-1 grounding exercise: look around and name 5 things you can see, 4 you can touch, and 3 you can hear. "
            f"How does your body feel right now?",

            f"Anxiety often tries to convince us that we have to fix everything immediately. "
            f"Give yourself permission to pause. You only need to navigate this single present moment. "
            f"What is one tiny task we can check off or set aside to give you relief?"
        ]
        return f"{opener} {random.choice(advice_options)}"

    elif "good" in user_lower or "happy" in user_lower or "great" in user_lower or "excited" in user_lower or "accomplished" in user_lower:
        advice_options = [
            f"I am so glad to hear a positive update! Celebrating moments of {top_emotion} is a wonderful way to build lasting resilience. "
            f"What was a highlight or favorite part of your experience today?",

            f"That is fantastic news! Taking time to savor good experiences helps reinforce emotional strength. "
            f"How did you achieve this, and how can we celebrate it?"
        ]
        return f"{opener} {random.choice(advice_options)}"

    elif "sad" in user_lower or "lonely" in user_lower or "cry" in user_lower or "depressed" in user_lower or "hurt" in user_lower:
        advice_options = [
            f"I'm really sorry you're carrying feelings of sadness. Experiencing {top_emotion} is heavy, but you don't have to face it alone. "
            f"Treat yourself with extra tenderness today. "
            f"What is something small and comforting you can do for yourself right now?",

            f"Sadness can make us feel isolated, but your feelings are valid and worth honoring. "
            f"Take things one hour at a time. I'm here to listen whenever you want to share. "
            f"Is there a friend, family member, or activity that usually helps comfort you?"
        ]
        return f"{opener} {random.choice(advice_options)}"

    else:
        advice_options = [
            f"Navigating this with a sense of {top_emotion} shows how deeply you care about your situation. "
            f"Take a deep breath and remind yourself that it's okay to feel this way. "
            f"Could you share a little more context about what led to this so I can support you best?",

            f"Processing these thoughts is an important step in your mental wellness journey. "
            f"Whatever you are experiencing right now, you are safe to express it here without judgment. "
            f"How are you feeling in your body at this moment?"
        ]
        return f"{opener} {random.choice(advice_options)}"

def get_gemini_response(user_input, emotions, username="default", session_id=None):
    # Fetch session messages from SQLite db_manager
    session_messages = db_manager.get_session_messages(session_id, username) if session_id else []
    
    # Also fetch general history fallback if session_messages is empty
    if not session_messages:
        user_history = get_chat_history_db(username)
        history_lines = [f"User: {h[0]}\nBot: {h[2]}" for h in user_history[-5:]]
        history_text = "\n".join(history_lines) if history_lines else "None (New Conversation)"
    else:
        history_lines = []
        for msg in session_messages[-10:]:
            sender = "User" if msg.get("sender") in ["user", "human"] or msg.get("type") == "user" else "HEALIO"
            text_content = msg.get("text") or msg.get("message") or ""
            if text_content:
                history_lines.append(f"{sender}: {text_content}")
        history_text = "\n".join(history_lines)

    top_emotion = emotions[0][0] if emotions else "neutral"

    prompt = (
        f"You are HEALIO, a deeply caring, empathetic, professional AI mental health companion.\n"
        f"You are in an ongoing conversation with the user. ALWAYS maintain conversational continuity with what was discussed previously.\n\n"
        f"PREVIOUS CONVERSATION CONTEXT:\n{history_text}\n\n"
        f"USER'S LATEST MESSAGE:\n'{user_input}'\n"
        f"DETECTED EMOTIONAL STATE: {top_emotion}\n\n"
        f"Respond warmly, soothingly, and directly address their message while remembering their previous statements:\n"
        f"1. Acknowledge and validate their emotional state directly.\n"
        f"2. Offer tailored, actionable mental wellness coping advice or exercises relevant to their exact situation.\n"
        f"3. End with a gentle, thoughtful follow-up question.\n"
        f"Keep the response concise (2-4 sentences)."
    )

    load_dotenv(env_path, override=True)
    api_key = os.getenv("GEMINI_API_KEY", API_KEY)

    # 1. Try official google-generativeai SDK if available
    if GENAI_AVAILABLE and api_key and len(api_key) > 10:
        try:
            genai.configure(api_key=api_key)
            for m_name in ["gemini-2.0-flash", "gemini-1.5-flash", "gemini-1.5-pro", "gemini-pro"]:
                try:
                    g_model = genai.GenerativeModel(m_name)
                    res = g_model.generate_content(prompt)
                    if res and res.text and len(res.text.strip()) > 10:
                        return res.text.strip()
                except Exception as inner_e:
                    print(f"GenAI SDK model {m_name} error: {inner_e}")
                    continue
        except Exception as e:
            print(f"GenAI SDK config error: {e}")

    # 2. Try REST API endpoints as secondary LLM fallback
    payload = {"contents": [{"parts": [{"text": prompt}]}]}
    headers = {"Content-Type": "application/json"}

    if api_key and len(api_key) > 10:
        for model_name in FALLBACK_MODELS:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={api_key}"
            try:
                response = requests.post(url, headers=headers, json=payload, timeout=10)
                if response.status_code == 200:
                    response_data = response.json()
                    if 'candidates' in response_data and response_data['candidates']:
                        candidate_text = response_data['candidates'][0]['content']['parts'][0]['text']
                        if candidate_text and len(candidate_text.strip()) > 10:
                            return candidate_text.strip()
            except Exception as e:
                print(f"Gemini REST API model {model_name} error: {e}")
                continue

    # 3. Rich, dynamic contextual fallback generator
    return generate_dynamic_empathetic_response(user_input, emotions)

def detect_emotion(text):
    if not text or not text.strip():
        return [("neutral", 1.0)]
    try:
        inputs = tokenizer(text, return_tensors="pt")
        outputs = emotion_model(**inputs)
        probs = torch.softmax(outputs.logits, dim=-1)
        top_emotions = torch.topk(probs, k=3)
        detected_emotions = [(emotion_labels[i], float(probs[0][i])) for i in top_emotions.indices[0] if float(probs[0][i]) > 0.05]
        return detected_emotions if detected_emotions else [("neutral", 1.0)]
    except Exception as e:
        print(f"Emotion detection error: {e}")
        return [("neutral", 1.0)]

def transcribe_audio_video(file_path):
    if not file_path or not Path(file_path).exists():
        return ""
    try:
        result = model.transcribe(str(file_path))
        return result["text"].strip()
    except Exception as e:
        print(f"Transcription error: {e}")
        return ""

def process_media(audio_file, video_file, text_input, username="default", session_id=None):
    transcribed_text = ""
    if audio_file:
        transcribed_text += transcribe_audio_video(audio_file)
    if video_file:
        transcribed_text += " " + transcribe_audio_video(video_file)

    text = text_input.strip() or transcribed_text.strip()
    if not text:
        return "No input detected. Please provide text, audio, or video.", "", "", "", ""

    detected_emotions = detect_emotion(text)
    emotions_text = ", ".join([f"{e} ({round(c*100, 2)}%)" for e, c in detected_emotions])
    gemini_response = get_gemini_response(text, detected_emotions, username, session_id)

    # Save to database with vector embedding
    save_chat_turn_db(username, text, emotions_text, gemini_response)

    user_history = get_chat_history_db(username)
    chat_history_text = "\n".join([f"User: {h[0]}\nEmotion: {h[1]}\nBot: {h[2]}\n" for h in user_history])

    audio_response_file = text_to_speech(gemini_response) or ""
    return text, emotions_text, gemini_response, chat_history_text, audio_response_file

def text_to_speech(text):
    try:
        tts = gTTS(text=text, lang="en")
        temp_audio_file = tempfile.NamedTemporaryFile(delete=False, suffix=".mp3")
        tts.save(temp_audio_file.name)
        return temp_audio_file.name
    except Exception as e:
        print(f"Error generating speech: {e}")
        return ""

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.post("/register")
def register_endpoint(username: str = Form(...), password: str = Form(...)):
    u = username.strip()
    p = password.strip()
    if not u or not p:
        raise HTTPException(status_code=400, detail="Username and password cannot be empty")
    success = register_user_db(u, p)
    if success:
        return {"success": True, "message": "Account registered successfully! You can now log in."}
    else:
        raise HTTPException(status_code=400, detail="Username already exists. Please choose another username.")

@app.post("/login")
def login_endpoint(username: str = Form(...), password: str = Form(...)):
    u = username.strip()
    p = password.strip()
    if verify_user_db(u, p):
        return {"success": True, "username": u, "message": "Login Successful"}
    else:
        raise HTTPException(status_code=401, detail="Invalid username or password")

# --- AI Titling & Journal Reflection Helpers ---
def generate_ai_title(first_prompt: str) -> str:
    if not first_prompt or len(first_prompt.strip()) == 0:
        return "Mental Wellness Session"
    
    clean_prompt = first_prompt.strip()[:100]
    words = [w.capitalize() for w in clean_prompt.split() if len(w) > 2]
    fallback_title = " ".join(words[:4]) if words else "Mental Wellness Session"

    load_dotenv(env_path, override=True)
    api_key = os.getenv("GEMINI_API_KEY", API_KEY)
    
    if GENAI_AVAILABLE and api_key and len(api_key) > 10:
        try:
            genai.configure(api_key=api_key)
            g_model = genai.GenerativeModel("gemini-2.0-flash")
            res = g_model.generate_content(
                f"Summarize this query into a concise 3-4 word title: '{clean_prompt}'. Return title only without quotes."
            )
            if res and res.text:
                title = res.text.strip().replace('"', '').replace("'", "")
                if 3 < len(title) < 40:
                    return title
        except Exception:
            pass
            
    return fallback_title if len(fallback_title) > 3 else "Mental Wellness Session"

def generate_journal_reflection(content: str, mood: Optional[str] = None) -> str:
    prompt = (
        f"You are HEALIO, an empathetic AI mental wellness companion.\n"
        f"The user wrote a private journal entry:\n"
        f"Mood: {mood or 'Not specified'}\n"
        f"Content:\n'{content}'\n\n"
        f"Provide a gentle, compassionate reflection for the user:\n"
        f"1. Acknowledge and validate their emotional state.\n"
        f"2. Provide 2 gentle insights or actionable mindfulness recommendations.\n"
        f"3. End with a warm, encouraging closing sentence.\n"
        f"Keep the reflection soothing and under 150 words."
    )
    return get_gemini_response(content, [("reflection", 1.0)])

# --- Chat Session Endpoints ---
@app.get("/sessions")
def get_sessions_endpoint(username: str = "default"):
    sessions = db_manager.get_user_sessions(username)
    return {"sessions": sessions}

@app.get("/session_messages")
def get_session_messages_endpoint(session_id: str, username: str = "default"):
    messages = db_manager.get_session_messages(session_id, username)
    return {"messages": messages}

@app.post("/create_session")
def create_session_endpoint(username: str = Form("default"), title: str = Form("New Conversation")):
    sid = db_manager.create_chat_session(username, title)
    return {"session_id": sid, "title": title}

@app.post("/rename_session")
def rename_session_endpoint(session_id: str = Form(...), title: str = Form(...)):
    db_manager.update_session_title(session_id, title.strip())
    return {"success": True, "message": "Session renamed successfully."}

@app.post("/delete_session")
def delete_session_endpoint(session_id: str = Form(...), username: str = Form("default")):
    db_manager.delete_chat_session(session_id, username)
    return {"success": True, "message": "Session deleted successfully."}

# Update chat endpoint to support session_id and SQLite persistence
@app.post("/chat")
def chat_endpoint(text_input: str = Form(...), username: str = Form("default"), session_id: Optional[str] = Form(None)):
    # 1. Resolve or create session ID first so Gemini gets current session history
    sid = session_id
    if not sid or sid == "new":
        ai_title = generate_ai_title(text_input)
        sid = db_manager.create_chat_session(username, ai_title)

    text, emotions_text, gemini_response, chat_history_text, audio_path = process_media(None, None, text_input, username, sid)
    if audio_path:
        with open(audio_path, "rb") as f:
            audio_base64 = base64.b64encode(f.read()).decode()
    else:
        audio_base64 = ""
    
    now_str = time.strftime("%I:%M %p")
    user_msg = db_manager.save_chat_message(sid, username, "user", text_input, emotions_text, now_str)
    bot_msg = db_manager.save_chat_message(sid, username, "bot", gemini_response, emotions_text, now_str)

    return {
        "transcription": text,
        "emotions": emotions_text,
        "response": gemini_response,
        "history": chat_history_text,
        "audio_base64": audio_base64,
        "session_id": sid,
        "user_msg": user_msg,
        "bot_msg": bot_msg
    }

# --- Journal Endpoints ---
@app.get("/journal/list")
def list_journal_endpoint(username: str = "default"):
    entries = db_manager.get_user_journal_entries(username)
    return {"entries": entries}

@app.post("/journal/create")
def create_journal_endpoint(username: str = Form("default"), title: str = Form(...), content: str = Form(...), mood: Optional[str] = Form(None)):
    entry = db_manager.create_journal_entry(username, title.strip(), content.strip(), mood)
    return {"success": True, "entry": entry}

@app.post("/journal/update")
def update_journal_endpoint(id: str = Form(...), username: str = Form("default"), title: str = Form(...), content: str = Form(...), mood: Optional[str] = Form(None)):
    success = db_manager.update_journal_entry(id, username, title.strip(), content.strip(), mood)
    return {"success": success}

@app.post("/journal/delete")
def delete_journal_endpoint(id: str = Form(...), username: str = Form("default")):
    success = db_manager.delete_journal_entry(id, username)
    return {"success": success}

@app.post("/journal/reflect")
def reflect_journal_endpoint(content: str = Form(...), mood: Optional[str] = Form(None)):
    reflection = generate_journal_reflection(content, mood)
    return {"reflection": reflection}

# --- Wellness Tools & Mood Check-In Endpoints ---
@app.post("/mood_checkin")
def mood_checkin_endpoint(username: str = Form("default"), mood_emoji: str = Form(...), mood_label: str = Form(...)):
    log = db_manager.save_mood_log(username, mood_emoji, mood_label)
    return {"success": True, "log": log}

@app.get("/latest_mood")
def latest_mood_endpoint(username: str = "default"):
    log = db_manager.get_latest_mood_log(username)
    return {"log": log}

@app.get("/daily_tip")
def daily_tip_endpoint():
    tips = [
        "Take a five-minute walk without your phone today to refresh your mind.",
        "Practice 4-7-8 breathing when feeling overwhelmed: Inhale 4s, Hold 7s, Exhale 8s.",
        "Acknowledge one thing you are truly grateful for right now.",
        "Drink a warm glass of water and stretch your shoulders gently.",
        "Remember: You don't have to figure everything out today. Take it step by step."
    ]
    day_idx = int(time.time() // 86400) % len(tips)
    return {"tip": tips[day_idx]}

# --- Settings & Data Export / Wipe Endpoints ---
@app.get("/settings")
def get_settings_endpoint(username: str = "default"):
    settings = db_manager.get_user_settings(username)
    return {"settings": settings}

@app.post("/settings/update")
def update_settings_endpoint(
    username: str = Form("default"),
    theme: str = Form("light"),
    font_size: str = Form("medium"),
    ai_tone: str = Form("Supportive"),
    daily_reminder: int = Form(0),
    mood_reminder: int = Form(0),
    journal_reminder: int = Form(0)
):
    settings = db_manager.update_user_settings(username, theme, font_size, ai_tone, daily_reminder, mood_reminder, journal_reminder)
    return {"success": True, "settings": settings}

@app.post("/export_data")
def export_data_endpoint(username: str = Form("default")):
    data = db_manager.export_all_user_data(username)
    return {"data": data}

@app.post("/delete_all_data")
def delete_all_data_endpoint(username: str = Form("default")):
    db_manager.wipe_all_user_data(username)
    return {"success": True, "message": "All user data cleared."}

@app.post("/voice")
def voice_endpoint(audio_file: UploadFile = File(...), username: str = Form("default")):
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp:
            temp.write(audio_file.file.read())
            temp_path = temp.name
        text, emotions_text, gemini_response, chat_history_text, audio_path = process_media(temp_path, None, "", username)
        if audio_path:
            with open(audio_path, "rb") as f:
                audio_base64 = base64.b64encode(f.read()).decode()
        else:
            audio_base64 = ""
        return {
            "transcription": text,
            "emotions": emotions_text,
            "response": gemini_response,
            "history": chat_history_text,
            "audio_base64": audio_base64
        }
    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass

@app.post("/video")
def video_endpoint(video_file: UploadFile = File(...), username: str = Form("default")):
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as temp:
            temp.write(video_file.file.read())
            temp_path = temp.name
        text, emotions_text, gemini_response, chat_history_text, audio_path = process_media(None, temp_path, "", username)
        if audio_path:
            with open(audio_path, "rb") as f:
                audio_base64 = base64.b64encode(f.read()).decode()
        else:
            audio_base64 = ""
        return {
            "transcription": text,
            "emotions": emotions_text,
            "response": gemini_response,
            "history": chat_history_text,
            "audio_base64": audio_base64
        }
    finally:
        if temp_path and os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass

@app.get("/history")
def get_history(username: str = "default"):
    user_history = get_chat_history_db(username)
    return {"history": user_history}

@app.post("/delete_message")
def delete_message_endpoint(username: str = Form("default"), index: int = Form(...)):
    if db is not None:
        try:
            user_ref = db.collection("users").document(username)
            docs = list(user_ref.collection("history").order_by("timestamp").stream())
            if 0 <= index < len(docs):
                docs[index].reference.delete()
                print(f"[Firebase] Deleted history turn index {index} for {username}")
        except Exception as e:
            print(f"Firestore delete message error: {e}")

    if username in fallback_history and 0 <= index < len(fallback_history[username]):
        fallback_history[username].pop(index)
        print(f"[Fallback] Deleted history turn index {index} for {username}")

    return {"success": True, "message": "Message deleted successfully."}

@app.post("/clear_history")
def clear_history_endpoint(username: str = Form("default")):
    if db is not None:
        try:
            user_ref = db.collection("users").document(username)
            docs = user_ref.collection("history").stream()
            for doc in docs:
                doc.reference.delete()
            print(f"[Firebase] Cleared all history for {username}")
        except Exception as e:
            print(f"Firestore clear history error: {e}")

    fallback_history[username] = []
    db_manager.clear_all_user_sessions(username)
    return {"success": True, "message": "Chat history cleared successfully."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)