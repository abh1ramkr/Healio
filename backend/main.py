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
    "gemini-1.5-flash",
    "gemini-2.0-flash",
    "gemini-1.5-pro",
    "gemini-pro"
]

def generate_dynamic_empathetic_response(user_input: str, emotions: list) -> str:
    top_emotion = emotions[0][0] if emotions else "neutral"
    user_lower = user_input.lower()

    if "sleep" in user_lower or "insomnia" in user_lower or "night" in user_lower or "bed" in user_lower or "racing" in user_lower:
        return (
            f"I hear how exhausting it is when you can't sleep and your thoughts won't slow down. "
            f"When feeling {top_emotion}, try putting away screens and practicing 4-7-8 breathing: inhale for 4s, hold for 7s, and exhale for 8s. "
            f"Would you like me to guide you through a quick relaxation exercise right now?"
        )
    elif "job" in user_lower or "work" in user_lower or "career" in user_lower or "interview" in user_lower or "boss" in user_lower or "hired" in user_lower:
        return (
            f"Career pressures and job uncertainty can feel heavy. It is completely natural to feel {top_emotion} under work-related stress. "
            f"Remember to break big challenges into small, manageable steps today. Take a short pause to stretch or step outside for fresh air. "
            f"What specific aspect of work or job search is weighing on you most right now?"
        )
    elif "family" in user_lower or "relationship" in user_lower or "friend" in user_lower or "parent" in user_lower or "partner" in user_lower or "home" in user_lower:
        return (
            f"Family and personal relationships carry deep emotional weight. Navigating these situations often brings up feelings of {top_emotion}. "
            f"Giving yourself space to process your feelings and boundaries is very important. "
            f"How are you taking care of your own emotional needs while dealing with family or personal matters?"
        )
    elif "anxious" in user_lower or "overwhelmed" in user_lower or "panic" in user_lower or "stress" in user_lower or "worry" in user_lower:
        return (
            f"I hear you. Feeling overwhelmed or anxious can make everything feel intense. "
            f"Let's ground ourselves together: name 3 things you can see around you right now, and take one slow, deep breath. "
            f"You don't have to solve everything today—just focus on this present moment. How does your body feel right now?"
        )
    elif "good" in user_lower or "happy" in user_lower or "great" in user_lower or "excited" in user_lower or "accomplished" in user_lower:
        return (
            f"I am so glad to hear that! Celebrating moments of positivity and {top_emotion} is a wonderful way to build mental resilience. "
            f"What was a highlight or favorite part of your experience today?"
        )
    elif "sad" in user_lower or "lonely" in user_lower or "cry" in user_lower or "depressed" in user_lower or "hurt" in user_lower:
        return (
            f"I'm really sorry you're feeling down. Experiencing {top_emotion} is tough, but please know you don't have to carry it all by yourself. "
            f"Be extra gentle with yourself today—maybe grab a warm drink or listen to comforting music. "
            f"What is something small that usually brings you comfort when you feel this way?"
        )
    else:
        return (
            f"Thank you for sharing that with me. I hear that you're sensing {top_emotion} around this situation ({user_input[:40]}...). "
            f"It takes courage to express how you feel. Take a deep breath and give yourself credit for reaching out. "
            f"Can you tell me a bit more about what's been happening so I can support you best?"
        )

def get_gemini_response(user_input, emotions, username="default"):
    user_history = get_chat_history_db(username)
    history_text = "\n".join([f"User: {h[0]}\nBot: {h[2]}" for h in user_history[-5:]])
    top_emotion = emotions[0][0] if emotions else "neutral"

    prompt = (
        f"You are an expert mental health consultant and therapist.\n"
        f"Chat History:\n{history_text}\n\n"
        f"The user is experiencing the following emotion: {top_emotion}.\n"
        f"User said: '{user_input}'\n\n"
        f"Your job is to respond as a caring, professional mental health consultant.\n"
        f"- Address the user's emotion and situation directly.\n"
        f"- Offer practical, evidence-based advice, coping strategies, or exercises for their emotional state.\n"
        f"- Ask a thoughtful follow-up question to encourage further conversation.\n"
        f"- Be empathetic, supportive, and never judgmental.\n"
        f"- Keep your response concise and actionable.\n"
    )

    payload = {"contents": [{"parts": [{"text": prompt}]}]}
    headers = {"Content-Type": "application/json"}

    if API_KEY and len(API_KEY) > 10:
        for model_name in FALLBACK_MODELS:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={API_KEY}"
            try:
                response = requests.post(url, headers=headers, json=payload, timeout=12)
                if response.status_code == 200:
                    response_data = response.json()
                    if 'candidates' in response_data and response_data['candidates']:
                        candidate_text = response_data['candidates'][0]['content']['parts'][0]['text']
                        if candidate_text and len(candidate_text.strip()) > 10:
                            return candidate_text.strip()
            except Exception as e:
                print(f"Gemini API model {model_name} error: {e}")
                continue

    # Intelligent dynamic fallback when API key is unconfigured or rate-limited
    return generate_dynamic_empathetic_response(user_input, emotions)

def text_to_speech(text):
    try:
        tts = gTTS(text=text, lang="en")
        temp_audio_file = tempfile.NamedTemporaryFile(delete=False, suffix=".mp3")
        tts.save(temp_audio_file.name)
        return temp_audio_file.name
    except Exception as e:
        print(f"Error generating speech: {e}")
        return ""

def process_media(audio_file, video_file, text_input, username="default"):
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
    gemini_response = get_gemini_response(text, detected_emotions, username)

    # Save to database with vector embedding
    save_chat_turn_db(username, text, emotions_text, gemini_response)

    user_history = get_chat_history_db(username)
    chat_history_text = "\n".join([f"User: {h[0]}\nEmotion: {h[1]}\nBot: {h[2]}\n" for h in user_history])

    audio_response_file = text_to_speech(gemini_response) or ""
    return text, emotions_text, gemini_response, chat_history_text, audio_response_file

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

@app.post("/chat")
def chat_endpoint(text_input: str = Form(...), username: str = Form("default")):
    text, emotions_text, gemini_response, chat_history_text, audio_path = process_media(None, None, text_input, username)
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
    """
    Deletes a specific turn (by index) from the user's chat history in Firestore or local fallback storage.
    """
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
    """
    Clears all chat history for a specific user.
    """
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
    return {"success": True, "message": "Chat history cleared successfully."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)