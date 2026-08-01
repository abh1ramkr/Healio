import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { 
  Menu, Sparkles, Search, Bell, ChevronRight, ChevronDown, 
  Wind, Quote, Heart, Paperclip, Image, Mic, Send, 
  Trash2, Volume2, CheckSquare, LogOut, MoreVertical,
  Sun, Moon, Smile, MessageCircle, User, BookOpen, Wrench, Settings, AlertTriangle
} from 'lucide-react';

// Dynamic Time-based Greeting Helper
function getGreeting() {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'Good Morning';
  if (hour >= 12 && hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

// Daily Affirmation Quotes
const AFFIRMATIONS = [
  "You are enough just as you are. Take things one step at a time.",
  "Breathe deeply. You are safe, supported, and heard.",
  "Your feelings are valid. Take all the time you need.",
  "Be gentle with yourself today. You are doing your best.",
  "Peace begins with a single conscious breath."
];

// Map detected emotion text to clean emotion label
function mapEmotionToMoodLabel(emotionsText) {
  if (!emotionsText) return 'Calm';
  const lower = emotionsText.toLowerCase();
  
  if (lower.includes('joy') || lower.includes('amusement') || lower.includes('excitement') || 
      lower.includes('optimism') || lower.includes('gratitude') || lower.includes('love') || lower.includes('admiration')) {
    return 'Happy';
  }
  if (lower.includes('caring') || lower.includes('approval') || lower.includes('curiosity') || lower.includes('relief')) {
    return 'Calm';
  }
  if (lower.includes('sadness') || lower.includes('grief') || lower.includes('disappointment') || lower.includes('remorse')) {
    return 'Disappointment';
  }
  if (lower.includes('fear') || lower.includes('nervousness') || lower.includes('anger') || 
      lower.includes('annoyance') || lower.includes('disgust') || lower.includes('embarrassment')) {
    return 'Anxious';
  }
  return 'Thoughtful';
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
  const [detectedEmotionLabel, setDetectedEmotionLabel] = useState('Calm');
  const [dailyAffirmation] = useState(() => AFFIRMATIONS[Math.floor(Math.random() * AFFIRMATIONS.length)]);
  const [showBreathingModal, setShowBreathingModal] = useState(false);
  const [breathingText, setBreathingText] = useState('Inhale slowly...');

  // Modal & Dropdown Confirmation States
  const [showClearModal, setShowClearModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  // Chat & Message States
  const [messages, setMessages] = useState([]);
  const [textInput, setTextInput] = useState('');
  const [audioFile, setAudioFile] = useState(null);
  const [videoFile, setVideoFile] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  // Attachment Popup & Recording States
  const [showUploadPopup, setShowUploadPopup] = useState(false);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);

  // Hover Action Menu & Selection States
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [selectedMsgIds, setSelectedMsgIds] = useState(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);

  // Refs for media elements
  const textareaRef = useRef(null);
  const audioInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  // Auto-splash screen timer
  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 1400);
    return () => clearTimeout(timer);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (!e.target.closest('.msg-options-dropdown') && !e.target.closest('.btn-msg-dots')) {
        setOpenDropdownId(null);
      }
      if (!e.target.closest('.paperclip-popup-menu') && !e.target.closest('.btn-paperclip')) {
        setShowUploadPopup(false);
      }
      if (!e.target.closest('.user-dropdown-menu') && !e.target.closest('.user-profile-badge')) {
        setShowUserDropdown(false);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, []);

  // Guided breathing exercise timer loop
  useEffect(() => {
    let breathingInterval;
    if (showBreathingModal) {
      let step = 0;
      setBreathingText('Inhale slowly (4s)...');
      breathingInterval = setInterval(() => {
        step = (step + 1) % 3;
        if (step === 0) setBreathingText('Inhale slowly (4s)...');
        else if (step === 1) setBreathingText('Hold breath gently (7s)...');
        else if (step === 2) setBreathingText('Exhale completely (8s)...');
      }, 4000);
    }
    return () => clearInterval(breathingInterval);
  }, [showBreathingModal]);

  // Auto-fetch user chat history from database
  const fetchHistory = async (userToFetch) => {
    if (!userToFetch) return;
    try {
      const res = await fetch(`/history?username=${encodeURIComponent(userToFetch)}`);
      const data = await res.json();
      if (res.ok && data.history && Array.isArray(data.history)) {
        const formattedMsgs = [];
        data.history.forEach((turn, idx) => {
          const uText = turn[0];
          const eText = turn[1];
          const bText = turn[2];
          const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          if (uText) {
            formattedMsgs.push({
              id: `hist_u_${idx}`,
              type: 'user',
              text: uText,
              timestamp: nowStr,
              isNew: false
            });
          }
          if (bText) {
            formattedMsgs.push({
              id: `hist_b_${idx}`,
              type: 'bot',
              text: bText,
              emotions: eText,
              timestamp: nowStr,
              turnIndex: idx,
              isNew: false
            });
          }
        });
        setMessages(formattedMsgs);
        if (data.history.length > 0) {
          const lastTurn = data.history[data.history.length - 1];
          if (lastTurn[1]) {
            setDetectedEmotionLabel(mapEmotionToMoodLabel(lastTurn[1]));
          }
        }
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
        setRegisterSuccess('Account created! You can now sign in.');
        setAuthMode('login');
        setPassword('');
        setConfirmPassword('');
      } else {
        setLoginError(data.detail || 'Registration failed. Try another username.');
      }
    } catch (error) {
      setLoginError('Connection error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmLogout = () => {
    setShowLogoutModal(false);
    setShowUserDropdown(false);
    setLoggedIn(false);
    setCurrentUser('');
    setMessages([]);
    setPassword('');
    setConfirmPassword('');
    setLoginError('');
    setRegisterSuccess('');
  };

  const confirmClearChat = async () => {
    setShowClearModal(false);
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
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsgId = `user_${Date.now()}_${Math.random()}`;
    const userMsg = { id: userMsgId, type: 'user', text: userText, timestamp: timeStr, isNew: false };

    // 1. Optimistic Update: Append user message IMMEDIATELY to UI
    setMessages((prev) => [...prev, userMsg]);
    setTextInput('');
    setAudioFile(null);
    setVideoFile(null);
    setIsLoading(true);

    formData.append('username', currentUser || 'default');

    try {
      const res = await fetch(endpoint, { method: 'POST', body: formData });
      const data = await res.json();
      
      // 2. Auto-detect emotion and update current mood in sidebar automatically
      if (data.emotions) {
        setDetectedEmotionLabel(mapEmotionToMoodLabel(data.emotions));
      }

      // 3. Append Bot Message
      const botMsgId = `bot_${Date.now()}_${Math.random()}`;
      const botMsg = {
        id: botMsgId,
        type: 'bot',
        text: data.response,
        emotions: data.emotions,
        timestamp: timeStr,
        audio: data.audio_base64 ? `data:audio/mp3;base64,${data.audio_base64}` : null,
        isNew: true, // triggers typewriter text animation
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (error) {
      console.error('API Error:', error);
      setMessages((prev) => [
        ...prev,
        { id: `err_${Date.now()}`, type: 'bot', text: 'I encountered an issue. Please try again.', timestamp: timeStr, isNew: true },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendText = (textToSend) => {
    const query = textToSend || textInput;
    if (!query.trim()) return;
    const formData = new FormData();
    formData.append('text_input', query);
    sendRequest('/chat', formData, query.trim());
  };

  const handleAudioUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('audio_file', file);
    sendRequest('/voice', formData, `🎙️ Audio Note (${file.name})`);
    setShowUploadPopup(false);
  };

  const handleVideoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('video_file', file);
    sendRequest('/video', formData, `📹 Video Note (${file.name})`);
    setShowUploadPopup(false);
  };

  // Audio Recording (Microphone)
  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        const formData = new FormData();
        formData.append('audio_file', audioBlob, 'mic_recording.wav');
        await sendRequest('/voice', formData, '🎙️ Voice Message');
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecordingAudio(true);
    } catch (err) {
      alert('Microphone access denied or unavailable.');
    }
  };

  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && isRecordingAudio) {
      mediaRecorderRef.current.stop();
      setIsRecordingAudio(false);
    }
  };

  // --- Message Action Handlers (Read Aloud, Delete, Select) ---
  const handleReadAloud = (msg) => {
    setOpenDropdownId(null);
    if (msg.audio) {
      const audioObj = new Audio(msg.audio);
      audioObj.play().catch((err) => console.error('Audio playback error:', err));
    } else if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(msg.text);
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    } else {
      alert('Speech synthesis unavailable in your browser.');
    }
  };

  const handleDeleteSingleMessage = async (msgId, turnIndex) => {
    setOpenDropdownId(null);
    setMessages((prev) => prev.filter((m) => m.id !== msgId));
    if (turnIndex !== undefined && turnIndex !== null) {
      try {
        const formData = new FormData();
        formData.append('username', currentUser);
        formData.append('index', turnIndex);
        await fetch('/delete_message', { method: 'POST', body: formData });
      } catch (err) {
        console.error('Error deleting from backend database:', err);
      }
    }
  };

  const handleToggleSelectMode = (msgId) => {
    setOpenDropdownId(null);
    setIsSelectMode(true);
    setSelectedMsgIds((prev) => new Set(prev).add(msgId));
  };

  const handleCheckboxToggle = (msgId) => {
    setSelectedMsgIds((prev) => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId);
      else next.add(msgId);
      if (next.size === 0) setIsSelectMode(false);
      return next;
    });
  };

  const handleDeleteSelectedMessages = () => {
    setMessages((prev) => prev.filter((m) => !selectedMsgIds.has(m.id)));
    setSelectedMsgIds(new Set());
    setIsSelectMode(false);
  };

  // 1. Splash Screen
  if (showSplash) {
    return (
      <div className="splash-screen-container">
        <div className="splash-logo-badge">
          <Sparkles size={36} color="#ffffff" />
        </div>
        <h1 className="splash-title">HEALIO</h1>
        <p className="splash-subtitle">AI Mental Wellness Companion</p>
        <div className="spinner-ring"></div>
      </div>
    );
  }

  // 2. Premium Glassmorphism Authentication Screen
  if (!loggedIn) {
    return (
      <div className="login-screen-wrapper">
        {/* Abstract Soft Organic Gradient Blobs Canvas Background */}
        <div className="login-bg-canvas">
          <div className="gradient-blob blob-bottom-left"></div>
          <div className="gradient-blob blob-top-right"></div>
          <div className="gradient-blob blob-center-soft"></div>
        </div>

        {/* Floating Frosted Glass Login Card */}
        <div className="login-glass-card">
          {/* Header & Branding */}
          <div className="glass-card-header">
            <div className="healio-logo-badge">
              <Sparkles size={26} color="#6C63FF" />
            </div>
            <h1 className="healio-brand-title">HEALIO</h1>
            <p className="healio-brand-subtitle">AI Mental Wellness Companion</p>

            <div className="welcome-headline-box">
              <h2>{authMode === 'login' ? 'Welcome Back' : 'Begin Your Journey'}</h2>
              <p>
                {authMode === 'login'
                  ? 'Continue your wellness journey with your trusted AI companion.'
                  : 'Create your private, confidential space for emotional wellbeing.'}
              </p>
            </div>
          </div>

          {/* Error / Success Notifications */}
          {registerSuccess && <div className="glass-alert success">{registerSuccess}</div>}
          {loginError && <div className="glass-alert error">{loginError}</div>}

          {/* Form */}
          {authMode === 'login' ? (
            <form onSubmit={handleLogin} className="glass-form">
              <div className="glass-input-group">
                <label>Username</label>
                <div className="input-wrapper">
                  <span className="input-icon"><User size={16} /></span>
                  <input
                    type="text"
                    className="glass-input"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="glass-input-group">
                <label>Password</label>
                <div className="input-wrapper">
                  <span className="input-icon">🔒</span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="glass-input"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="btn-toggle-password"
                    onClick={() => setShowPassword((prev) => !prev)}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <div className="form-secondary-actions">
                <label className="checkbox-container">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                  />
                  <span className="custom-checkmark"></span>
                  <span className="checkbox-label">Remember Me</span>
                </label>
                <a
                  href="#forgot"
                  className="forgot-link"
                  onClick={(e) => {
                    e.preventDefault();
                    alert('Demo Account Credentials:\nUsername: admin\nPassword: password');
                  }}
                >
                  Forgot Password?
                </a>
              </div>

              <button type="submit" className="btn-glass-primary" disabled={isSubmitting}>
                {isSubmitting ? 'Signing In...' : 'Sign In'}
              </button>

              <div className="auth-toggle-footer">
                Don't have an account?{' '}
                <button
                  type="button"
                  className="auth-link-button"
                  onClick={() => {
                    setAuthMode('register');
                    setLoginError('');
                    setRegisterSuccess('');
                  }}
                >
                  Register
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="glass-form">
              <div className="glass-input-group">
                <label>Username</label>
                <div className="input-wrapper">
                  <span className="input-icon"><User size={16} /></span>
                  <input
                    type="text"
                    className="glass-input"
                    placeholder="Choose a username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="glass-input-group">
                <label>Password</label>
                <div className="input-wrapper">
                  <span className="input-icon">🔒</span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="glass-input"
                    placeholder="Create a password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="btn-toggle-password"
                    onClick={() => setShowPassword((prev) => !prev)}
                    title={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>

              <div className="glass-input-group">
                <label>Confirm Password</label>
                <div className="input-wrapper">
                  <span className="input-icon">🔒</span>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    className="glass-input"
                    placeholder="Re-enter your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              </div>

              <button type="submit" className="btn-glass-primary" disabled={isSubmitting}>
                {isSubmitting ? 'Creating Account...' : 'Create Account'}
              </button>

              <div className="auth-toggle-footer">
                Already have an account?{' '}
                <button
                  type="button"
                  className="auth-link-button"
                  onClick={() => {
                    setAuthMode('login');
                    setLoginError('');
                    setRegisterSuccess('');
                  }}
                >
                  Sign In
                </button>
              </div>
            </form>
          )}

          <div className="demo-credentials-badge">
            💡 Demo Account: <strong>admin</strong> / <strong>password</strong>
          </div>
        </div>
      </div>
    );
  }

  // 3. Main Mental Wellness Platform Interface (Refined Premium Design System)
  return (
    <div className="app-platform-layout">
      {/* Hidden File Inputs for Audio/Video Upload */}
      <input
        type="file"
        ref={audioInputRef}
        accept="audio/*"
        style={{ display: 'none' }}
        onChange={handleAudioUpload}
      />
      <input
        type="file"
        ref={videoInputRef}
        accept="video/*"
        style={{ display: 'none' }}
        onChange={handleVideoUpload}
      />

      {/* Abstract Soft Organic Canvas Background */}
      <div className="platform-bg-canvas">
        <div className="gradient-blob blob-bottom-left"></div>
        <div className="gradient-blob blob-top-right"></div>
        <div className="gradient-blob blob-center-soft"></div>
      </div>

      {/* Floating Top Header Bar */}
      <header className="header-modern-floating">
        <div className="header-brand-group">
          <button
            className="sidebar-toggle-btn"
            title="Toggle Wellness Sidebar"
            onClick={() => setIsSidebarOpen((prev) => !prev)}
          >
            <Menu size={18} />
          </button>
          <div className="brand-logo-icon">
            <Sparkles size={20} className="sparkle-svg-icon" />
          </div>
          <div className="brand-text-container">
            <span className="brand-title-text">HEALIO</span>
            <span className="brand-subtitle-text">AI Mental Wellness Companion</span>
          </div>
        </div>

        <div className="header-user-actions">
          <button className="glass-icon-btn" title="Search">
            <Search size={16} />
          </button>

          <button className="glass-icon-btn" title="Notifications">
            <Bell size={16} />
          </button>

          <div className="user-profile-wrapper">
            <div
              className="user-profile-badge"
              onClick={() => setShowUserDropdown((prev) => !prev)}
            >
              <div className="user-avatar-circle">
                {currentUser ? currentUser.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="user-info-text">
                <span className="user-name-label">{currentUser}</span>
                <span className="user-plan-label">Premium</span>
              </div>
              <ChevronDown size={14} className={`user-dropdown-arrow ${showUserDropdown ? 'active' : ''}`} />
            </div>

            {showUserDropdown && (
              <div className="user-dropdown-menu">
                <div className="user-dropdown-header">
                  <span className="dropdown-user-name">{currentUser}</span>
                  <span className="dropdown-user-status">● Active Member</span>
                </div>
                <div className="dropdown-divider"></div>
                <button
                  type="button"
                  className="user-dropdown-item logout"
                  onClick={() => {
                    setShowUserDropdown(false);
                    setShowLogoutModal(true);
                  }}
                >
                  <LogOut size={16} />
                  <span>Log Out</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main Body Layout */}
      <div className="main-body-container">
        {/* Floating Wellness Sidebar */}
        <aside className={`wellness-sidebar ${isSidebarOpen ? '' : 'collapsed'}`}>
          <div className="sidebar-section-title">WELLNESS OVERVIEW</div>

          {/* Current Mood Card */}
          <div className="sidebar-box mood-card-floating">
            <div className="mood-orb-wrapper">
              <div className="ambient-mood-orb"></div>
            </div>
            <div className="mood-card-info">
              <span className="card-mini-label">Current Mood</span>
              <strong className="card-main-title">{detectedEmotionLabel || 'Calm'}</strong>
              <span className="card-timestamp">Last updated • Just now</span>
            </div>
          </div>

          {/* Guided Breathing Tool Launcher */}
          <div className="sidebar-interactive-card" onClick={() => setShowBreathingModal(true)}>
            <div className="card-icon-circle green">
              <Wind size={18} />
            </div>
            <div className="card-text-body">
              <h5>Guided Breathing</h5>
              <p>2-min relaxation exercise</p>
            </div>
            <ChevronRight size={16} className="card-arrow" />
          </div>

          {/* Daily Affirmation Card */}
          <div className="sidebar-interactive-card static-quote">
            <div className="card-icon-circle purple">
              <Quote size={18} />
            </div>
            <div className="card-text-body">
              <h5>Daily Affirmation</h5>
              <p className="quote-text-body">"{dailyAffirmation}"</p>
            </div>
          </div>

          {/* Immediate Support Card */}
          <div className="sidebar-interactive-card crisis-support">
            <div className="card-icon-circle pink">
              <Heart size={18} />
            </div>
            <div className="card-text-body">
              <h5>Immediate Support</h5>
              <p>If you are in crisis, call 988 (Lifeline) or reach out to a professional.</p>
            </div>
            <ChevronRight size={16} className="card-arrow" />
          </div>

          {/* Navigation Items */}
          <div className="sidebar-nav-group">
            <div className="nav-item">
              <MessageCircle size={16} />
              <span>Chat History</span>
              <ChevronRight size={14} className="item-arrow" />
            </div>

            {/* Clear Chat History Option in Side Menu Bar */}
            <div className="nav-item clear-chat-nav-item" onClick={() => setShowClearModal(true)}>
              <Trash2 size={16} />
              <span>Clear Chat History</span>
              <ChevronRight size={14} className="item-arrow" />
            </div>

            <div className="nav-item">
              <BookOpen size={16} />
              <span>Journal</span>
              <ChevronRight size={14} className="item-arrow" />
            </div>
            <div className="nav-item">
              <Wrench size={16} />
              <span>Tools</span>
              <ChevronRight size={14} className="item-arrow" />
            </div>
            <div className="nav-item">
              <Settings size={16} />
              <span>Settings</span>
              <ChevronRight size={14} className="item-arrow" />
            </div>
          </div>

          {/* Logout Action at Bottom */}
          <div className="sidebar-bottom-action-container">
            <button className="nav-item logout-btn" onClick={() => setShowLogoutModal(true)}>
              <LogOut size={16} />
              <span>Logout</span>
              <ChevronRight size={14} className="item-arrow" />
            </button>
          </div>
        </aside>

        {/* Main Workspace Glass Container */}
        <main className="chat-main-area">
          <div className="workspace-glass-card">
            {/* Header Greeting Banner */}
            <div className="chat-welcome-banner">
              <h2>
                {getGreeting()}, <span className="highlight-username">{currentUser}</span> ✨
              </h2>
              <h3>How are you feeling today?</h3>
              <p>I'm here to listen, support, and help you feel better.</p>
            </div>

            {/* Horizontal Suggestion Pill Cards */}
            <div className="suggestion-pills-row">
              <button
                className="suggestion-pill-card"
                onClick={() => handleSendText("I feel overwhelmed with everything right now.")}
              >
                <div className="pill-icon-circle rose">
                  <Heart size={16} />
                </div>
                <div className="pill-text-content">
                  <span className="pill-title">I feel overwhelmed</span>
                  <span className="pill-desc">Help me manage stress</span>
                </div>
              </button>

              <button
                className="suggestion-pill-card"
                onClick={() => handleSendText("I can't sleep and my thoughts are racing.")}
              >
                <div className="pill-icon-circle lavender">
                  <Moon size={16} />
                </div>
                <div className="pill-text-content">
                  <span className="pill-title">I can't sleep</span>
                  <span className="pill-desc">Improve my sleep</span>
                </div>
              </button>

              <button
                className="suggestion-pill-card"
                onClick={() => handleSendText("Help me relax and calm my mind.")}
              >
                <div className="pill-icon-circle green">
                  <Wind size={16} />
                </div>
                <div className="pill-text-content">
                  <span className="pill-title">Help me relax</span>
                  <span className="pill-desc">Calm my mind</span>
                </div>
              </button>

              <button
                className="suggestion-pill-card"
                onClick={() => handleSendText("I feel happy and had a good day!")}
              >
                <div className="pill-icon-circle amber">
                  <Sun size={16} />
                </div>
                <div className="pill-text-content">
                  <span className="pill-title">I feel happy</span>
                  <span className="pill-desc">Share my joy</span>
                </div>
              </button>

              <button
                className="suggestion-pill-card"
                onClick={() => handleSendText("Just need to talk to someone right now.")}
              >
                <div className="pill-icon-circle pink">
                  <Smile size={16} />
                </div>
                <div className="pill-text-content">
                  <span className="pill-title">Just need to talk</span>
                  <span className="pill-desc">I'm here for you</span>
                </div>
              </button>
            </div>

            {/* Messages Stream */}
            <div className="messages-scroll-feed">
              {messages.map((msg, idx) => (
                <div key={msg.id || idx} className={`msg-wrapper-container ${msg.type === 'user' ? 'user' : 'bot'}`}>
                  {isSelectMode && (
                    <input
                      type="checkbox"
                      className="msg-checkbox"
                      checked={selectedMsgIds.has(msg.id)}
                      onChange={() => handleCheckboxToggle(msg.id)}
                    />
                  )}

                  {msg.type === 'bot' && (
                    <div className="msg-avatar bot-sparkle-avatar">
                      <Sparkles size={16} />
                    </div>
                  )}

                  <div className={`msg-bubble ${msg.type === 'user' ? 'bubble-user' : 'bubble-bot'}`}>
                    <div className="msg-content">
                      {msg.type === 'bot' && msg.isNew ? (
                        <TypewriterText text={msg.text} speed={12} />
                      ) : (
                        msg.text
                      )}
                    </div>
                    <div className="msg-time-stamp">
                      {msg.timestamp || '10:24 AM'} {msg.type === 'user' && '✓✓'}
                    </div>
                  </div>

                  {msg.type === 'user' && (
                    <div className="msg-avatar user-icon-avatar">
                      <User size={16} />
                    </div>
                  )}

                  {/* 3-Dots Action Button */}
                  <button
                    type="button"
                    className={`btn-msg-dots ${openDropdownId === msg.id ? 'active' : ''}`}
                    title="Message Options"
                    onClick={() => setOpenDropdownId((prev) => (prev === msg.id ? null : msg.id))}
                  >
                    <MoreVertical size={16} />
                  </button>

                  {/* Options Menu */}
                  {openDropdownId === msg.id && (
                    <div className="msg-options-dropdown">
                      <button
                        type="button"
                        className="dropdown-item-btn"
                        onClick={() => handleReadAloud(msg)}
                      >
                        <Volume2 size={15} /> <span>Read Aloud</span>
                      </button>
                      <button
                        type="button"
                        className="dropdown-item-btn delete"
                        onClick={() => handleDeleteSingleMessage(msg.id, msg.turnIndex ?? Math.floor(idx / 2))}
                      >
                        <Trash2 size={15} /> <span>Delete Message</span>
                      </button>
                      <button
                        type="button"
                        className="dropdown-item-btn"
                        onClick={() => handleToggleSelectMode(msg.id)}
                      >
                        <CheckSquare size={15} /> <span>Select</span>
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="msg-wrapper-container bot">
                  <div className="msg-avatar bot-sparkle-avatar">
                    <Sparkles size={16} />
                  </div>
                  <div className="msg-bubble bubble-bot">
                    <span style={{ color: '#64748b', fontStyle: 'italic' }}>Thinking & listening...</span>
                  </div>
                </div>
              )}

              {/* Bulk Delete Bar */}
              {isSelectMode && (
                <div className="bulk-delete-bar">
                  <span>{selectedMsgIds.size} message(s) selected</span>
                  <button className="btn-bulk-delete" onClick={handleDeleteSelectedMessages}>
                    <Trash2 size={15} /> Delete Selected
                  </button>
                </div>
              )}
            </div>

            {/* Bottom Floating Input Capsule */}
            <div className="input-capsule-bar">
              <button
                className={`btn-paperclip ${showUploadPopup ? 'active' : ''}`}
                title="Upload Media"
                onClick={() => setShowUploadPopup((prev) => !prev)}
              >
                <Paperclip size={18} />
              </button>

              {/* Paperclip Upload Popup */}
              {showUploadPopup && (
                <div className="paperclip-popup-menu">
                  <button className="popup-item-btn" onClick={() => audioInputRef.current?.click()}>
                    <Mic size={16} />
                    <span>Upload Audio</span>
                  </button>
                  <button className="popup-item-btn" onClick={() => videoInputRef.current?.click()}>
                    <Image size={16} />
                    <span>Upload Video</span>
                  </button>
                </div>
              )}

              <textarea
                ref={textareaRef}
                className="textarea-auto-expand"
                placeholder="Tell me what's on your mind..."
                value={textInput}
                rows={1}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (textInput.trim()) {
                      handleSendText(textInput);
                    }
                  }
                }}
              />

              <div className="right-action-group">
                <button
                  type="button"
                  className="btn-media-icon"
                  title="Photo / Video Attachment"
                  onClick={() => videoInputRef.current?.click()}
                >
                  <Image size={18} />
                </button>

                <button
                  type="button"
                  className={`btn-media-icon ${isRecordingAudio ? 'recording' : ''}`}
                  title="Voice Recording"
                  onClick={isRecordingAudio ? stopAudioRecording : startAudioRecording}
                >
                  <Mic size={18} />
                </button>

                <button
                  type="button"
                  className="btn-send-circular"
                  disabled={!textInput.trim() && !isRecordingAudio}
                  onClick={() => {
                    if (textInput.trim()) {
                      handleSendText(textInput);
                    }
                  }}
                >
                  <Send size={16} />
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Guided Breathing Exercise Modal */}
      {showBreathingModal && (
        <div className="breathing-modal-overlay" onClick={() => setShowBreathingModal(false)}>
          <div className="breathing-card" onClick={(e) => e.stopPropagation()}>
            <h3>Guided Breathing Exercise</h3>
            <p className="modal-desc">Follow the relaxing circle animation to calm your mind.</p>
            <div className="breathing-circle-wrapper">
              <div className="breathing-circle-pulse"></div>
            </div>
            <h4 className="breathing-instruction">{breathingText}</h4>
            <button className="btn-glass-primary" onClick={() => setShowBreathingModal(false)}>
              Done / Close
            </button>
          </div>
        </div>
      )}

      {/* Clear Chat History Warning Modal */}
      {showClearModal && (
        <div className="warning-modal-overlay" onClick={() => setShowClearModal(false)}>
          <div className="warning-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="warning-icon-wrapper danger">
              <AlertTriangle size={28} />
            </div>
            <h3>Clear Chat History?</h3>
            <p className="modal-desc">
              Are you sure you want to clear your chat history? This will permanently delete all messages from your database.
            </p>
            <div className="modal-actions-group">
              <button
                type="button"
                className="btn-modal-cancel"
                onClick={() => setShowClearModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-modal-confirm danger"
                onClick={confirmClearChat}
              >
                Yes, Clear
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Logout Warning Modal */}
      {showLogoutModal && (
        <div className="warning-modal-overlay" onClick={() => setShowLogoutModal(false)}>
          <div className="warning-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="warning-icon-wrapper purple">
              <LogOut size={28} />
            </div>
            <h3>Log Out of HEALIO?</h3>
            <p className="modal-desc">
              Are you sure you want to log out of your session? Your wellness data will remain securely saved.
            </p>
            <div className="modal-actions-group">
              <button
                type="button"
                className="btn-modal-cancel"
                onClick={() => setShowLogoutModal(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-modal-confirm purple"
                onClick={confirmLogout}
              >
                Yes, Log Out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;