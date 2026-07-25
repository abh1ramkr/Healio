"""
HEALIO - AI Mental Health Chatbot Backend Entry Point

Runs the FastAPI backend server for the React frontend interface.
"""

import sys
from pathlib import Path
import uvicorn

# Ensure root directory is in sys.path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.main import app

if __name__ == "__main__":
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)