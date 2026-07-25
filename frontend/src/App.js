import React, { useState, useEffect, useRef } from 'react';
import './App.css';

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Media states
  const [audioFile, setAudioFile] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [audioTimer, setAudioTimer] = useState(0);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);

  const messagesEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const audioTimerRef = useRef(null);
  const audioInputFileRef = useRef(null);
  const videoInputFileRef = useRef(null);

  // Splash screen transition timer
  useEffect(() => {
    const timer = setTimeout(() => {
      setShowSplash(false);
    }, 2200);
    return () => clearTimeout(timer);
  }, []);

  // Auto-scroll chat feed
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Audio recording timer counter
  useEffect(() => {
    if (isRecordingAudio) {
      audioTimerRef.current = setInterval(() => {
        setAudioTimer((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(audioTimerRef.current);
      setAudioTimer(0);
    }
    return () => clearInterval(audioTimerRef.current);
  }, [isRecordingAudio]);

  const fetchHistory = async () => {
    try {
      const res = await fetch('/history');
      const data = await res.json();
      if (data && data.history) {
        const loaded = [];
        data.history.forEach((h) => {
          if (h[0]) loaded.push({ type: 'user', text: h[0] });
          if (h[2]) loaded.push({ type: 'bot', text: h[2], emotions: h[1] });
        });
        setMessages(loaded);
      }
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      setLoginError('Please enter username and password');
      return;
    }
    setIsLoggingIn(true);
    setLoginError('');

    const formData = new FormData();
    formData.append('username', username);
    formData.append('password', password);

    try {
      const res = await fetch('/login', { method: 'POST', body: formData });
      if (res.ok) {
        setLoggedIn(true);
        fetchHistory();
      } else {
        setLoginError('Invalid credentials. Use admin / password');
      }
    } catch (error) {
      setLoginError('Connection failed. Make sure backend is running.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const sendRequest = async (endpoint, formData, fallbackUserText = '') => {
    setIsLoading(true);
    try {
      const res = await fetch(endpoint, { method: 'POST', body: formData });
      const data = await res.json();
      
      const userText = data.transcription || inputText || fallbackUserText || 'Media Upload Processed';
      const userMsg = { type: 'user', text: userText };
      const botMsg = {
        type: 'bot',
        text: data.response,
        emotions: data.emotions,
        audio: data.audio_base64 ? `data:audio/mp3;base64,${data.audio_base64}` : null,
      };

      setMessages((prev) => [...prev, userMsg, botMsg]);
      setInputText('');
      setAudioFile(null);
      setVideoFile(null);
    } catch (error) {
      console.error('API Error:', error);
      setMessages((prev) => [
        ...prev,
        { type: 'bot', text: 'I encountered an issue processing your request. Please try again.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendText = (textToSend) => {
    const query = textToSend || inputText;
    if (!query.trim()) return;
    const formData = new FormData();
    formData.append('text_input', query);
    sendRequest('/chat', formData, query);
  };

  const handleSendAudioFile = (file) => {
    const targetFile = file || audioFile;
    if (!targetFile) return;
    const formData = new FormData();
    formData.append('audio_file', targetFile);
    sendRequest('/voice', formData, 'Audio Upload');
  };

  const handleSendVideoFile = (file) => {
    const targetFile = file || videoFile;
    if (!targetFile) return;
    const formData = new FormData();
    formData.append('video_file', targetFile);
    sendRequest('/video', formData, 'Video Upload');
  };

  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      const chunks = [];
      mediaRecorderRef.current.ondataavailable = (e) => chunks.push(e.data);
      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/wav' });
        const formData = new FormData();
        formData.append('audio_file', blob, 'recording.wav');
        await sendRequest('/voice', formData, 'Voice Recording');
        stream.getTracks().forEach((track) => track.stop());
      };
      mediaRecorderRef.current.start();
      setIsRecordingAudio(true);
    } catch (error) {
      alert('Microphone access denied or unavailable.');
    }
  };

  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && isRecordingAudio) {
      mediaRecorderRef.current.stop();
      setIsRecordingAudio(false);
    }
  };

  const openVideoModal = async () => {
    setShowVideoModal(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      alert('Camera access denied or unavailable.');
    }
  };

  const startVideoRecording = () => {
    if (!streamRef.current) return;
    mediaRecorderRef.current = new MediaRecorder(streamRef.current);
    const chunks = [];
    mediaRecorderRef.current.ondataavailable = (e) => chunks.push(e.data);
    mediaRecorderRef.current.onstop = async () => {
      const blob = new Blob(chunks, { type: 'video/mp4' });
      const formData = new FormData();
      formData.append('video_file', blob, 'video_rec.mp4');
      await sendRequest('/video', formData, 'Video Recording');
      closeVideoModal();
    };
    mediaRecorderRef.current.start();
    setIsRecordingVideo(true);
  };

  const stopVideoRecording = () => {
    if (mediaRecorderRef.current && isRecordingVideo) {
      mediaRecorderRef.current.stop();
      setIsRecordingVideo(false);
    }
  };

  const closeVideoModal = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
    setShowVideoModal(false);
    setIsRecordingVideo(false);
  };

  const getEmotionClass = (emotionsStr) => {
    if (!emotionsStr) return 'neutral';
    const lower = emotionsStr.toLowerCase();
    if (lower.includes('sadness') || lower.includes('grief') || lower.includes('remorse')) return 'sadness';
    if (lower.includes('joy') || lower.includes('optimism') || lower.includes('amusement') || lower.includes('love')) return 'joy';
    if (lower.includes('anger') || lower.includes('annoyance') || lower.includes('disgust')) return 'anger';
    if (lower.includes('fear') || lower.includes('nervousness')) return 'fear';
    return 'neutral';
  };

  // 1. Splash Loader
  if (showSplash) {
    return (
      <div className="splash-container">
        <div className="splash-logo">😊</div>
        <h1 className="splash-title">HEALIO</h1>
        <p className="splash-subtitle">AI Multimodal Mental Health Companion</p>
        <div className="spinner-ring"></div>
      </div>
    );
  }

  // 2. Login View
  if (!loggedIn) {
    return (
      <div className="login-view">
        <div className="login-card">
          <div className="login-header">
            <h2>🔑 Welcome to HEALIO</h2>
            <p>Empathetic AI support powered by Gemini</p>
          </div>
          <form onSubmit={handleLogin}>
            <div className="input-group">
              <label>Username</label>
              <input
                type="text"
                className="input-field"
                placeholder="Enter username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <div className="input-group">
              <label>Password</label>
              <input
                type="password"
                className="input-field"
                placeholder="Enter password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {loginError && <div className="login-error">{loginError}</div>}
            <button type="submit" className="btn-primary" disabled={isLoggingIn}>
              {isLoggingIn ? 'Logging in...' : 'Sign In'}
            </button>
          </form>
          <div className="login-demo-hint">
            💡 Demo Credentials: Username <strong>admin</strong> | Password <strong>password</strong>
          </div>
        </div>
      </div>
    );
  }

  // 3. Main Chat Interface
  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="header-brand">
          <span className="brand-icon">😊</span>
          <span className="brand-title">HEALIO</span>
          <span className="brand-badge">Gemini 2.0 AI</span>
        </div>
        <div className="header-actions">
          <div className="status-pill">
            <span className="status-dot"></span>
            Online
          </div>
          <button className="btn-secondary" onClick={() => setMessages([])}>
            Clear Chat
          </button>
          <button className="btn-secondary" onClick={() => setLoggedIn(false)}>
            Logout
          </button>
        </div>
      </header>

      {/* Chat Workspace */}
      <div className="chat-workspace">
        <div className="messages-feed">
          {messages.length === 0 ? (
            <div className="starter-prompts-view">
              <div className="starter-icon">🌱</div>
              <h2 className="starter-title">How are you feeling right now?</h2>
              <p className="starter-subtitle">
                HEALIO transcribes voice recordings, detects your emotion, and provides empathetic guidance.
              </p>
              <div className="prompts-grid">
                <div
                  className="prompt-card"
                  onClick={() => handleSendText("I'm feeling a bit anxious and overwhelmed today.")}
                >
                  <h4>😰 Feeling Overwhelmed</h4>
                  <p>"I'm feeling a bit anxious and overwhelmed today."</p>
                </div>
                <div
                  className="prompt-card"
                  onClick={() => handleSendText("Can you guide me through a quick breathing exercise?")}
                >
                  <h4>🧘 Need Calm & Focus</h4>
                  <p>"Can you guide me through a quick breathing exercise?"</p>
                </div>
                <div
                  className="prompt-card"
                  onClick={() => handleSendText("I had a rough day at work and need someone to talk to.")}
                >
                  <h4>💼 Rough Day at Work</h4>
                  <p>"I had a rough day at work and need someone to talk to."</p>
                </div>
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div key={idx} className={`message-row ${msg.type}`}>
                <div className="avatar-badge">{msg.type === 'user' ? '👤' : '🤖'}</div>
                <div className="message-bubble">
                  <p>{msg.text}</p>

                  {/* Emotion Chips */}
                  {msg.emotions && (
                    <div className="emotion-chips-container">
                      {msg.emotions.split(', ').map((emo, i) => (
                        <span key={i} className={`chip-tag ${getEmotionClass(emo)}`}>
                          ✨ {emo}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Audio Response */}
                  {msg.audio && (
                    <div className="audio-player-wrapper">
                      <audio controls src={msg.audio} autoPlay />
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {isLoading && (
            <div className="message-row bot">
              <div className="avatar-badge">🤖</div>
              <div className="message-bubble loading-bubble">
                <span>HEALIO is processing...</span>
                <div className="dot-pulse">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar & Controls */}
        <div className="input-control-panel">
          {/* File Attachment Previews */}
          {audioFile && (
            <div className="file-attachment-bar">
              <span>🎵 Selected Audio: {audioFile.name}</span>
              <button
                className="remove-file-btn"
                onClick={() => {
                  setAudioFile(null);
                  if (audioInputFileRef.current) audioInputFileRef.current.value = '';
                }}
              >
                ✕
              </button>
            </div>
          )}

          {videoFile && (
            <div className="file-attachment-bar">
              <span>🎬 Selected Video: {videoFile.name}</span>
              <button
                className="remove-file-btn"
                onClick={() => {
                  setVideoFile(null);
                  if (videoInputFileRef.current) videoInputFileRef.current.value = '';
                }}
              >
                ✕
              </button>
            </div>
          )}

          <div className="input-main-bar">
            <input
              type="text"
              className="chat-input"
              placeholder={
                isRecordingAudio
                  ? `Recording Voice... (${audioTimer}s)`
                  : 'Type your thoughts or use audio/video recording...'
              }
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendText()}
              disabled={isLoading || isRecordingAudio}
            />

            <div className="media-btn-group">
              {/* Hidden File Inputs */}
              <input
                type="file"
                accept="audio/*"
                ref={audioInputFileRef}
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files[0]) {
                    setAudioFile(e.target.files[0]);
                    handleSendAudioFile(e.target.files[0]);
                  }
                }}
              />
              <input
                type="file"
                accept="video/*"
                ref={videoInputFileRef}
                style={{ display: 'none' }}
                onChange={(e) => {
                  if (e.target.files[0]) {
                    setVideoFile(e.target.files[0]);
                    handleSendVideoFile(e.target.files[0]);
                  }
                }}
              />

              {/* Upload Buttons */}
              <button
                type="button"
                className="btn-icon-action"
                title="Upload Audio File"
                onClick={() => audioInputFileRef.current?.click()}
                disabled={isLoading || isRecordingAudio}
              >
                🎵
              </button>

              <button
                type="button"
                className="btn-icon-action"
                title="Upload Video File"
                onClick={() => videoInputFileRef.current?.click()}
                disabled={isLoading || isRecordingAudio}
              >
                🎬
              </button>

              {/* Record Audio Mic */}
              <button
                type="button"
                className={`btn-icon-action ${isRecordingAudio ? 'recording' : ''}`}
                title={isRecordingAudio ? 'Stop Recording' : 'Record Audio'}
                onClick={isRecordingAudio ? stopAudioRecording : startAudioRecording}
                disabled={isLoading}
              >
                {isRecordingAudio ? '⏹️' : '🎙️'}
              </button>

              {/* Record Video Camera Modal */}
              <button
                type="button"
                className="btn-icon-action"
                title="Record Webcam Video"
                onClick={openVideoModal}
                disabled={isLoading || isRecordingAudio}
              >
                📹
              </button>

              {/* Send Button */}
              <button
                type="button"
                className="btn-send"
                onClick={() => handleSendText()}
                disabled={isLoading || isRecordingAudio || (!inputText.trim() && !audioFile && !videoFile)}
              >
                ➔
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Video Recorder Modal */}
      {showVideoModal && (
        <div className="video-preview-modal">
          <div className="video-modal-card">
            <h3>📹 Record Video Message</h3>
            <p style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '15px' }}>
              Record a short video to analyze facial expressions and voice.
            </p>
            <video ref={videoRef} autoPlay muted className="video-viewfinder" />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              {!isRecordingVideo ? (
                <button className="btn-primary" style={{ width: 'auto' }} onClick={startVideoRecording}>
                  🔴 Start Recording
                </button>
              ) : (
                <button
                  className="btn-primary"
                  style={{ width: 'auto', background: '#ef4444' }}
                  onClick={stopVideoRecording}
                >
                  ⏹️ Stop & Send
                </button>
              )}
              <button className="btn-secondary" onClick={closeVideoModal}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;