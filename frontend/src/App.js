import React, { useState, useEffect, useRef } from 'react';
import './App.css';

// Typewriter component for animated typing effect on new AI responses
function TypewriterText({ text, speed = 12 }) {
  const [displayedText, setDisplayedText] = useState('');
  const [isTyping, setIsTyping] = useState(true);

  useEffect(() => {
    let index = 0;
    setIsTyping(true);
    setDisplayedText('');

    if (!text) {
      setIsTyping(false);
      return;
    }

    const interval = setInterval(() => {
      if (index < text.length) {
        setDisplayedText((prev) => text.slice(0, index + 1));
        index++;
      } else {
        setIsTyping(false);
        clearInterval(interval);
      }
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed]);

  return (
    <span>
      {displayedText}
      {isTyping && <span className="typing-cursor">|</span>}
    </span>
  );
}

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [loggedIn, setLoggedIn] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' | 'register'
  const [currentUser, setCurrentUser] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [registerSuccess, setRegisterSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Media & Popup states
  const [showPlusMenu, setShowPlusMenu] = useState(false);
  const [audioFile, setAudioFile] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [isAudioPaused, setIsAudioPaused] = useState(false);
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
  const plusMenuRef = useRef(null);

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
    if (isRecordingAudio && !isAudioPaused) {
      audioTimerRef.current = setInterval(() => {
        setAudioTimer((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(audioTimerRef.current);
    }
    return () => clearInterval(audioTimerRef.current);
  }, [isRecordingAudio, isAudioPaused]);

  // Close plus menu on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (plusMenuRef.current && !plusMenuRef.current.contains(event.target)) {
        setShowPlusMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchHistory = async (user) => {
    const targetUser = user || currentUser;
    if (!targetUser) return;
    try {
      const res = await fetch(`/history?username=${encodeURIComponent(targetUser)}`);
      const data = await res.json();
      if (data && data.history) {
        const loaded = [];
        data.history.forEach((h) => {
          if (h[0]) loaded.push({ type: 'user', text: h[0], isNew: false });
          if (h[2]) loaded.push({ type: 'bot', text: h[2], emotions: h[1], isNew: false });
        });
        setMessages(loaded);
      }
    } catch (error) {
      console.error('Error loading history:', error);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setLoginError('Please enter username and password');
      return;
    }
    setIsSubmitting(true);
    setLoginError('');
    setRegisterSuccess('');

    const formData = new FormData();
    formData.append('username', username.trim());
    formData.append('password', password.trim());

    try {
      const res = await fetch('/login', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok && data.success) {
        const activeUser = data.username || username.trim();
        setCurrentUser(activeUser);
        setLoggedIn(true);
        fetchHistory(activeUser);
      } else {
        setLoginError(data.detail || 'Invalid username or password.');
      }
    } catch (error) {
      setLoginError('Connection failed. Make sure backend is running.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setLoginError('Please enter a username and password');
      return;
    }
    if (password !== confirmPassword) {
      setLoginError('Passwords do not match');
      return;
    }
    setIsSubmitting(true);
    setLoginError('');
    setRegisterSuccess('');

    const formData = new FormData();
    formData.append('username', username.trim());
    formData.append('password', password.trim());

    try {
      const res = await fetch('/register', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok && data.success) {
        setRegisterSuccess(data.message || 'Registration successful! You can now log in.');
        setAuthMode('login');
        setPassword('');
        setConfirmPassword('');
      } else {
        setLoginError(data.detail || 'Registration failed.');
      }
    } catch (error) {
      setLoginError('Connection failed. Make sure backend is running.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLogout = () => {
    setLoggedIn(false);
    setCurrentUser('');
    setMessages([]);
    setPassword('');
    setConfirmPassword('');
    setLoginError('');
    setRegisterSuccess('');
  };

  const sendRequest = async (endpoint, formData, fallbackUserText = '') => {
    setIsLoading(true);
    formData.append('username', currentUser || 'default');
    try {
      const res = await fetch(endpoint, { method: 'POST', body: formData });
      const data = await res.json();
      
      const userText = data.transcription || inputText || fallbackUserText || 'Media Upload Processed';
      const userMsg = { type: 'user', text: userText, isNew: false };
      const botMsg = {
        type: 'bot',
        text: data.response,
        emotions: data.emotions,
        audio: data.audio_base64 ? `data:audio/mp3;base64,${data.audio_base64}` : null,
        isNew: true, // triggers typewriter animation
      };

      setMessages((prev) => [...prev, userMsg, botMsg]);
      setInputText('');
      setAudioFile(null);
      setVideoFile(null);
    } catch (error) {
      console.error('API Error:', error);
      setMessages((prev) => [
        ...prev,
        { type: 'bot', text: 'I encountered an issue processing your request. Please try again.', isNew: true },
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
      setIsAudioPaused(false);
      setAudioTimer(0);
    } catch (error) {
      alert('Microphone access denied or unavailable.');
    }
  };

  const pauseAudioRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setIsAudioPaused(true);
    }
  };

  const resumeAudioRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setIsAudioPaused(false);
    }
  };

  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && isRecordingAudio) {
      mediaRecorderRef.current.stop();
      setIsRecordingAudio(false);
      setIsAudioPaused(false);
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

  // 2. Authentication View (Login & Register)
  if (!loggedIn) {
    return (
      <div className="login-view">
        <div className="login-card">
          <div className="login-header">
            <h2>😊 Welcome to HEALIO</h2>
            <p>Empathetic AI mental health companion</p>
          </div>

          {/* Auth Tab Switcher */}
          <div className="auth-tab-bar">
            <button
              type="button"
              className={`auth-tab-btn ${authMode === 'login' ? 'active' : ''}`}
              onClick={() => {
                setAuthMode('login');
                setLoginError('');
                setRegisterSuccess('');
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`auth-tab-btn ${authMode === 'register' ? 'active' : ''}`}
              onClick={() => {
                setAuthMode('register');
                setLoginError('');
                setRegisterSuccess('');
              }}
            >
              Register New Account
            </button>
          </div>

          {registerSuccess && <div className="login-success">{registerSuccess}</div>}
          {loginError && <div className="login-error">{loginError}</div>}

          {authMode === 'login' ? (
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
              <button type="submit" className="btn-primary" disabled={isSubmitting}>
                {isSubmitting ? 'Logging in...' : 'Sign In'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister}>
              <div className="input-group">
                <label>Username</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Choose a username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div className="input-group">
                <label>Password</label>
                <input
                  type="password"
                  className="input-field"
                  placeholder="Choose a password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <div className="input-group">
                <label>Confirm Password</label>
                <input
                  type="password"
                  className="input-field"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <button type="submit" className="btn-primary" disabled={isSubmitting}>
                {isSubmitting ? 'Creating Account...' : 'Register'}
              </button>
            </form>
          )}

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
          <div className="user-badge-pill">
            👤 <strong>{currentUser}</strong>
          </div>
          <div className="status-pill">
            <span className="status-dot"></span>
            Online
          </div>
          <button className="btn-secondary" onClick={() => setMessages([])}>
            Clear Chat
          </button>
          <button className="btn-secondary" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>

      {/* Chat Workspace */}
      <div className="chat-workspace">
        <div className="messages-feed">
          {messages.length === 0 ? (
            <div className="empty-chat-welcome">
              <div className="welcome-avatar">😊</div>
              <h2>Hello, {currentUser}! I'm HEALIO</h2>
              <p>
                I am your empathetic mental health support companion. Feel free to talk to me via text, voice recordings, or video clips.
              </p>
              <div className="prompt-chips">
                <button className="chip" onClick={() => handleSendText("I've been feeling a bit overwhelmed lately.")}>
                  "I've been feeling a bit overwhelmed..."
                </button>
                <button className="chip" onClick={() => handleSendText("Can you recommend some quick breathing exercises?")}>
                  "Recommend quick breathing exercises"
                </button>
                <button className="chip" onClick={() => handleSendText("I'm feeling really happy today!")}>
                  "I'm feeling really happy today!"
                </button>
              </div>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div key={idx} className={`message-row ${msg.type === 'user' ? 'user' : 'bot'}`}>
                <div className="avatar-badge">
                  {msg.type === 'user' ? '👤' : '😊'}
                </div>
                <div className={`message-bubble ${msg.type === 'user' ? 'bubble-user' : 'bubble-bot'}`}>
                  {msg.type === 'bot' && (
                    <div className="bot-header">
                      <span className="bot-name">HEALIO AI</span>
                    </div>
                  )}

                  <div className="message-content">
                    {msg.type === 'bot' && msg.isNew ? (
                      <TypewriterText text={msg.text} speed={12} />
                    ) : (
                      msg.text
                    )}
                  </div>

                  {msg.audio && (
                    <div className="audio-player-wrapper">
                      <audio controls src={msg.audio} className="custom-audio-player" autoPlay />
                    </div>
                  )}
                </div>
              </div>
            ))
          )}

          {isLoading && (
            <div className="message-row bot">
              <div className="avatar-badge">😊</div>
              <div className="message-bubble bubble-bot loading-bubble">
                <div className="typing-indicator">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
                <span className="loading-label">HEALIO is thinking & generating response...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Control & Input Bar */}
        <div className="input-control-panel">
          {/* File Previews Bar */}
          {(audioFile || videoFile) && (
            <div className="media-preview-bar">
              {audioFile && (
                <div className="media-tag">
                  🎵 Audio File: {audioFile.name}
                  <button onClick={() => setAudioFile(null)}>✕</button>
                </div>
              )}
              {videoFile && (
                <div className="media-tag">
                  📹 Video File: {videoFile.name}
                  <button onClick={() => setVideoFile(null)}>✕</button>
                </div>
              )}
            </div>
          )}

          {/* Main Action Bar */}
          <div className="input-action-bar">
            {/* Left Plus Menu */}
            <div className="plus-menu-container" ref={plusMenuRef}>
              <button
                type="button"
                className={`btn-plus ${showPlusMenu ? 'active' : ''}`}
                title="Upload Media Files"
                onClick={() => setShowPlusMenu((prev) => !prev)}
                disabled={isLoading || isRecordingAudio}
              >
                +
              </button>

              {showPlusMenu && (
                <div className="plus-popup-menu">
                  <button
                    type="button"
                    className="popup-item"
                    onClick={() => {
                      setShowPlusMenu(false);
                      audioInputFileRef.current?.click();
                    }}
                  >
                    <span className="popup-icon">🎵</span>
                    <span>Upload Audio File</span>
                  </button>
                  <button
                    type="button"
                    className="popup-item"
                    onClick={() => {
                      setShowPlusMenu(false);
                      videoInputFileRef.current?.click();
                    }}
                  >
                    <span className="popup-icon">🎬</span>
                    <span>Upload Video File</span>
                  </button>
                </div>
              )}
            </div>

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

            {/* Center Area: Voice Recording Bar OR Text Input */}
            {isRecordingAudio ? (
              <div className="voice-recording-inline-bar">
                <div className="recording-indicator">
                  <span className={`rec-dot ${isAudioPaused ? 'paused' : 'pulsing'}`}></span>
                  <span className="rec-timer">
                    {isAudioPaused ? 'Paused' : `Recording ${audioTimer}s`}
                  </span>
                </div>

                <div className="recording-controls">
                  <button
                    type="button"
                    className="btn-rec-control"
                    onClick={isAudioPaused ? resumeAudioRecording : pauseAudioRecording}
                  >
                    {isAudioPaused ? '▶️ Resume' : '⏸️ Pause'}
                  </button>
                  <button
                    type="button"
                    className="btn-send-rec"
                    onClick={stopAudioRecording}
                  >
                    ➔ Send
                  </button>
                </div>
              </div>
            ) : (
              <>
                <input
                  type="text"
                  className="chat-text-input"
                  placeholder="Ask anything..."
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendText();
                    }
                  }}
                  disabled={isLoading}
                />

                {/* Right Action Buttons: Camera, Mic, Send */}
                <div className="action-buttons-right">
                  {/* Camera Button */}
                  <button
                    type="button"
                    className="btn-icon-right"
                    title="Record Webcam Video"
                    onClick={openVideoModal}
                    disabled={isLoading}
                  >
                    📷
                  </button>

                  {/* Mic Button */}
                  <button
                    type="button"
                    className="btn-icon-right mic-btn"
                    title="Record Voice Audio"
                    onClick={startAudioRecording}
                    disabled={isLoading}
                  >
                    🎙️
                  </button>

                  {/* Send Button */}
                  <button
                    type="button"
                    className="btn-send-main"
                    onClick={() => handleSendText()}
                    disabled={isLoading || (!inputText.trim() && !audioFile && !videoFile)}
                  >
                    ➔
                  </button>
                </div>
              </>
            )}
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