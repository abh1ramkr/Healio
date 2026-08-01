import React, { useState, useEffect, useRef } from 'react';
import './App.css';
import { 
  Menu, Sparkles, Search, Bell, ChevronRight, ChevronDown, ArrowLeft,
  Wind, Quote, Heart, Paperclip, Image, Mic, Send, 
  Trash2, Volume2, CheckSquare, LogOut, MoreVertical,
  Sun, Moon, Smile, MessageCircle, User, BookOpen, Wrench, Settings, AlertTriangle,
  Edit3, Plus, Play, Download, Check, VolumeX, Frown, AlertCircle, Info, Lock, Eye, EyeOff
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

// Web Audio Ambient Synthesizer for Relaxation Sounds (Zero external dependencies)
class AmbientAudioSynth {
  constructor() {
    this.ctx = null;
    this.whiteNoise = null;
    this.filter = null;
    this.gainNode = null;
    this.isPlaying = false;
    this.currentSound = null;
  }

  init() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  play(soundType) {
    try {
      this.init();
      this.stop();

      const bufferSize = 2 * this.ctx.sampleRate;
      const noiseBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);

      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      this.whiteNoise = this.ctx.createBufferSource();
      this.whiteNoise.buffer = noiseBuffer;
      this.whiteNoise.loop = true;

      this.filter = this.ctx.createBiquadFilter();

      if (soundType === 'rain') {
        this.filter.type = 'lowpass';
        this.filter.frequency.setValueAtTime(1000, this.ctx.currentTime);
      } else if (soundType === 'ocean') {
        this.filter.type = 'bandpass';
        this.filter.frequency.setValueAtTime(400, this.ctx.currentTime);
        this.filter.Q.setValueAtTime(1.0, this.ctx.currentTime);
      } else if (soundType === 'forest') {
        this.filter.type = 'highpass';
        this.filter.frequency.setValueAtTime(800, this.ctx.currentTime);
      } else {
        // White Noise
        this.filter.type = 'lowpass';
        this.filter.frequency.setValueAtTime(2500, this.ctx.currentTime);
      }

      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.setValueAtTime(0.12, this.ctx.currentTime);

      this.whiteNoise.connect(this.filter);
      this.filter.connect(this.gainNode);
      this.gainNode.connect(this.ctx.destination);

      this.whiteNoise.start();
      this.isPlaying = true;
      this.currentSound = soundType;
    } catch (e) {
      console.error('Audio synth error:', e);
    }
  }

  stop() {
    if (this.whiteNoise) {
      try { this.whiteNoise.stop(); } catch (e) {}
      try { this.whiteNoise.disconnect(); } catch (e) {}
      this.whiteNoise = null;
    }
    this.isPlaying = false;
    this.currentSound = null;
  }
}

