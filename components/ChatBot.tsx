import React, { useState, useEffect, useRef, FormEvent } from 'react';
import { decode, decodeAudioData } from '../utils/audio';
import { getFemaleAndSinhalaVoices, DEFAULT_PREBUILT_VOICE_NAMES } from '../utils/voices';
import { Chat, HarmCategory, HarmBlockThreshold } from '@google/genai';
import { getGeminiClient } from '../utils/geminiClient';
import { chatStyleConfigs } from './styles/featureStyleConfig';
import { DescriptionStyle } from './styles/styleConfig';
import { ChatMessage } from '../types';

const CHATBOT_HISTORY_KEY = 'chatbot_sessions';

interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  timestamp: number;
}

const ChatBot: React.FC = () => {
  const [chatStyle, setChatStyle] = useState<DescriptionStyle>('normal');
  const [chat, setChat] = useState<Chat | null>(null);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState<boolean>(true);
  const [voiceType, setVoiceType] = useState<'native' | 'free'>('native');
  const [prebuiltVoice, setPrebuiltVoice] = useState<string>('Zephyr');
  const [useSinhala, setUseSinhala] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState<boolean>(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioPlaybackRef = useRef<{ nextStartTime: number, sources: Set<AudioBufferSourceNode> }>({ nextStartTime: 0, sources: new Set() });
  const [availableVoices, setAvailableVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [voiceFilterSinhala, setVoiceFilterSinhala] = useState<boolean>(false);
  const [selectedVoiceName, setSelectedVoiceName] = useState<string>('');
  const selectedVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastPlayedIndexRef = useRef<number>(-1);
  const isMounted = useRef(false);

  // Load sessions from localStorage
  useEffect(() => {
    // Load available free voices for fallback
    const loadVoices = () => {
      // For ChatBot voice selection, exclude Sinhala voices so 'Nila' and other Sinhala browser voices
      // aren't offered on the Chat voice tab (live conversation uses text-only Sinhala behavior).
      const voices = getFemaleAndSinhalaVoices(voiceFilterSinhala || useSinhala).filter(v => !(v.lang.startsWith('si') || v.name.toLowerCase().includes('sinhala')));
      // When Sinhala is requested prefer Sinhala voices
      const sinhalaVoices = voices.filter(v => v.lang.startsWith('si') || v.name.toLowerCase().includes('sinhala'));
      // Prefer female or high-quality English voices otherwise
      const femaleVoices = voices.filter(v => v.lang.startsWith('en') && (
        v.name.toLowerCase().includes('female') ||
        v.name.toLowerCase().includes('zira') ||
        v.name.toLowerCase().includes('samantha') ||
        v.name.toLowerCase().includes('victoria') ||
        v.name.toLowerCase().includes('karen') ||
        (v.name.toLowerCase().includes('google') && v.name.toLowerCase().includes('female')) ||
        (v.name.toLowerCase().includes('microsoft') && v.name.toLowerCase().includes('female'))
      ));
  const enVoices = (useSinhala && sinhalaVoices.length > 0) ? sinhalaVoices : (femaleVoices.length > 0 ? femaleVoices : voices.filter(v => v.lang.startsWith('en')));
            setAvailableVoices(enVoices);
            if (enVoices.length > 0) {
              if (!selectedVoiceRef.current) selectedVoiceRef.current = enVoices.find(v =>
                v.name.includes('Google') || v.name.includes('Samantha') || v.name.includes('Zira') || v.name.toLowerCase().includes('female')
              ) || enVoices[0];
              setSelectedVoiceName(selectedVoiceRef.current?.name || enVoices[0].name);
            }
  };
  loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    const savedSessions = localStorage.getItem(CHATBOT_HISTORY_KEY);
    if (savedSessions) {
      const parsedSessions = JSON.parse(savedSessions);
      setSessions(parsedSessions);
      if (parsedSessions.length > 0) {
        const latestSession = parsedSessions[0];
        setActiveSessionId(latestSession.id);
        setMessages(latestSession.messages);
      }
    } else {
      // Create initial session
      handleNewSession();
    }
  }, [useSinhala]);

  // Reinitialize Gemini when chat style changes
  useEffect(() => {
    try {
      const ai = getGeminiClient();
      const styleConfig = chatStyleConfigs[chatStyle];
      const systemInstruction = (styleConfig.systemInstruction('') || 'You are a helpful assistant.') + (useSinhala ? ' Respond in Sinhala. If input is not Sinhala, translate the response into Sinhala.' : '');
      const newChat = ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
          systemInstruction,
        },
      });
      setChat(newChat);
    } catch (error) {
      console.error("Failed to reinitialize Gemini for chatStyle change:", error);
    }
  }, [chatStyle, useSinhala]);

  // Initialize Gemini
  useEffect(() => {
    try {
      const ai = getGeminiClient();
      const styleConfig = chatStyleConfigs[chatStyle];
      const systemInstruction = (styleConfig.systemInstruction('') || 'You are a helpful assistant.') + (useSinhala ? ' Respond in Sinhala. If input is not Sinhala, translate the response into Sinhala.' : '');
      const newChat = ai.chats.create({
        model: 'gemini-2.5-flash',
        config: {
          systemInstruction,
        },
      });
      setChat(newChat);
    } catch (error) {
      console.error("Failed to initialize Gemini:", error);
      setMessages([{ role: 'model', text: 'Error: Could not initialize AI model. Please check your API key.' }]);
    }
  }, [useSinhala]);

  // Save active session to localStorage
  useEffect(() => {
    if (isMounted.current && activeSessionId) {
      const updatedSessions = sessions.map(session =>
        session.id === activeSessionId
          ? { ...session, messages, timestamp: Date.now() }
          : session
      );
      setSessions(updatedSessions);
      localStorage.setItem(CHATBOT_HISTORY_KEY, JSON.stringify(updatedSessions));
    } else {
      isMounted.current = true;
    }
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  // Play model responses using TTS when voice enabled
  useEffect(() => {
    const lastIndex = messages.length - 1;
    if (lastIndex <= lastPlayedIndexRef.current) return;
    const lastMsg = messages[lastIndex];
    if (!lastMsg) return;
  if (lastMsg.role === 'model' && !isLoading && lastMsg.text?.trim()) {
      // Kick off TTS
      lastPlayedIndexRef.current = lastIndex;
      generateAndPlayAudio(lastMsg.text);
    }
  }, [messages, isLoading]);

  const handleNewSession = () => {
    const newSession: ChatSession = {
      id: `session-${Date.now()}`,
      title: `Chat ${sessions.length + 1}`,
      messages: [{ role: 'model', text: 'Hello! How can I help you today?' }],
      timestamp: Date.now(),
    };
    const updatedSessions = [newSession, ...sessions];
    setSessions(updatedSessions);
    setActiveSessionId(newSession.id);
    setMessages(newSession.messages);
    localStorage.setItem(CHATBOT_HISTORY_KEY, JSON.stringify(updatedSessions));
  };

  const handleSelectSession = (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setActiveSessionId(session.id);
      setMessages(session.messages);
    }
  };

  const handleDeleteSession = (sessionId: string) => {
    const updatedSessions = sessions.filter(s => s.id !== sessionId);
    setSessions(updatedSessions);
    localStorage.setItem(CHATBOT_HISTORY_KEY, JSON.stringify(updatedSessions));
    
    if (activeSessionId === sessionId) {
      if (updatedSessions.length > 0) {
        setActiveSessionId(updatedSessions[0].id);
        setMessages(updatedSessions[0].messages);
      } else {
        handleNewSession();
      }
    }
  };

  const handleSend = async (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading || !chat) return;

    const userMessage: ChatMessage = { role: 'user', text: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const result = await chat.sendMessageStream({ message: input });
      
  let modelResponse = '';
      setMessages((prev) => [...prev, { role: 'model', text: '' }]);

      for await (const chunk of result) {
        modelResponse += chunk.text;
        setMessages((prev) => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1].text = modelResponse;
          return newMessages;
        });
      }
    } catch (error) {
      console.error('Gemini API error:', error);
      const errorMessage: ChatMessage = { role: 'model', text: 'Sorry, something went wrong. Please try again.' };
      setMessages((prev) => [...prev.slice(0, -1), errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const stopReading = () => {
    audioPlaybackRef.current.sources.forEach((s) => s.stop());
    audioPlaybackRef.current.sources.clear();
    audioPlaybackRef.current.nextStartTime = 0;
    window.speechSynthesis.cancel();
    setIsPlaying(false);
  };

  const generateAndPlayAudio = async (text: string) => {
    if (!isVoiceEnabled || !text || !text.trim()) return;
    setIsPlaying(true);

    // Helper: retry function with backoff
    const retryWithBackoff = async <T,>(fn: () => Promise<T>, retries = 2, delay = 800): Promise<T> => {
      try {
        return await fn();
      } catch (err) {
        if (retries <= 0) throw err;
        await new Promise(r => setTimeout(r, delay));
        return retryWithBackoff(fn, retries - 1, Math.min(delay * 2, 5000));
      }
    };

    // Native Gemini voice via TTS
    if (voiceType === 'native') {
      try {
        if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
        }
        audioContextRef.current.resume();

  const ai = getGeminiClient();
  const styleConfig = chatStyleConfigs[chatStyle];
  const systemInstruction = (styleConfig.systemInstruction('') || 'You are a helpful assistant.') + (useSinhala ? ' Respond in Sinhala. Translate to Sinhala if user language is not Sinhala.' : '');
  const voiceToUse = prebuiltVoice; // Use default prebuilt voice (female) even if Sinhala is requested
  const response = await retryWithBackoff(() => ai.models.generateContent({
          model: 'gemini-2.5-flash-preview-tts',
          contents: [{ parts: [{ text }] }],
            config: {
              responseModalities: ['AUDIO'],
              systemInstruction,
              speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceToUse } } }
          }
  }));

        const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (!audioData || !audioContextRef.current) {
          setIsPlaying(false);
          return;
        }

        const outCtx = audioContextRef.current;
        const audioBuf = await decodeAudioData(decode(audioData), outCtx, 24000, 1);
        audioPlaybackRef.current.nextStartTime = Math.max(audioPlaybackRef.current.nextStartTime, outCtx.currentTime);
        const source = outCtx.createBufferSource();
        source.buffer = audioBuf;
        source.connect(outCtx.destination);
        source.onended = () => {
          audioPlaybackRef.current.sources.delete(source);
          if (audioPlaybackRef.current.sources.size === 0) {
            setIsPlaying(false);
          }
        };
        source.start(audioPlaybackRef.current.nextStartTime);
        audioPlaybackRef.current.nextStartTime += audioBuf.duration;
        audioPlaybackRef.current.sources.add(source);
      } catch (err) {
        console.error('TTS error:', err);
        // Fallback: If native TTS fails, attempt to use free WebSpeech API
        setIsPlaying(false);
        try {
          // fallback to web speech only if a browser voice is available
          if (availableVoices.length > 0) {
            const utterance = new SpeechSynthesisUtterance(text);
            if (selectedVoiceRef.current) utterance.voice = selectedVoiceRef.current;
            utterance.lang = selectedVoiceRef.current?.lang || (useSinhala ? 'si' : 'en-US');
            utterance.rate = 1.05;
            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(utterance);
          }
        } catch (err2) {
          console.error('WebSpeech fallback failed:', err2);
        }
      }
      return;
    }

    // Fallback free WebSpeech API
    return new Promise<void>((resolve) => {
      try {
  const utterance = new SpeechSynthesisUtterance(text);
  if (selectedVoiceRef.current) utterance.voice = selectedVoiceRef.current;
  // explicitly set the language for clarity (fallback to Sinhala when requested)
  utterance.lang = selectedVoiceRef.current?.lang || (useSinhala ? 'si' : 'en-US');
        utterance.rate = 1.05;
        utterance.onend = () => { setIsPlaying(false); resolve(); };
        utterance.onerror = () => { setIsPlaying(false); resolve(); };
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.error('Speech synthesis failed:', err);
        setIsPlaying(false);
        resolve();
      }
    });
  };

  return (
    <>
    <div className="bg-zinc-50 dark:bg-zinc-950 flex flex-col md:flex-row h-full w-full text-zinc-900 dark:text-zinc-100 font-sans">
      {/* History Sidebar */}
      <div className="hidden md:flex w-64 border-r border-zinc-300 dark:border-zinc-700 flex-col flex-shrink-0 bg-white dark:bg-zinc-900">
        <div className="p-3 border-b border-zinc-300 dark:border-zinc-700">
          <button
            onClick={handleNewSession}
            className="w-full bg-primary-500 hover:bg-primary-600 text-white font-medium py-2 px-3 rounded-lg transition-colors text-sm"
          >
            + New Chat
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {sessions.map(session => (
            <div
              key={session.id}
              onClick={() => handleSelectSession(session.id)}
              className={`p-2.5 mb-1.5 rounded-lg cursor-pointer group flex justify-between items-center transition-colors border ${
                activeSessionId === session.id
                  ? 'bg-secondary-50 dark:bg-secondary-950 border-secondary-500'
                  : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700'
              }`}
            >
              <p className="font-medium truncate text-sm">{session.title}</p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteSession(session.id);
                }}
                className="text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Delete session"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="h-full w-full flex flex-col bg-white dark:bg-zinc-900">
        {/* Header */}
        <div className="px-4 py-3 border-b border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 flex-shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button className="md:hidden" onClick={() => setIsSidebarOpen(true)}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <h2 className="text-lg font-semibold">Gemini Chat</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select value={chatStyle} onChange={(e) => setChatStyle(e.target.value as DescriptionStyle)} className="px-2 py-1 rounded-lg bg-white dark:bg-zinc-800 text-xs border border-zinc-300 dark:border-zinc-700">
                {Object.keys(chatStyleConfigs).map((s) => (
                  <option key={s} value={s}>{chatStyleConfigs[s as DescriptionStyle].name}</option>
                ))}
              </select>
              <div className="flex items-center gap-1 p-1 border border-zinc-300 dark:border-zinc-700 rounded-lg">
                <button onClick={() => setVoiceType('free')} className={`px-2 py-1 text-xs rounded-md ${voiceType === 'free' ? 'bg-green-500 text-white' : ''}`}>Free ♾️</button>
                <button onClick={() => setVoiceType('native')} className={`px-2 py-1 text-xs rounded-md ${voiceType === 'native' ? 'bg-purple-500 text-white' : ''}`}>Premium ⚠️</button>
              </div>
              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={useSinhala} onChange={(e) => setUseSinhala(e.target.checked)} />
                Sinhala
              </label>
              {voiceType === 'free' ? (
                <select value={selectedVoiceName} onChange={(e) => setSelectedVoiceName(e.target.value)} className="text-xs bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-md px-2 py-1">
                  {availableVoices.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
                </select>
              ) : (
                <select value={prebuiltVoice} onChange={(e) => setPrebuiltVoice(e.target.value)} className="text-xs bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-md px-2 py-1">
                  {DEFAULT_PREBUILT_VOICE_NAMES.map(name => <option key={name} value={name}>{name}</option>)}
                </select>
              )}
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 pb-28 md:pb-6">
            <>
              {messages.map((msg, index) => (
                <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-xs md:max-w-md lg:max-w-2xl px-4 py-3 rounded-2xl ${
                      msg.role === 'user'
                        ? 'bg-primary-500 text-white rounded-br-none'
                        : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-bl-none'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <p className="whitespace-pre-wrap flex-1">{msg.text}</p>
                      {msg.role === 'model' && (
                        <div className="flex items-center gap-2">
                          <button title="Replay message" onClick={() => { stopReading(); generateAndPlayAudio(msg.text); }} className="p-1 rounded-md bg-zinc-200 dark:bg-zinc-700 text-xs">Replay</button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-zinc-100 dark:bg-zinc-800 rounded-2xl rounded-bl-none px-4 py-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-pulse"></div>
                      <div className="w-2 h-2 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-pulse delay-75"></div>
                      <div className="w-2 h-2 bg-zinc-400 dark:bg-zinc-500 rounded-full animate-pulse delay-150"></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
        </div>

        {/* Input Area */}

          <div className="md:static fixed bottom-0 left-0 right-0 z-30 p-4 md:p-6 border-t border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900">
            <form onSubmit={handleSend} className="flex items-center gap-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask Gemini anything..."
                className="flex-1 bg-zinc-50 dark:bg-zinc-800 px-4 py-3 rounded-lg border border-zinc-300 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="p-3 text-white bg-primary-500 rounded-lg hover:bg-primary-600 disabled:bg-zinc-400 dark:disabled:bg-zinc-600"
                aria-label="Send message"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
              </svg>
              </button>
            </form>
          </div>
      </div>
    </div>

    {/* Mobile Sidebar Drawer */}
    <div className={`fixed inset-0 z-40 md:hidden ${isSidebarOpen ? '' : 'pointer-events-none'}`}>
        <div className={`absolute inset-0 bg-black bg-opacity-50 transition-opacity ${isSidebarOpen ? 'opacity-100' : 'opacity-0'}`} onClick={() => setIsSidebarOpen(false)} />
        <div className={`absolute left-0 top-0 bottom-0 w-64 bg-white dark:bg-zinc-900 border-r border-zinc-300 dark:border-zinc-700 transform transition-transform ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
          <div className="p-3 border-b border-zinc-300 dark:border-zinc-700">
            <button
              onClick={handleNewSession}
              className="w-full bg-primary-500 hover:bg-primary-600 text-white font-medium py-2 px-3 rounded-lg transition-colors text-sm"
            >
              + New Chat
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {sessions.map(session => (
              <div
                key={session.id}
                onClick={() => {
                  handleSelectSession(session.id);
                  setIsSidebarOpen(false);
                }}
                className={`p-2.5 mb-1.5 rounded-lg cursor-pointer group flex justify-between items-center transition-colors border ${
                  activeSessionId === session.id
                    ? 'bg-secondary-50 dark:bg-secondary-950 border-secondary-500'
                    : 'bg-zinc-50 dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-700'
                }`}
              >
                <p className="font-medium truncate text-sm">{session.title}</p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteSession(session.id);
                  }}
                  className="text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Delete session"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile Settings Drawer */}
      <div className={`fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-zinc-900 border-t border-zinc-300 dark:border-zinc-700 transform transition-transform ${isSettingsOpen ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="p-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold">Settings</h3>
            <button onClick={() => setIsSettingsOpen(false)}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="space-y-4">
            <select value={chatStyle} onChange={(e) => setChatStyle(e.target.value as DescriptionStyle)} className="w-full px-2 py-2 rounded-lg bg-white dark:bg-zinc-800 text-sm border border-zinc-300 dark:border-zinc-700">
              {Object.keys(chatStyleConfigs).map((s) => (
                <option key={s} value={s}>{chatStyleConfigs[s as DescriptionStyle].name}</option>
              ))}
            </select>
            <div className="flex items-center gap-2 p-1 border border-zinc-300 dark:border-zinc-700 rounded-lg">
              <button onClick={() => setVoiceType('free')} className={`w-full px-2 py-2 text-sm rounded-md ${voiceType === 'free' ? 'bg-green-500 text-white' : ''}`}>Free ♾️</button>
              <button onClick={() => setVoiceType('native')} className={`w-full px-2 py-2 text-sm rounded-md ${voiceType === 'native' ? 'bg-purple-500 text-white' : ''}`}>Premium ⚠️</button>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={useSinhala} onChange={(e) => setUseSinhala(e.target.checked)} className="h-4 w-4 rounded accent-primary-500" />
              Sinhala (text only, voice stays default)
            </label>
            {voiceType === 'free' ? (
              <select value={selectedVoiceName} onChange={(e) => setSelectedVoiceName(e.target.value)} className="w-full text-sm bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-md px-2 py-2">
                {availableVoices.map(v => <option key={v.name} value={v.name}>{v.name}</option>)}
              </select>
            ) : (
              <select value={prebuiltVoice} onChange={(e) => setPrebuiltVoice(e.target.value)} className="w-full text-sm bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-md px-2 py-2">
                {DEFAULT_PREBUILT_VOICE_NAMES.map(name => <option key={name} value={name}>{name}</option>)}
              </select>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default ChatBot;