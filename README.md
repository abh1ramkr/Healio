# HEALIO - AI Mental Health Chatbot

A React & FastAPI mental health companion application that transcribes audio/video, detects emotions, and provides empathetic responses using Gemini AI.

## Features

- **React Web Interface**: Modern, responsive UI with text chat, audio recording, and video recording support
- **Audio & Video Transcription**: Powered by OpenAI's Whisper model
- **Emotion Detection**: Powered by fine-tuned GoEmotions model
- **Empathetic AI Responses**: Generated using Google Gemini API
- **Text-to-Speech (TTS)**: Voice responses generated via gTTS
- **Session History**: Track conversation history and emotion trends

## Project Structure

```
healio/
├── backend/             # FastAPI backend API
│   ├── main.py          # REST API endpoints & ML inference logic
│   └── requirements.txt # Backend Python dependencies
├── frontend/            # React frontend application
│   ├── public/          # Public static assets
│   ├── src/             # React components (App.js, App.css)
│   └── package.json     # Node.js dependencies & scripts
├── src/
│   └── main.py          # FastAPI backend entry point
├── requirements.txt     # Python dependencies
├── .env                 # Environment variables (API keys)
└── README.md           # Documentation
```

## Setup Instructions

### 1. Backend Setup

```bash
# Create virtual environment (if not already created)
python -m venv .venv

# Activate virtual environment
# On Windows:
.venv\Scripts\activate
# On macOS/Linux:
# source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 2. Configure Environment Variables

Ensure `.env` contains your Gemini API key:
```env
GEMINI_API_KEY=your_gemini_api_key_here
```

### 3. Run Backend API

```bash
python backend/main.py
```
*The FastAPI server will run on `http://127.0.0.1:8000`.*

### 4. Run React Frontend

In a separate terminal window:
```bash
cd frontend
npm install
npm start
```
*The React web app will open on `http://localhost:3000`.*

## Usage

1. **Splash & Login**: Login with default credentials (Username: `admin` / Password: `password`).
2. **Text Chat**: Type messages and receive empathetic responses with emotion analysis.
3. **Voice Recording & Audio Upload**: Record audio directly in the browser or upload `.wav`/`.mp3` files.
4. **Video Recording & Upload**: Record video directly via web camera or upload video files for transcription and emotion analysis.