import React, { useState, useEffect, useRef } from 'react';
import './App.css';

// Dynamic Time-based Greeting Helper
function getGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Good Morning';
  if (hour >= 12 && hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

// Daily Affirmation Quotes
const AFFIRMATIONS = [
  "Take one small step today. That's enough.",
  "Breathe deeply. You are safe, supported, and heard.",
  "Your feelings are valid. Take all the time you need.",
  "Be gentle with yourself today. You are doing the best you can.",
  "Peace begins with a single conscious breath."
];

// Map detected emotion text to corresponding mood emoji
function mapEmotionToMoodEmoji(emotionsText) {
  if (!emotionsText) return { emoji: '😊', label: 'neutral' };
  const lower = emotionsText.toLowerCase();
  
  if (lower.includes('joy') || lower.includes('amusement') || lower.includes('excitement') || 
      lower.includes('optimism') || lower.includes('gratitude') || lower.includes('love') || lower.includes('admiration')) {
    return { emoji: '😄', label: lower.split(' ')[0] || 'joy' };
  }
  if (lower.includes('caring') || lower.includes('approval') || lower.includes('curiosity') || lower.includes('relief')) {
    return { emoji: '😊', label: lower.split(' ')[0] || 'caring' };
  }
  if (lower.includes('sadness') || lower.includes('grief') || lower.includes('disappointment') || lower.includes('remorse')) {
    return { emoji: '😔', label: lower.split(' ')[0] || 'sadness' };
  }
  if (lower.includes('fear') || lower.includes('nervousness') || lower.includes('anger') || 
      lower.includes('annoyance') || lower.includes('disgust') || lower.includes('embarrassment')) {
    return { emoji: '😰', label: lower.split(' ')[0] || 'anxiety' };
  }
  return { emoji: '😐', label: 'neutral' };
}

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
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Platform UI States
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [selectedMood, setSelectedMood] = useState('😊');
  const [detectedEmotionLabel, setDetectedEmotionLabel] = useState('Neutral');
  const [dailyAffirmation] = useState(() => AFFIRMATIONS[Math.floor(Math.random() * AFFIRMATIONS.length)]);
  const [showBreathingModal, setShowBreathingModal] = useState(false);
  const [breathingText, setBreathingText] = useState('Inhale slowly...');

  // Chat & Message States
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  // Hover 3-Dots Dropdown & Selection States
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [selectedMsgIds, setSelectedMsgIds] = useState(new Set());
  
  // Media & Popup states
  const [showPaperclipMenu, setShowPaperclipMenu] = useState(false);
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
  const paperclipMenuRef = useRef(null);

  // Splash screen timer
  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2200);
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

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (paperclipMenuRef.current && !paperclipMenuRef.current.contains(event.target)) {
        setShowPaperclipMenu(false);
      }
      if (!event.target.closest('.btn-msg-dots') && !event.target.closest('.msg-options-dropdown')) {
        setOpenDropdownId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Guided breathing timer effect
  useEffect(() => {
    let breathTimer;
    if (showBreathingModal) {
      const phases = ['Inhale slowly...', 'Hold your breath...', 'Exhale gently...', 'Rest & relax...'];
      let phaseIdx = 0;
      breathTimer = setInterval(() => {
        phaseIdx = (phaseIdx + 1) % phases.length;
        setBreathingText(phases[phaseIdx]);
      }, 2500);
    }
    return () => clearInterval(breathTimer);
  }, [showBreathingModal]);

  const fetchHistory = async (user) => {
    const targetUser = user || currentUser;
    if (!targetUser) return;
    try {
      const res = await fetch(`/history?username=${encodeURIComponent(targetUser)}`);
      const data = await res.json();
      if (data && data.history) {
        const loaded = [];
        data.history.forEach((h, idx) => {
          if (h[0]) loaded.push({ id: `hist_user_${idx}`, turnIndex: idx, type: 'user', text: h[0], isNew: false });
          if (h[2]) {
            loaded.push({ id: `hist_bot_${idx}`, turnIndex: idx, type: 'bot', text: h[2], emotions: h[1], isNew: false });
            // Auto update mood based on last turn
            const { emoji, label } = mapEmotionToMoodEmoji(h[1]);
            setSelectedMood(emoji);
            setDetectedEmotionLabel(label);
          }
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

  const handleClearChat = async () => {
    if (!currentUser) return;
    try {
      const formData = new FormData();
      formData.append('username', currentUser);
      await fetch('/clear_history', { method: 'POST', body: formData });
    } catch (err) {
      console.error('Error clearing backend history:', err);
    }
    setMessages([]);
    setSelectedMsgIds(new Set());
    setIsSelectMode(false);
  };

  // Optimistically displays user message FIRST, then calls backend
  const sendRequest = async (endpoint, formData, userText) => {
    const userMsgId = `user_${Date.now()}_${Math.random()}`;
    const userMsg = { id: userMsgId, type: 'user', text: userText, isNew: false };

    // 1. Optimistic Update: Append user message IMMEDIATELY to UI
    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setAudioFile(null);
    setVideoFile(null);
    setIsLoading(true);

    formData.append('username', currentUser || 'default');

    try {
      const res = await fetch(endpoint, { method: 'POST', body: formData });
      const data = await res.json();
      
      // 2. Auto-detect emotion and update current mood in sidebar automatically
      if (data.emotions) {
        const { emoji, label } = mapEmotionToMoodEmoji(data.emotions);
        setSelectedMood(emoji);
        setDetectedEmotionLabel(label);
      }

      // 3. Append Bot Message (NO auto-play audio! Text response only first)
      const botMsgId = `bot_${Date.now()}_${Math.random()}`;
      const botMsg = {
        id: botMsgId,
        type: 'bot',
        text: data.response,
        emotions: data.emotions,
        audio: data.audio_base64 ? `data:audio/mp3;base64,${data.audio_base64}` : null,
        isNew: true, // triggers typewriter text animation
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (error) {
      console.error('API Error:', error);
      setMessages((prev) => [
        ...prev,
        { id: `err_${Date.now()}`, type: 'bot', text: 'I encountered an issue. Please try again.', isNew: true },
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
    sendRequest('/voice', formData, `Audio: ${targetFile.name}`);
  };

  const handleSendVideoFile = (file) => {
    const targetFile = file || videoFile;
    if (!targetFile) return;
    const formData = new FormData();
    formData.append('video_file', targetFile);
    sendRequest('/video', formData, `Video: ${targetFile.name}`);
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
        await sendRequest('/voice', formData, '🎙️ Voice Recording');
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
      await sendRequest('/video', formData, '📹 Video Message');
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

  // --- Message Action Handlers (Read Aloud, Delete, Select) ---
  const handleReadAloud = (msg) => {
    setOpenDropdownId(null);
    if (msg.audio) {
      const audioObj = new Audio(msg.audio);
      audioObj.play().catch((e) => console.error('Audio play error:', e));
    } else if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(msg.text);
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    } else {
      alert('Speech synthesis is not supported on this browser.');
    }
  };

  const handleDeleteSingleMessage = async (msgId, msgIndex) => {
    setOpenDropdownId(null);
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
    
    // Sync backend deletion if turn index is available
    if (msgIndex !== undefined && currentUser) {
      try {
        const formData = new FormData();
        formData.append('username', currentUser);
        formData.append('index', msgIndex);
        await fetch('/delete_message', { method: 'POST', body: formData });
      } catch (err) {
        console.error('Error deleting message from backend:', err);
      }
    }
  };

  const handleToggleSelectMode = (msgId) => {
    setOpenDropdownId(null);
    setIsSelectMode(true);
    setSelectedMsgIds((prev) => {
      const updated = new Set(prev);
      if (updated.has(msgId)) updated.delete(msgId);
      else updated.add(msgId);
      return updated;
    });
  };

  const handleCheckboxToggle = (msgId) => {
    setSelectedMsgIds((prev) => {
      const updated = new Set(prev);
      if (updated.has(msgId)) updated.delete(msgId);
      else updated.add(msgId);
      return updated;
    });
  };

  const handleBulkDelete = () => {
    setMessages((prev) => prev.filter((m) => !selectedMsgIds.has(m.id)));
    setSelectedMsgIds(new Set());
    setIsSelectMode(false);
  };

  // 1. Splash Loader
  if (showSplash) {
    return (
      <div className="splash-container">
        <div className="splash-logo">😊</div>
        <h1 className="splash-title">HEALIO</h1>
        <p className="splash-subtitle">AI Mental Wellness Companion</p>
        <div className="spinner-ring"></div>
      </div>
    );
  }

  // 2. Premium Zen Glassmorphism Authentication Screen (Reference Image Layout)
  if (!loggedIn) {
    return (
      <div className="login-screen-wrapper">
        {/* Soft Organic Gradient Blobs Canvas Background */}
        <div className="login-bg-canvas">
          <div className="gradient-blob blob-bottom-left"></div>
          <div className="gradient-blob blob-top-right"></div>
          <div className="gradient-blob blob-center-soft"></div>
        </div>

        {/* Reference Image Style Dark Glass Card */}
        <div className="ref-login-glass-card">
          {/* Zen Ring Icon Header */}
          <div className="ref-card-header">
            <div className="zen-ring-icon">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.5">
                <circle cx="12" cy="12" r="4" />
                <circle cx="12" cy="12" r="8.5" strokeDasharray="3 3" />
              </svg>
            </div>
            <h1 className="ref-card-title">
              {authMode === 'login' ? 'Welcome back!' : 'Create account'}
            </h1>
            <p className="ref-card-subtitle">
              {authMode === 'login'
                ? 'Sign in to access your guided meditations, daily practices, and personal journey'
                : 'Sign up to start your guided meditations, daily practices, and personal journey'}
            </p>
          </div>

          {/* Alert messages */}
          {registerSuccess && <div className="ref-glass-alert success">{registerSuccess}</div>}
          {loginError && <div className="ref-glass-alert error">{loginError}</div>}

          {/* Form */}
          {authMode === 'login' ? (
            <form onSubmit={handleLogin} className="ref-glass-form">
              <div className="ref-input-group">
                <label>Username</label>
                <div className="ref-input-wrapper">
                  <input
                    type="text"
                    className="ref-glass-input"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="ref-input-group">
                <label>Password</label>
                <div className="ref-input-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="ref-glass-input"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="ref-btn-eye-toggle"
                    onClick={() => setShowPassword((prev) => !prev)}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="ref-actions-row">
                <label className="ref-checkbox-label">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span className="ref-custom-box"></span>
                  <span>Remember me</span>
                </label>
                <a
                  href="#forgot"
                  className="ref-forgot-link"
                  onClick={(e) => {
                    e.preventDefault();
                    setUsername('admin');
                    setPassword('password');
                    alert('Filled demo credentials!\nUsername: admin\nPassword: password');
                  }}
                >
                  Forgot password?
                </a>
              </div>

              <button type="submit" className="ref-btn-solid-white" disabled={isSubmitting}>
                {isSubmitting ? 'Logging In...' : 'Log In'}
              </button>

              <div className="ref-or-divider">
                <span>Or</span>
              </div>

              <button
                type="button"
                className="ref-btn-outline-pill"
                onClick={() => {
                  setUsername('admin');
                  setPassword('password');
                }}
              >
                <span className="demo-icon">💡</span> Quick Fill Demo Account (admin / password)
              </button>

              <div className="ref-footer-text">
                Don't have an account?{' '}
                <button
                  type="button"
                  className="ref-footer-link"
                  onClick={() => {
                    setAuthMode('register');
                    setLoginError('');
                    setRegisterSuccess('');
                  }}
                >
                  Sign Up
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="ref-glass-form">
              <div className="ref-input-group">
                <label>Username</label>
                <div className="ref-input-wrapper">
                  <input
                    type="text"
                    className="ref-glass-input"
                    placeholder="Choose a username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="ref-input-group">
                <label>Password</label>
                <div className="ref-input-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="ref-glass-input"
                    placeholder="Create a password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="ref-btn-eye-toggle"
                    onClick={() => setShowPassword((prev) => !prev)}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                </div>
              </div>

              <div className="ref-input-group">
                <label>Confirm Password</label>
                <div className="ref-input-wrapper">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="ref-glass-input"
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button type="submit" className="ref-btn-solid-white" disabled={isSubmitting}>
                {isSubmitting ? 'Creating Account...' : 'Sign Up'}
              </button>

              <div className="ref-footer-text">
                Already have an account?{' '}
                <button
                  type="button"
                  className="ref-footer-link"
                  onClick={() => {
                    setAuthMode('login');
                    setLoginError('');
                    setRegisterSuccess('');
                  }}
                >
                  Log In
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    );
  }

  // 3. Main Mental Wellness Platform Interface
  return (
    <div className="app-platform-layout">
      {/* Minimal Header */}
      <header className="header-modern">
        <div className="header-brand-group">
          <button
            className="sidebar-toggle-btn"
            title="Toggle Wellness Sidebar"
            onClick={() => setIsSidebarOpen((prev) => !prev)}
          >
            ☰
          </button>
          <span style={{ fontSize: '24px' }}>😊</span>
          <div className="brand-text-container">
            <span className="brand-title-text">HEALIO</span>
            <span className="brand-subtitle-text">AI Mental Wellness Companion</span>
          </div>
        </div>

        <div className="header-user-actions">
          <div className="user-profile-badge">
            👤 <strong>{currentUser}</strong>
          </div>
        </div>
      </header>

      {/* Main Body */}
      <div className="main-body-container">
        {/* Collapsible Wellness Sidebar with Clear Chat & Logout at Bottom */}
        <aside className={`wellness-sidebar ${isSidebarOpen ? '' : 'collapsed'}`}>
          {/* Single AI-Detected Current Mood Display */}
          <div className="sidebar-box single-mood-box">
            <h4>Current Mood</h4>
            <div className="single-mood-display">
              <span className="single-mood-emoji" title={`Bot Detected: ${detectedEmotionLabel}`}>{selectedMood}</span>
              <div className="mood-meta">
                <span className="mood-status-label">Bot Detected</span>
                <strong className="mood-emotion-name">{detectedEmotionLabel}</strong>
              </div>
            </div>
          </div>

          {/* Guided Breathing Tool Launcher */}
          <div className="guided-breathing-card" onClick={() => setShowBreathingModal(true)}>
            <span className="b-icon">🫁</span>
            <div>
              <h5>Guided Breathing</h5>
              <p>2-minute relaxation exercise</p>
            </div>
          </div>

          {/* Quick Affirmation Box */}
          <div className="sidebar-box">
            <h4>Daily Affirmation</h4>
            <p style={{ fontSize: '12px', color: '#c7d2fe', lineHeight: '1.5', fontStyle: 'italic' }}>
              "{dailyAffirmation}"
            </p>
          </div>

          {/* Emergency Support Notice */}
          <div className="emergency-support-box">
            <h5>Immediate Support</h5>
            <p>If you are in crisis, call <strong>988</strong> (Lifeline) or reach out to a professional counselor.</p>
          </div>

          {/* Moved Clear Chat & Logout Buttons to Sidebar Bottom */}
          <div className="sidebar-bottom-actions">
            <button className="btn-sidebar-action" onClick={handleClearChat}>
              🗑️ Clear Chat History
            </button>
            <button className="btn-sidebar-action logout" onClick={handleLogout}>
              🚪 Logout
            </button>
          </div>
        </aside>

        {/* Chat Area */}
        <main className="chat-main-area">
          <div className="messages-scroll-feed">
            {messages.length === 0 ? (
              <div className="welcome-experience-container">
                <div className="greeting-header">
                  <h2>{getGreeting()}, {currentUser}</h2>
                  <p>How are you feeling today? I'm here to listen without judgment. Take your time.</p>
                </div>

                <div className="affirmation-banner">
                  ✨ "{dailyAffirmation}"
                </div>

                <div className="large-suggestion-grid">
                  <div
                    className="suggestion-card-large"
                    onClick={() => handleSendText("I've been feeling anxious today.")}
                  >
                    <span className="card-icon">🧘</span>
                    <span>I've been feeling anxious today</span>
                  </div>
                  <div
                    className="suggestion-card-large"
                    onClick={() => handleSendText("Help me relax and calm my mind.")}
                  >
                    <span className="card-icon">🌊</span>
                    <span>Help me relax</span>
                  </div>
                  <div
                    className="suggestion-card-large"
                    onClick={() => handleSendText("I can't sleep and my mind is racing.")}
                  >
                    <span className="card-icon">🌙</span>
                    <span>I can't sleep</span>
                  </div>
                  <div
                    className="suggestion-card-large"
                    onClick={() => handleSendText("I feel overwhelmed with everything right now.")}
                  >
                    <span className="card-icon">🌿</span>
                    <span>I feel overwhelmed</span>
                  </div>
                  <div
                    className="suggestion-card-large"
                    onClick={() => handleSendText("I had a good day and want to reflect on it!")}
                  >
                    <span className="card-icon">☀️</span>
                    <span>I had a good day</span>
                  </div>
                  <div
                    className="suggestion-card-large"
                    onClick={() => setShowBreathingModal(true)}
                  >
                    <span className="card-icon">🫁</span>
                    <span>Recommend breathing exercises</span>
                  </div>
                </div>
              </div>
            ) : (
              messages.map((msg, idx) => (
                <div key={msg.id || idx} className={`msg-wrapper-container ${msg.type === 'user' ? 'user' : 'bot'}`}>
                  {/* Multi-select Checkbox */}
                  {isSelectMode && (
                    <input
                      type="checkbox"
                      className="msg-checkbox"
                      checked={selectedMsgIds.has(msg.id)}
                      onChange={() => handleCheckboxToggle(msg.id)}
                    />
                  )}

                  <div className="msg-avatar">
                    {msg.type === 'user' ? '👤' : '😊'}
                  </div>

                  <div className={`msg-bubble ${msg.type === 'user' ? 'bubble-user' : 'bubble-bot'}`}>
                    {msg.type === 'bot' && (
                      <div className="msg-bot-header">HEALIO AI</div>
                    )}

                    <div className="msg-content">
                      {msg.type === 'bot' && msg.isNew ? (
                        <TypewriterText text={msg.text} speed={12} />
                      ) : (
                        msg.text
                      )}
                    </div>
                  </div>

                  {/* 3-Dots Hover Action Menu Button */}
                  <button
                    type="button"
                    className={`btn-msg-dots ${openDropdownId === msg.id ? 'active' : ''}`}
                    title="Message Options"
                    onClick={() => setOpenDropdownId((prev) => (prev === msg.id ? null : msg.id))}
                  >
                    ⋮
                  </button>

                  {/* 3-Dots Dropdown Popup */}
                  {openDropdownId === msg.id && (
                    <div className="msg-options-dropdown">
                      <button
                        type="button"
                        className="dropdown-item-btn"
                        onClick={() => handleReadAloud(msg)}
                      >
                        🔊 <span>Read Aloud</span>
                      </button>
                      <button
                        type="button"
                        className="dropdown-item-btn delete"
                        onClick={() => handleDeleteSingleMessage(msg.id, msg.turnIndex ?? Math.floor(idx / 2))}
                      >
                        🗑️ <span>Delete Message</span>
                      </button>
                      <button
                        type="button"
                        className="dropdown-item-btn"
                        onClick={() => handleToggleSelectMode(msg.id)}
                      >
                        ☑️ <span>Select</span>
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}

            {isLoading && (
              <div className="msg-wrapper-container bot">
                <div className="msg-avatar">😊</div>
                <div className="msg-bubble bubble-bot">
                  <div className="msg-bot-header">HEALIO AI</div>
                  <span style={{ color: '#94a3b8', fontStyle: 'italic' }}>Thinking & listening...</span>
                </div>
              </div>
            )}

            {/* Bulk Delete Floating Bar */}
            {isSelectMode && (
              <div className="bulk-delete-bar">
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#ffffff' }}>
                  {selectedMsgIds.size} message(s) selected
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn-bulk-delete" onClick={handleBulkDelete} disabled={selectedMsgIds.size === 0}>
                    🗑️ Delete Selected
                  </button>
                  <button className="btn-nav-outline" onClick={() => { setIsSelectMode(false); setSelectedMsgIds(new Set()); }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Floating Input Capsule & Attachment Popup Bar */}
          <div className="floating-input-panel">
            {(audioFile || videoFile) && (
              <div className="media-preview-bar">
                {audioFile && (
                  <div className="media-tag">
                    🎵 Audio: {audioFile.name}
                    <button onClick={() => setAudioFile(null)}>✕</button>
                  </div>
                )}
                {videoFile && (
                  <div className="media-tag">
                    📹 Video: {videoFile.name}
                    <button onClick={() => setVideoFile(null)}>✕</button>
                  </div>
                )}
              </div>
            )}

            <div className="input-capsule-bar">
              <div className="paperclip-container" ref={paperclipMenuRef}>
                <button
                  type="button"
                  className={`btn-paperclip ${showPaperclipMenu ? 'active' : ''}`}
                  title="Attach Media Files"
                  onClick={() => setShowPaperclipMenu((prev) => !prev)}
                  disabled={isLoading || isRecordingAudio}
                >
                  📎
                </button>

                {showPaperclipMenu && (
                  <div className="paperclip-popup-menu">
                    <button
                      type="button"
                      className="popup-option-btn"
                      onClick={() => {
                        setShowPaperclipMenu(false);
                        audioInputFileRef.current?.click();
                      }}
                    >
                      <span>🎵</span>
                      <span>Upload Audio File</span>
                    </button>
                    <button
                      type="button"
                      className="popup-option-btn"
                      onClick={() => {
                        setShowPaperclipMenu(false);
                        videoInputFileRef.current?.click();
                      }}
                    >
                      <span>🎬</span>
                      <span>Upload Video File</span>
                    </button>
                  </div>
                )}
              </div>

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
                      ➔
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <textarea
                    className="textarea-auto-expand"
                    rows="1"
                    placeholder="Tell me what's on your mind..."
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

                  <div className="right-action-group">
                    <button
                      type="button"
                      className="btn-media-icon"
                      title="Record Webcam Video"
                      onClick={openVideoModal}
                      disabled={isLoading}
                    >
                      📷
                    </button>

                    <button
                      type="button"
                      className="btn-media-icon"
                      title="Record Voice Audio"
                      onClick={startAudioRecording}
                      disabled={isLoading}
                    >
                      🎙️
                    </button>

                    <button
                      type="button"
                      className="btn-send-circular"
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
        </main>
      </div>

      {/* Guided Breathing Exercise Modal */}
      {showBreathingModal && (
        <div className="breathing-modal-overlay">
          <div className="breathing-card">
            <h3>🫁 Guided Breathing Session</h3>
            <p style={{ fontSize: '13px', color: '#94a3b8', marginTop: '6px' }}>Focus on your breath and relax your body.</p>
            
            <div className="breathing-circle-wrapper">
              <span style={{ fontSize: '16px', fontWeight: '700', color: '#ffffff' }}>{breathingText}</span>
            </div>

            <button className="btn-primary-purple" style={{ width: 'auto', padding: '10px 28px' }} onClick={() => setShowBreathingModal(false)}>
              Complete Session
            </button>
          </div>
        </div>
      )}

      {/* Video Recorder Modal */}
      {showVideoModal && (
        <div className="breathing-modal-overlay">
          <div className="breathing-card" style={{ maxWidth: '480px' }}>
            <h3>📹 Record Video Message</h3>
            <video ref={videoRef} autoPlay muted style={{ width: '100%', height: '260px', borderRadius: '12px', background: '#000', margin: '15px 0', objectFit: 'cover' }} />
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              {!isRecordingVideo ? (
                <button className="btn-primary-purple" style={{ width: 'auto' }} onClick={startVideoRecording}>
                  🔴 Start Recording
                </button>
              ) : (
                <button className="btn-primary-purple" style={{ width: 'auto', background: '#ef4444' }} onClick={stopVideoRecording}>
                  ⏹️ Stop & Send
                </button>
              )}
              <button className="btn-nav-outline" onClick={closeVideoModal}>
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