const ambientSynth = new AmbientAudioSynth();

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

  // Active Core Module State: null (Chat) | 'chat_history' | 'journal' | 'wellness_tools' | 'settings'
  const [activeModule, setActiveModule] = useState(null);

  // Platform UI & Sidebar States
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [detectedEmotionLabel, setDetectedEmotionLabel] = useState('Calm');
  const [dailyAffirmation] = useState(() => AFFIRMATIONS[Math.floor(Math.random() * AFFIRMATIONS.length)]);

  // Modal & Warning States
  const [showClearModal, setShowClearModal] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  // Chat & Session States
  const [messages, setMessages] = useState([]);
  const [textInput, setTextInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionsList, setSessionsList] = useState([]);
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [sessionSearchQuery, setSessionSearchQuery] = useState('');
  const [editingSessionId, setEditingSessionId] = useState(null);
  const [editingTitleText, setEditingTitleText] = useState('');

  // Journal Module States
  const [journalEntries, setJournalEntries] = useState([]);
  const [journalSearchQuery, setJournalSearchQuery] = useState('');
  const [showJournalFormModal, setShowJournalFormModal] = useState(false);
  const [journalForm, setJournalForm] = useState({ id: null, title: '', content: '', mood: 'Calm' });
  const [journalReflections, setJournalReflections] = useState({});
  const [isReflectingId, setIsReflectingId] = useState(null);

  // Wellness Tools Module States
  const [activeWellnessTool, setActiveWellnessTool] = useState(null); // 'breathing' | 'grounding' | 'mood_checkin' | 'daily_tip' | 'relaxation_sounds'
  const [breathingDuration, setBreathingDuration] = useState(2);
  const [breathingText, setBreathingText] = useState('Inhale slowly (4s)...');
  const [activeSound, setActiveSound] = useState(null);
  const [dailyTip, setDailyTip] = useState("Take a five-minute walk without your phone today to refresh your mind.");
  
  // 5-4-3-2-1 Grounding Exercise State
  const [groundingStep, setGroundingStep] = useState(0);
  const [groundingInputs, setGroundingInputs] = useState({ 5: '', 4: '', 3: '', 2: '', 1: '' });

  // Settings Module States
  const [userSettings, setUserSettings] = useState({
    theme: 'light',
    font_size: 'medium',
    ai_tone: 'Supportive',
    daily_reminder: 0,
    mood_reminder: 0,
    journal_reminder: 0
  });
  const [settingsSavedMessage, setSettingsSavedMessage] = useState('');

  // Attachment Popup & Recording States
  const [showUploadPopup, setShowUploadPopup] = useState(false);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);

  // Hover Action Menu & Selection States
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [selectedMsgIds, setSelectedMsgIds] = useState(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);

  // Media Refs
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

  // Guided Breathing Animation Timer Loop
  useEffect(() => {
    let breathingInterval;
    if (activeWellnessTool === 'breathing') {
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
  }, [activeWellnessTool]);

  // Fetch all user persistent data on login
  useEffect(() => {
    if (loggedIn && currentUser) {
      fetchUserSessions(currentUser);
      fetchUserJournal(currentUser);
      fetchUserSettings(currentUser);
      fetchLatestMood(currentUser);
      fetchDailyTip();
    }
  }, [loggedIn, currentUser]);

  // API Persistence Helpers
  const fetchUserSessions = async (user) => {
    try {
      const res = await fetch(`/sessions?username=${encodeURIComponent(user)}`);
      const data = await res.json();
      if (res.ok && data.sessions) {
        setSessionsList(data.sessions);
      }
    } catch (err) {
      console.error('Error fetching sessions:', err);
    }
  };

  const loadSessionMessages = async (sessionId) => {
    try {
      setIsLoading(true);
      const res = await fetch(`/session_messages?session_id=${encodeURIComponent(sessionId)}&username=${encodeURIComponent(currentUser)}`);
      const data = await res.json();
      if (res.ok && data.messages) {
        setMessages(data.messages);
        setActiveSessionId(sessionId);
        setActiveModule(null);
      }
    } catch (err) {
      console.error('Error loading session messages:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartNewChat = () => {
    setActiveSessionId(null);
    setMessages([]);
    setActiveModule(null);
  };

  const handleRenameSession = async (sessionId) => {
    if (!editingTitleText.trim()) return;
    try {
      const formData = new FormData();
      formData.append('session_id', sessionId);
      formData.append('title', editingTitleText.trim());
      await fetch('/rename_session', { method: 'POST', body: formData });
      setEditingSessionId(null);
      fetchUserSessions(currentUser);
    } catch (err) {
      console.error('Error renaming session:', err);
    }
  };

  const handleDeleteSession = async (sessionId) => {
    try {
      const formData = new FormData();
      formData.append('session_id', sessionId);
      formData.append('username', currentUser);
      await fetch('/delete_session', { method: 'POST', body: formData });
      if (activeSessionId === sessionId) {
        handleStartNewChat();
      }
      fetchUserSessions(currentUser);
    } catch (err) {
      console.error('Error deleting session:', err);
    }
  };

  const fetchUserJournal = async (user) => {
    try {
      const res = await fetch(`/journal/list?username=${encodeURIComponent(user)}`);
      const data = await res.json();
      if (res.ok && data.entries) {
        setJournalEntries(data.entries);
      }
    } catch (err) {
      console.error('Error fetching journal:', err);
    }
  };

  const handleSaveJournalEntry = async (e) => {
    e.preventDefault();
    if (!journalForm.title.trim() || !journalForm.content.trim()) return;

    const formData = new FormData();
    formData.append('username', currentUser);
    formData.append('title', journalForm.title.trim());
    formData.append('content', journalForm.content.trim());
    if (journalForm.mood) formData.append('mood', journalForm.mood);

    try {
      if (journalForm.id) {
        formData.append('id', journalForm.id);
        await fetch('/journal/update', { method: 'POST', body: formData });
      } else {
        await fetch('/journal/create', { method: 'POST', body: formData });
      }
      setShowJournalFormModal(false);
      setJournalForm({ id: null, title: '', content: '', mood: 'Calm' });
      fetchUserJournal(currentUser);
    } catch (err) {
      console.error('Error saving journal:', err);
    }
  };

  const handleDeleteJournalEntry = async (entryId) => {
    try {
      const formData = new FormData();
      formData.append('id', entryId);
      formData.append('username', currentUser);
      await fetch('/journal/delete', { method: 'POST', body: formData });
      fetchUserJournal(currentUser);
    } catch (err) {
      console.error('Error deleting journal entry:', err);
    }
  };

  const handleReflectJournalEntry = async (entry) => {
    setIsReflectingId(entry.id);
    try {
      const formData = new FormData();
      formData.append('content', entry.content);
      if (entry.mood) formData.append('mood', entry.mood);
      const res = await fetch('/journal/reflect', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok && data.reflection) {
        setJournalReflections((prev) => ({ ...prev, [entry.id]: data.reflection }));
      }
    } catch (err) {
      console.error('Error getting reflection:', err);
    } finally {
      setIsReflectingId(null);
    }
  };

  const fetchLatestMood = async (user) => {
    try {
      const res = await fetch(`/latest_mood?username=${encodeURIComponent(user)}`);
      const data = await res.json();
      if (res.ok && data.log) {
        setDetectedEmotionLabel(data.log.mood_label);
      }
    } catch (err) {
      console.error('Error fetching mood:', err);
    }
  };

  const handleMoodCheckin = async (label) => {
    setDetectedEmotionLabel(label);
    try {
      const formData = new FormData();
      formData.append('username', currentUser);
      formData.append('mood_emoji', label);
      formData.append('mood_label', label);
      await fetch('/mood_checkin', { method: 'POST', body: formData });
      setActiveWellnessTool(null);
    } catch (err) {
      console.error('Error logging mood checkin:', err);
    }
  };

  const fetchDailyTip = async () => {
    try {
      const res = await fetch('/daily_tip');
      const data = await res.json();
      if (res.ok && data.tip) {
        setDailyTip(data.tip);
      }
    } catch (err) {
      console.error('Error fetching daily tip:', err);
    }
  };

  const fetchUserSettings = async (user) => {
    try {
      const res = await fetch(`/settings?username=${encodeURIComponent(user)}`);
      const data = await res.json();
      if (res.ok && data.settings) {
        setUserSettings(data.settings);
      }
    } catch (err) {
      console.error('Error fetching settings:', err);
    }
  };

  const handleSaveSettings = async (newSettings) => {
    const updated = { ...userSettings, ...newSettings };
    setUserSettings(updated);
    try {
      const formData = new FormData();
      formData.append('username', currentUser);
      formData.append('theme', updated.theme);
      formData.append('font_size', updated.font_size);
      formData.append('ai_tone', updated.ai_tone);
      formData.append('daily_reminder', updated.daily_reminder ? 1 : 0);
      formData.append('mood_reminder', updated.mood_reminder ? 1 : 0);
      formData.append('journal_reminder', updated.journal_reminder ? 1 : 0);

      await fetch('/settings/update', { method: 'POST', body: formData });
      setSettingsSavedMessage('Settings saved successfully!');
      setTimeout(() => setSettingsSavedMessage(''), 2500);
    } catch (err) {
      console.error('Error saving settings:', err);
    }
  };

  const handleExportData = async () => {
    try {
      const formData = new FormData();
      formData.append('username', currentUser);
      const res = await fetch('/export_data', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok && data.data) {
        const jsonStr = JSON.stringify(data.data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `HEALIO_Backup_${currentUser}_${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      console.error('Error exporting data:', err);
    }
  };

  const handleClearAllData = async () => {
    try {
      const formData = new FormData();
      formData.append('username', currentUser);
      await fetch('/delete_all_data', { method: 'POST', body: formData });
      setMessages([]);
      setJournalEntries([]);
      setSessionsList([]);
      setShowClearModal(false);
      alert('All your application data has been cleared.');
    } catch (err) {
      console.error('Error clearing all data:', err);
    }
  };

  // Auth Handlers
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
    setActiveModule(null);
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
    fetchUserSessions(currentUser);
  };

  const sendRequest = async (endpoint, formData, userText) => {
    const timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userMsgId = `user_${Date.now()}_${Math.random()}`;
    const userMsg = { id: userMsgId, type: 'user', text: userText, timestamp: timeStr, isNew: false };

    setMessages((prev) => [...prev, userMsg]);
    setTextInput('');
    setIsLoading(true);

    formData.append('username', currentUser || 'default');
    if (activeSessionId) {
      formData.append('session_id', activeSessionId);
    }

    try {
      const res = await fetch(endpoint, { method: 'POST', body: formData });
      const data = await res.json();
      
      if (data.session_id && data.session_id !== activeSessionId) {
        setActiveSessionId(data.session_id);
      }

      if (data.emotions) {
        setDetectedEmotionLabel(mapEmotionToMoodLabel(data.emotions));
      }

      const botMsgId = `bot_${Date.now()}_${Math.random()}`;
      const botMsg = {
        id: botMsgId,
        type: 'bot',
        text: data.response,
        emotions: data.emotions,
        timestamp: timeStr,
        audio: data.audio_base64 ? `data:audio/mp3;base64,${data.audio_base64}` : null,
        isNew: true,
      };

      setMessages((prev) => [...prev, botMsg]);
      fetchUserSessions(currentUser);
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
    sendRequest('/voice', formData, `Audio Note (${file.name})`);
    setShowUploadPopup(false);
  };

  const handleVideoUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('video_file', file);
    sendRequest('/video', formData, `Video Note (${file.name})`);
    setShowUploadPopup(false);
  };

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
        await sendRequest('/voice', formData, 'Voice Message');
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
        <div className="login-bg-canvas">
          <div className="gradient-blob blob-bottom-left"></div>
          <div className="gradient-blob blob-top-right"></div>
          <div className="gradient-blob blob-center-soft"></div>
        </div>

        <div className="login-glass-card">
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

          {registerSuccess && <div className="glass-alert success">{registerSuccess}</div>}
          {loginError && <div className="glass-alert error">{loginError}</div>}

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
                  <span className="input-icon"><Lock size={16} /></span>
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
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
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
                  <span className="input-icon"><Lock size={16} /></span>
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
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="glass-input-group">
                <label>Confirm Password</label>
                <div className="input-wrapper">
                  <span className="input-icon"><Lock size={16} /></span>
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
            <Info size={14} className="info-icon" /> Demo Account: <strong>admin</strong> / <strong>password</strong>
          </div>
        </div>
      </div>
    );
  }

  // 3. Main Mental Wellness Platform Interface
  return (
    <div className={`app-platform-layout theme-${userSettings.theme} font-${userSettings.font_size}`}>
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
          <div className="brand-logo-icon" onClick={() => setActiveModule(null)} style={{ cursor: 'pointer' }}>
            <Sparkles size={20} className="sparkle-svg-icon" />
          </div>
          <div className="brand-text-container" onClick={() => setActiveModule(null)} style={{ cursor: 'pointer' }}>
            <span className="brand-title-text">HEALIO</span>
            <span className="brand-subtitle-text">AI Mental Wellness Companion</span>
          </div>
        </div>

        <div className="header-user-actions">
          <button className="glass-icon-btn" title="Search" onClick={() => setActiveModule('chat_history')}>
            <Search size={16} />
          </button>

          <button className="glass-icon-btn" title="Notifications" onClick={() => setActiveModule('settings')}>
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
                  className="user-dropdown-item"
                  onClick={() => {
                    setShowUserDropdown(false);
                    setActiveModule('settings');
                  }}
                >
                  <Settings size={15} />
                  <span>Settings</span>
                </button>
                <button
                  type="button"
                  className="user-dropdown-item logout"
                  onClick={() => {
                    setShowUserDropdown(false);
                    setShowLogoutModal(true);
                  }}
                >
                  <LogOut size={15} />
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

          {/* Current Mood Card with Outline Icon */}
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

          {/* Guided Breathing Launcher */}
          <div className="sidebar-interactive-card" onClick={() => { setActiveModule('wellness_tools'); setActiveWellnessTool('breathing'); }}>
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
              <p>If in crisis, call <strong>988</strong> (Lifeline) or reach a counselor.</p>
            </div>
            <ChevronRight size={16} className="card-arrow" />
          </div>

          {/* Navigation Items (4 Core Modules) */}
          <div className="sidebar-nav-group">
            <div
              className={`nav-item ${activeModule === 'chat_history' ? 'active' : ''}`}
              onClick={() => setActiveModule('chat_history')}
            >
              <MessageCircle size={16} />
              <span>Chat History</span>
              <ChevronRight size={14} className="item-arrow" />
            </div>

            <div
              className={`nav-item ${activeModule === 'journal' ? 'active' : ''}`}
              onClick={() => setActiveModule('journal')}
            >
              <BookOpen size={16} />
              <span>Journal</span>
              <ChevronRight size={14} className="item-arrow" />
            </div>

            <div
              className={`nav-item ${activeModule === 'wellness_tools' ? 'active' : ''}`}
              onClick={() => setActiveModule('wellness_tools')}
            >
              <Wrench size={16} />
              <span>Wellness Tools</span>
              <ChevronRight size={14} className="item-arrow" />
            </div>

            <div
              className={`nav-item ${activeModule === 'settings' ? 'active' : ''}`}
              onClick={() => setActiveModule('settings')}
            >
              <Settings size={16} />
              <span>Settings</span>
              <ChevronRight size={14} className="item-arrow" />
            </div>

            <div className="nav-item clear-chat-nav-item" onClick={() => setShowClearModal(true)}>
              <Trash2 size={16} />
              <span>Clear Chat History</span>
              <ChevronRight size={14} className="item-arrow" />
            </div>
          </div>

          <div className="sidebar-bottom-action-container">
            <button className="nav-item logout-btn" onClick={() => setShowLogoutModal(true)}>
              <LogOut size={16} />
              <span>Logout</span>
              <ChevronRight size={14} className="item-arrow" />
            </button>
          </div>
        </aside>

        {/* Workspace Content Router */}
        <main className="chat-main-area">
          <div className="workspace-glass-card">
            
            {/* MODULE 1: CHAT HISTORY DRAWER */}
            {activeModule === 'chat_history' && (
              <div className="module-view-container animate-fade-in">
                <div className="module-header-bar">
                  <button className="btn-glass-back" onClick={() => setActiveModule(null)} title="Back to Chat">
                    <ArrowLeft size={16} />
                    <span>Back to Chat</span>
                  </button>
                  <div className="module-title-group">
                    <MessageCircle size={22} className="module-icon purple" />
                    <div>
                      <h2>Chat History</h2>
                      <p>Revisit and continue your previous conversations with HEALIO</p>
                    </div>
                  </div>
                  <button className="btn-glass-action" onClick={handleStartNewChat}>
                    <Plus size={16} /> <span>New Chat</span>
                  </button>
                </div>

                <div className="module-search-box">
                  <Search size={16} className="search-icon" />
                  <input
                    type="text"
                    placeholder="Search past conversations..."
                    value={sessionSearchQuery}
                    onChange={(e) => setSessionSearchQuery(e.target.value)}
                  />
                </div>

                <div className="sessions-scroll-list">
                  {sessionsList.length === 0 ? (
                    <div className="empty-state-box">
                      <MessageCircle size={40} className="empty-icon" />
                      <h4>No conversations yet</h4>
                      <p>Start a new chat to begin speaking with HEALIO.</p>
                      <button className="btn-glass-primary inline" onClick={handleStartNewChat}>
                        Start Chatting
                      </button>
                    </div>
                  ) : (
                    sessionsList
                      .filter((s) => s.title.toLowerCase().includes(sessionSearchQuery.toLowerCase()))
                      .map((session) => (
                        <div
                          key={session.id}
                          className={`session-card-item ${activeSessionId === session.id ? 'active' : ''}`}
                        >
                          <div className="session-card-main" onClick={() => loadSessionMessages(session.id)}>
                            <div className="session-icon-circle">
                              <Sparkles size={16} />
                            </div>
                            <div className="session-info">
                              {editingSessionId === session.id ? (
                                <div className="inline-edit-wrapper" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="text"
                                    value={editingTitleText}
                                    onChange={(e) => setEditingTitleText(e.target.value)}
                                    autoFocus
                                  />
                                  <button onClick={() => handleRenameSession(session.id)}><Check size={14} /></button>
                                </div>
                              ) : (
                                <h4 className="session-title">{session.title}</h4>
                              )}
                              <p className="session-preview">{session.last_message || 'No messages yet'}</p>
                              <span className="session-meta">
                                {session.last_timestamp ? `${session.last_timestamp} • ` : ''}
                                {new Date(session.updated_at * 1000).toLocaleDateString()}
                              </span>
                            </div>
                          </div>

                          <div className="session-actions">
                            <button
                              title="Rename Conversation"
                              onClick={() => {
                                setEditingSessionId(session.id);
                                setEditingTitleText(session.title);
                              }}
                            >
                              <Edit3 size={15} />
                            </button>
                            <button
                              title="Delete Conversation"
                              className="delete"
                              onClick={() => handleDeleteSession(session.id)}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            )}

            {/* MODULE 2: PERSONAL JOURNAL PANEL */}
            {activeModule === 'journal' && (
              <div className="module-view-container animate-fade-in">
                <div className="module-header-bar">
                  <button className="btn-glass-back" onClick={() => setActiveModule(null)} title="Back to Chat">
                    <ArrowLeft size={16} />
                    <span>Back to Chat</span>
                  </button>
                  <div className="module-title-group">
                    <BookOpen size={22} className="module-icon green" />
                    <div>
                      <h2>Personal Wellness Journal</h2>
                      <p>Privately record your thoughts, reflections, and emotional state</p>
                    </div>
                  </div>
                  <button
                    className="btn-glass-action green"
                    onClick={() => {
                      setJournalForm({ id: null, title: '', content: '', mood: 'Calm' });
                      setShowJournalFormModal(true);
                    }}
                  >
                    <Plus size={16} /> <span>New Entry</span>
                  </button>
                </div>

                <div className="module-search-box">
                  <Search size={16} className="search-icon" />
                  <input
                    type="text"
                    placeholder="Search journal entries..."
                    value={journalSearchQuery}
                    onChange={(e) => setJournalSearchQuery(e.target.value)}
                  />
                </div>

                <div className="journal-entries-feed">
                  {journalEntries.length === 0 ? (
                    <div className="empty-state-box">
                      <BookOpen size={40} className="empty-icon" />
                      <h4>Your journal is empty</h4>
                      <p>Writing down your feelings helps clarify thoughts and relieve emotional stress.</p>
                      <button
                        className="btn-glass-primary inline"
                        onClick={() => {
                          setJournalForm({ id: null, title: '', content: '', mood: 'Calm' });
                          setShowJournalFormModal(true);
                        }}
                      >
                        Write First Entry
                      </button>
                    </div>
                  ) : (
                    journalEntries
                      .filter((j) => j.title.toLowerCase().includes(journalSearchQuery.toLowerCase()) || j.content.toLowerCase().includes(journalSearchQuery.toLowerCase()))
                      .map((entry) => (
                        <div key={entry.id} className="journal-entry-card">
                          <div className="journal-card-header">
                            <div className="journal-title-box">
                              {entry.mood && <span className="journal-mood-pill">{entry.mood}</span>}
                              <h3>{entry.title}</h3>
                            </div>
                            <span className="journal-date">{new Date(entry.created_at * 1000).toLocaleDateString()}</span>
                          </div>

                          <p className="journal-content-body">{entry.content}</p>

                          <div className="journal-card-footer">
                            <button
                              className="btn-reflect-ai"
                              disabled={isReflectingId === entry.id}
                              onClick={() => handleReflectJournalEntry(entry)}
                            >
                              <Sparkles size={14} />
                              <span>{isReflectingId === entry.id ? 'Reflecting with HEALIO...' : 'Reflect with HEALIO'}</span>
                            </button>

                            <div className="journal-card-actions">
                              <button
                                onClick={() => {
                                  setJournalForm(entry);
                                  setShowJournalFormModal(true);
                                }}
                              >
                                <Edit3 size={15} />
                              </button>
                              <button className="delete" onClick={() => handleDeleteJournalEntry(entry.id)}>
                                <Trash2 size={15} />
                              </button>
                            </div>
                          </div>

                          {journalReflections[entry.id] && (
                            <div className="ai-reflection-box animate-fade-in">
                              <div className="reflection-header">
                                <Sparkles size={16} className="sparkle-icon" />
                                <strong>HEALIO Reflection & Insights</strong>
                              </div>
                              <p>{journalReflections[entry.id]}</p>
                            </div>
                          )}
                        </div>
                      ))
                  )}
                </div>
              </div>
            )}

            {/* MODULE 3: WELLNESS TOOLS PANEL */}
            {activeModule === 'wellness_tools' && (
              <div className="module-view-container animate-fade-in">
                <div className="module-header-bar">
                  <button className="btn-glass-back" onClick={() => setActiveModule(null)} title="Back to Chat">
                    <ArrowLeft size={16} />
                    <span>Back to Chat</span>
                  </button>
                  <div className="module-title-group">
                    <Wrench size={22} className="module-icon purple" />
                    <div>
                      <h2>Wellness Tools</h2>
                      <p>Quick self-help mindfulness exercises and relaxing soundscapes</p>
                    </div>
                  </div>
                </div>

                <div className="tools-cards-grid">
                  {/* Tool 1: Guided Breathing */}
                  <div className="tool-feature-card" onClick={() => setActiveWellnessTool('breathing')}>
                    <div className="tool-card-icon green">
                      <Wind size={24} />
                    </div>
                    <h3>Guided Breathing</h3>
                    <p>Calm your nervous system with 4-7-8 breathing cycles.</p>
                    <span className="tool-badge">2 / 5 / 10 Min</span>
                  </div>

                  {/* Tool 2: Grounding Exercise */}
                  <div className="tool-feature-card" onClick={() => setActiveWellnessTool('grounding')}>
                    <div className="tool-card-icon purple">
                      <Sparkles size={24} />
                    </div>
                    <h3>5-4-3-2-1 Grounding</h3>
                    <p>Relieve acute anxiety by focusing on sensory awareness.</p>
                    <span className="tool-badge">Guided Step Wizard</span>
                  </div>

                  {/* Tool 3: Mood Check-In */}
                  <div className="tool-feature-card" onClick={() => setActiveWellnessTool('mood_checkin')}>
                    <div className="tool-card-icon amber">
                      <Sun size={24} />
                    </div>
                    <h3>Mood Check-In</h3>
                    <p>Record how you feel right now to track emotional wellbeing.</p>
                    <span className="tool-badge">Instant Log</span>
                  </div>

                  {/* Tool 4: Daily Wellness Tip */}
                  <div className="tool-feature-card" onClick={() => setActiveWellnessTool('daily_tip')}>
                    <div className="tool-card-icon rose">
                      <Heart size={24} />
                    </div>
                    <h3>Daily Wellness Tip</h3>
                    <p>Actionable daily advice for mental health and relaxation.</p>
                    <span className="tool-badge">Refreshed Daily</span>
                  </div>

                  {/* Tool 5: Relaxation Sounds */}
                  <div className="tool-feature-card" onClick={() => setActiveWellnessTool('relaxation_sounds')}>
                    <div className="tool-card-icon blue">
                      <Volume2 size={24} />
                    </div>
                    <h3>Relaxation Sounds</h3>
                    <p>Soothing rain, ocean waves, forest sounds, and white noise.</p>
                    <span className="tool-badge">Ambient Audio</span>
                  </div>
                </div>
              </div>
            )}

            {/* MODULE 4: SETTINGS PANEL */}
            {activeModule === 'settings' && (
              <div className="module-view-container animate-fade-in">
                <div className="module-header-bar">
                  <button className="btn-glass-back" onClick={() => setActiveModule(null)} title="Back to Chat">
                    <ArrowLeft size={16} />
                    <span>Back to Chat</span>
                  </button>
                  <div className="module-title-group">
                    <Settings size={22} className="module-icon slate" />
                    <div>
                      <h2>Settings & Preferences</h2>
                      <p>Manage your account, AI behavior, theme, and privacy preferences</p>
                    </div>
                  </div>
                  {settingsSavedMessage && <span className="settings-saved-pill">{settingsSavedMessage}</span>}
                </div>

                <div className="settings-scroll-body">
                  {/* Account Section */}
                  <div className="settings-group-card">
                    <h3>Account Profile</h3>
                    <div className="settings-profile-row">
                      <div className="large-avatar-circle">{currentUser.charAt(0).toUpperCase()}</div>
                      <div>
                        <h4>{currentUser}</h4>
                        <p>user@{currentUser.toLowerCase()}.healio.app</p>
                        <span className="membership-pill">Premium Member</span>
                      </div>
                    </div>
                  </div>

                  {/* Appearance Section */}
                  <div className="settings-group-card">
                    <h3>Appearance</h3>
                    <div className="setting-control-row">
                      <label>Theme Mode</label>
                      <div className="pill-options-group">
                        {['light', 'dark', 'system'].map((t) => (
                          <button
                            key={t}
                            className={`pill-option ${userSettings.theme === t ? 'active' : ''}`}
                            onClick={() => handleSaveSettings({ theme: t })}
                          >
                            {t.charAt(0).toUpperCase() + t.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="setting-control-row">
                      <label>Font Size</label>
                      <div className="pill-options-group">
                        {['small', 'medium', 'large'].map((s) => (
                          <button
                            key={s}
                            className={`pill-option ${userSettings.font_size === s ? 'active' : ''}`}
                            onClick={() => handleSaveSettings({ font_size: s })}
                          >
                            {s.charAt(0).toUpperCase() + s.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* AI Preferences Section */}
                  <div className="settings-group-card">
                    <h3>AI Companion Tone</h3>
                    <div className="pill-options-group full-width">
                      {['Supportive', 'Friendly', 'Professional', 'Motivational'].map((tone) => (
                        <button
                          key={tone}
                          className={`pill-option ${userSettings.ai_tone === tone ? 'active' : ''}`}
                          onClick={() => handleSaveSettings({ ai_tone: tone })}
                        >
                          {tone}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Privacy & Danger Zone */}
                  <div className="settings-group-card danger-zone">
                    <h3>Privacy & Data Control</h3>
                    <div className="danger-actions-grid">
                      <button className="btn-glass-action" onClick={handleExportData}>
                        <Download size={16} /> <span>Export All Data (JSON)</span>
                      </button>
                      <button className="btn-glass-action danger" onClick={() => setShowClearModal(true)}>
                        <Trash2 size={16} /> <span>Delete Chat History</span>
                      </button>
                      <button className="btn-glass-action danger" onClick={() => setShowClearModal(true)}>
                        <Trash2 size={16} /> <span>Delete Journal Entries</span>
                      </button>
                      <button className="btn-glass-action danger" onClick={handleClearAllData}>
                        <AlertTriangle size={16} /> <span>Clear All Application Data</span>
                      </button>
                    </div>
                  </div>

                  {/* Notifications Readiness Toggles */}
                  <div className="settings-group-card">
                    <h3>Notification Reminders (Future-Ready)</h3>
                    <div className="setting-toggle-row">
                      <span>Daily Wellness Check Reminder</span>
                      <input
                        type="checkbox"
                        checked={!!userSettings.daily_reminder}
                        onChange={(e) => handleSaveSettings({ daily_reminder: e.target.checked ? 1 : 0 })}
                      />
                    </div>
                    <div className="setting-toggle-row">
                      <span>Mood Check-In Reminder</span>
                      <input
                        type="checkbox"
                        checked={!!userSettings.mood_reminder}
                        onChange={(e) => handleSaveSettings({ mood_reminder: e.target.checked ? 1 : 0 })}
                      />
                    </div>
                    <div className="setting-toggle-row">
                      <span>Journal Reflection Reminder</span>
                      <input
                        type="checkbox"
                        checked={!!userSettings.journal_reminder}
                        onChange={(e) => handleSaveSettings({ journal_reminder: e.target.checked ? 1 : 0 })}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* DEFAULT CHAT WORKSPACE VIEW */}
            {!activeModule && (
              <>
                <div className="welcome-unified-wrapper">
                  <div className="chat-welcome-banner">
                    <h2>
                      {getGreeting()}, <span className="highlight-username">{currentUser}</span>
                    </h2>
                    <h3>How are you feeling today?</h3>
                    <p>I'm here to listen, support, and help you feel better.</p>
                  </div>

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

                      <button
                        type="button"
                        className={`btn-msg-dots ${openDropdownId === msg.id ? 'active' : ''}`}
                        title="Message Options"
                        onClick={() => setOpenDropdownId((prev) => (prev === msg.id ? null : msg.id))}
                      >
                        <MoreVertical size={16} />
                      </button>

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
              </>
            )}

          </div>
        </main>
      </div>

      {/* JOURNAL NEW / EDIT FORM MODAL */}
      {showJournalFormModal && (
        <div className="warning-modal-overlay" onClick={() => setShowJournalFormModal(false)}>
          <div className="journal-modal-card" onClick={(e) => e.stopPropagation()}>
            <h3>{journalForm.id ? 'Edit Journal Entry' : 'New Journal Entry'}</h3>
            <form onSubmit={handleSaveJournalEntry} className="journal-form">
              <div className="glass-input-group">
                <label>Title</label>
                <input
                  type="text"
                  className="glass-input"
                  placeholder="E.g., Reflection after work..."
                  value={journalForm.title}
                  onChange={(e) => setJournalForm({ ...journalForm, title: e.target.value })}
                  required
                />
              </div>

              <div className="glass-input-group">
                <label>Optional Mood</label>
                <div className="pill-options-group">
                  {['Happy', 'Sad', 'Anxious', 'Calm', 'Tired'].map((m) => (
                    <button
                      type="button"
                      key={m}
                      className={`pill-option ${journalForm.mood === m ? 'active' : ''}`}
                      onClick={() => setJournalForm({ ...journalForm, mood: m })}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div className="glass-input-group">
                <label>Private Reflections & Thoughts</label>
                <textarea
                  className="glass-textarea"
                  placeholder="Write your honest thoughts here..."
                  rows={5}
                  value={journalForm.content}
                  onChange={(e) => setJournalForm({ ...journalForm, content: e.target.value })}
                  required
                />
              </div>

              <div className="modal-actions-group">
                <button type="button" className="btn-modal-cancel" onClick={() => setShowJournalFormModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-modal-confirm purple">
                  Save Entry
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WELLNESS TOOLS INTERACTIVE MODALS */}
      {activeWellnessTool && (
        <div className="warning-modal-overlay" onClick={() => { setActiveWellnessTool(null); ambientSynth.stop(); }}>
          <div className="wellness-tool-modal-card" onClick={(e) => e.stopPropagation()}>
            {activeWellnessTool === 'breathing' && (
              <div className="tool-modal-content">
                <h3>Guided Breathing Exercise</h3>
                <p className="modal-desc">Select duration and follow the expanding ring to relax.</p>
                <div className="duration-selector-row">
                  {[2, 5, 10].map((d) => (
                    <button
                      key={d}
                      className={`pill-option ${breathingDuration === d ? 'active' : ''}`}
                      onClick={() => setBreathingDuration(d)}
                    >
                      {d} Minutes
                    </button>
                  ))}
                </div>

                <div className="breathing-circle-wrapper">
                  <div className="breathing-circle-pulse"></div>
                </div>

                <h4 className="breathing-instruction">{breathingText}</h4>
                <button className="btn-glass-primary" onClick={() => setActiveWellnessTool(null)}>
                  Close Exercise
                </button>
              </div>
            )}

            {activeWellnessTool === 'grounding' && (
              <div className="tool-modal-content">
                <h3>5-4-3-2-1 Grounding Technique</h3>
                <p className="modal-desc">Acknowledge your surroundings to anchor yourself in the present.</p>

                <div className="grounding-step-box">
                  <span className="step-count">{5 - groundingStep}</span>
                  <h4>
                    {groundingStep === 0 && "Name 5 things you can SEE around you"}
                    {groundingStep === 1 && "Name 4 things you can TOUCH or feel"}
                    {groundingStep === 2 && "Name 3 things you can HEAR"}
                    {groundingStep === 3 && "Name 2 things you can SMELL"}
                    {groundingStep === 4 && "Name 1 thing you can TASTE"}
                  </h4>
                  <input
                    type="text"
                    className="glass-input"
                    placeholder="Type or reflect on what you notice..."
                    value={groundingInputs[5 - groundingStep] || ''}
                    onChange={(e) => setGroundingInputs({ ...groundingInputs, [5 - groundingStep]: e.target.value })}
                  />
                </div>

                <div className="modal-actions-group">
                  {groundingStep > 0 && (
                    <button className="btn-modal-cancel" onClick={() => setGroundingStep(groundingStep - 1)}>
                      Previous Step
                    </button>
                  )}
                  {groundingStep < 4 ? (
                    <button className="btn-modal-confirm purple" onClick={() => setGroundingStep(groundingStep + 1)}>
                      Next Step ({groundingStep + 1}/5)
                    </button>
                  ) : (
                    <button className="btn-modal-confirm purple" onClick={() => { setGroundingStep(0); setActiveWellnessTool(null); }}>
                      Complete Grounding
                    </button>
                  )}
                </div>
              </div>
            )}

            {activeWellnessTool === 'mood_checkin' && (
              <div className="tool-modal-content">
                <h3>Mood Check-In</h3>
                <p className="modal-desc">How are you feeling right now?</p>

                <div className="mood-checkin-grid">
                  {[
                    { label: 'Happy', icon: <Smile size={24} /> },
                    { label: 'Calm', icon: <Sparkles size={24} /> },
                    { label: 'Sad', icon: <Frown size={24} /> },
                    { label: 'Anxious', icon: <AlertCircle size={24} /> },
                    { label: 'Neutral', icon: <User size={24} /> },
                    { label: 'Tired', icon: <Moon size={24} /> },
                  ].map((item) => (
                    <button
                      key={item.label}
                      className="mood-select-btn"
                      onClick={() => handleMoodCheckin(item.label)}
                    >
                      <div className="icon-circle">{item.icon}</div>
                      <span className="label">{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {activeWellnessTool === 'daily_tip' && (
              <div className="tool-modal-content">
                <Heart size={36} color="#ec4899" style={{ margin: '0 auto 12px auto' }} />
                <h3>Daily Wellness Tip</h3>
                <p className="tip-quote-box">"{dailyTip}"</p>
                <button className="btn-glass-primary" onClick={() => setActiveWellnessTool(null)}>
                  Got It / Close
                </button>
              </div>
            )}

            {activeWellnessTool === 'relaxation_sounds' && (
              <div className="tool-modal-content">
                <Volume2 size={36} color="#6366f1" style={{ margin: '0 auto 12px auto' }} />
                <h3>Relaxation Soundscapes</h3>
                <p className="modal-desc">Tap any ambient sound to play calming background audio.</p>

                <div className="soundscapes-grid">
                  {[
                    { id: 'rain', name: 'Rain', icon: <Wind size={16} /> },
                    { id: 'ocean', name: 'Ocean Waves', icon: <Sparkles size={16} /> },
                    { id: 'forest', name: 'Forest', icon: <BookOpen size={16} /> },
                    { id: 'whitenoise', name: 'White Noise', icon: <Volume2 size={16} /> },
                  ].map((s) => (
                    <button
                      key={s.id}
                      className={`sound-play-btn ${activeSound === s.id ? 'active' : ''}`}
                      onClick={() => {
                        if (activeSound === s.id) {
                          ambientSynth.stop();
                          setActiveSound(null);
                        } else {
                          ambientSynth.play(s.id);
                          setActiveSound(s.id);
                        }
                      }}
                    >
                      <div className="btn-label-group">{s.icon} <span>{s.name}</span></div>
                      {activeSound === s.id ? <VolumeX size={16} /> : <Play size={16} />}
                    </button>
                  ))}
                </div>

                <button
                  className="btn-glass-primary danger"
                  onClick={() => {
                    ambientSynth.stop();
                    setActiveSound(null);
                    setActiveWellnessTool(null);
                  }}
                  style={{ marginTop: '20px' }}
                >
                  Stop Audio & Close
                </button>
              </div>
            )}

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
              <button className="btn-modal-cancel" onClick={() => setShowClearModal(false)}>
                Cancel
              </button>
              <button className="btn-modal-confirm danger" onClick={confirmClearChat}>
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
              <button className="btn-modal-cancel" onClick={() => setShowLogoutModal(false)}>
                Cancel
              </button>
              <button className="btn-modal-confirm purple" onClick={confirmLogout}>
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