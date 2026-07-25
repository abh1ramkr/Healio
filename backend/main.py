import os
import tempfile
import base64
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import whisper
import requests
import torch
from transformers import AutoTokenizer, AutoModelForSequenceClassification
from gtts import gTTS

# Load environment variables
env_path = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(env_path)

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

# Store chat history globally
chat_history = []

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

def get_gemini_response(user_input, emotions):
    history_text = "\n".join([f"User: {h[0]}\nBot: {h[2]}" for h in chat_history[-5:]])
    top_emotion = emotions[0][0]

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

def process_media(audio_file, video_file, text_input):
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
    gemini_response = get_gemini_response(text, detected_emotions)

    chat_history.append((text, emotions_text, gemini_response))
    chat_history_text = "\n".join([f"User: {h[0]}\nEmotion: {h[1]}\nBot: {h[2]}\n" for h in chat_history])

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

@app.post("/login")
def login_endpoint(username: str = Form(...), password: str = Form(...)):
    if (username == "121" and password == "123") or (username == "admin" and password == "password"):
        return {"success": True, "message": "Login Successful"}
    else:
        raise HTTPException(status_code=401, detail="Invalid Credentials")

@app.post("/chat")
def chat_endpoint(text_input: str = Form(...)):
    text, emotions_text, gemini_response, chat_history_text, audio_path = process_media(None, None, text_input)
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
def voice_endpoint(audio_file: UploadFile = File(...)):
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp:
            temp.write(audio_file.file.read())
            temp_path = temp.name
        text, emotions_text, gemini_response, chat_history_text, audio_path = process_media(temp_path, None, "")
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
def video_endpoint(video_file: UploadFile = File(...)):
    temp_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".mp4") as temp:
            temp.write(video_file.file.read())
            temp_path = temp.name
        text, emotions_text, gemini_response, chat_history_text, audio_path = process_media(None, temp_path, "")
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
def get_history():
    return {"history": chat_history}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)