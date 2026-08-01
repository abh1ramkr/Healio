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
    "gemini-2.0-flash",
    "gemini-flash-latest",
    "gemini-3.6-flash",
    "gemini-2.0-flash-lite"
]

def generate_vector_embedding(text: str) -> List[float]:
    """
    Generate a 64-dimensional vector embedding for text using token/char distributions and PyTorch tensor normalization.
    """
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
    if db is not None:
        try:
            doc_ref = db.collection("users").document(username)
            if doc_ref.get().exists:
                return False
            doc_ref.set({
                "username": username,
                "password_hash": password_hash,
                "created_at": firestore.SERVER_TIMESTAMP
            })
            return True
        except Exception as e:
            print(f"Firestore register error: {e}")
    
    if username in fallback_users:
        return False
    fallback_users[username] = {
        "username": username,
        "password_hash": password_hash,
        "created_at": time.time()
    }
    return True

def verify_user_db(username: str, password: str) -> bool:
    password_hash = hash_password(password)
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

def transcribe_audio_video(file_path):
    if not file_path or not Path(file_path).exists():
        return ""
    try:
        result = model.transcribe(str(file_path))
        return result["text"].strip()
    except Exception as e:
        print(f"Transcription error: {e}")
        return ""

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
        f"- If the user is sad, anxious, or stressed, suggest specific methods to reduce those feelings (e.g., breathing exercises, journaling, reaching out to friends, etc.).\n"
        f"- Be empathetic, supportive, and never judgmental.\n"
        f"- Keep your response concise and actionable.\n"
    )

    payload = {"contents": [{"parts": [{"text": prompt}]}]}
    headers = {"Content-Type": "application/json"}

    if not API_KEY:
        return "API key not configured. Please set GEMINI_API_KEY in .env"

    for model_name in FALLBACK_MODELS:
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}:generateContent?key={API_KEY}"
        try:
            response = requests.post(url, headers=headers, json=payload, timeout=15)
            if response.status_code == 200:
                response_data = response.json()
                if 'candidates' in response_data and response_data['candidates']:
                    return response_data['candidates'][0]['content']['parts'][0]['text']
        except Exception:
            continue

    return "I'm here to support you. Can you tell me more about what you're experiencing? For sadness or stress, I can suggest coping methods like deep breathing, journaling, or talking to someone you trust."

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