import React, { useState, useRef, useEffect, useCallback } from "react";
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { decode, decodeAudioData, createBlob } from "../utils/audio";
import { TranscriptionTurn } from "../types";
import { DEFAULT_PREBUILT_VOICE_NAMES } from "../utils/voices";
import { liveConversationStyleConfigs } from "./styles/featureStyleConfig";
import { DescriptionStyle, StyleConfig } from "./styles/styleConfig";

interface ConversationSession {
  id: string;
  title: string;
  transcript: TranscriptionTurn[];
  timestamp: number;
}

interface LiveConversationProps {
  initialStyle?: DescriptionStyle;
  initialAllowExplicit?: boolean;
  initialSinhala?: boolean;
  initialVoiceName?: string;
  initialVoiceType?: "free" | "native";
  initialSelectedWebVoiceName?: string;
  autoStartSession?: boolean;
}

const CONVERSATION_HISTORY_KEY = "liveconversation_sessions";

const LiveConversation: React.FC<LiveConversationProps> = ({
  initialStyle = "normal",
  initialAllowExplicit = false,
  initialSinhala = false,
  initialVoiceName = "Zephyr",
  autoStartSession = false,
}) => {
  // -- State --
  const [sessions, setSessions] = useState<ConversationSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [status, setStatus] = useState("Idle");
  const [error, setError] = useState<string | null>(null);
  const [transcriptionHistory, setTranscriptionHistory] = useState<
    TranscriptionTurn[]
  >([]);
  const [realtimeTranscript, setRealtimeTranscript] = useState<{
    user: string;
    model: string;
  }>({ user: "", model: "" });
  const [chatInput, setChatInput] = useState<string>("");
  const [micPermission, setMicPermission] = useState<
    "default" | "granted" | "denied"
  >("default");
  const [selectedVoice, setSelectedVoice] = useState<string>(initialVoiceName);
  const [descriptionStyle, setDescriptionStyle] =
    useState<DescriptionStyle>(initialStyle);
  const [isSinhala, setIsSinhala] = useState<boolean>(initialSinhala);

  // -- Refs --
  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const audioContextRefs = useRef<{
    input: AudioContext | null;
    output: AudioContext | null;
  }>({ input: null, output: null });
  const audioStreamRefs = useRef<{
    stream: MediaStream | null;
    source: MediaStreamAudioSourceNode | null;
    processor?: ScriptProcessorNode | null;
    worklet?: AudioWorkletNode | null;
  }>({ stream: null, source: null, processor: null, worklet: null });
  const transcriptEndRef = useRef<HTMLDivElement>(null);

  const audioPlaybackRef = useRef<{
    nextStartTime: number;
    sources: Set<AudioBufferSourceNode>;
  }>({ nextStartTime: 0, sources: new Set() });

  // -- Initialization --
  useEffect(() => {
    // Load history
    const savedSessions = localStorage.getItem(CONVERSATION_HISTORY_KEY);
    if (savedSessions) {
      const parsedSessions = JSON.parse(savedSessions);
      setSessions(parsedSessions);
      if (parsedSessions.length > 0) {
        setActiveSessionId(parsedSessions[0].id);
        setTranscriptionHistory(parsedSessions[0].transcript);
      } else {
        handleNewSession();
      }
    } else {
      handleNewSession();
    }

    // Check mic permissions
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions
        .query({ name: "microphone" as PermissionName })
        .then((p) => {
          if (p.state === "granted") setMicPermission("granted");
          if (p.state === "denied") setMicPermission("denied");
        })
        .catch(() => {});
    }

    if (autoStartSession) {
      // Use a timeout to ensure the UI is ready before starting the session
      setTimeout(() => startSession(), 100);
    }
  }, []);

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcriptionHistory, realtimeTranscript]);

  // -- Session Management --
  const handleNewSession = () => {
    const newSession: ConversationSession = {
      id: `session-${Date.now()}`,
      title: `Conversation ${sessions.length + 1}`,
      transcript: [],
      timestamp: Date.now(),
    };
    const updatedSessions = [newSession, ...sessions];
    setSessions(updatedSessions);
    setActiveSessionId(newSession.id);
    setTranscriptionHistory([]);
    localStorage.setItem(
      CONVERSATION_HISTORY_KEY,
      JSON.stringify(updatedSessions)
    );
  };

  const handleSelectSession = (sessionId: string) => {
    if (isActive) stopSession();
    const session = sessions.find((s) => s.id === sessionId);
    if (session) {
      setActiveSessionId(session.id);
      setTranscriptionHistory(session.transcript);
      setStatus("Idle");
      setError(null);
    }
  };

  const handleDeleteSession = (sessionId: string) => {
    const updatedSessions = sessions.filter((s) => s.id !== sessionId);
    setSessions(updatedSessions);
    localStorage.setItem(
      CONVERSATION_HISTORY_KEY,
      JSON.stringify(updatedSessions)
    );

    if (activeSessionId === sessionId) {
      if (updatedSessions.length > 0) {
        handleSelectSession(updatedSessions[0].id);
      } else {
        handleNewSession();
      }
    }
  };

  // Save transcript updates
  useEffect(() => {
    if (activeSessionId && transcriptionHistory.length > 0) {
      setSessions((prev) => {
        const updated = prev.map((s) =>
          s.id === activeSessionId
            ? { ...s, transcript: transcriptionHistory }
            : s
        );
        localStorage.setItem(CONVERSATION_HISTORY_KEY, JSON.stringify(updated));
        return updated;
      });
    }
  }, [transcriptionHistory, activeSessionId]);

  // -- Live API Logic --

  const stopSession = useCallback(async () => {
    if (sessionPromiseRef.current) {
      try {
        const session = await sessionPromiseRef.current;
        session.close();
      } catch (e) {
        console.error("Error closing session", e);
      }
    }
    sessionPromiseRef.current = null;

    // Cleanup Audio
    if (audioStreamRefs.current.stream) {
      audioStreamRefs.current.stream.getTracks().forEach((t) => t.stop());
      audioStreamRefs.current.stream = null;
    }
    if (audioStreamRefs.current.processor) {
      audioStreamRefs.current.processor.disconnect();
      audioStreamRefs.current.processor = null;
    }
    if (audioStreamRefs.current.source) {
      audioStreamRefs.current.source.disconnect();
      audioStreamRefs.current.source = null;
    }
    if (audioContextRefs.current.input) {
      audioContextRefs.current.input.close();
      audioContextRefs.current.input = null;
    }
    if (audioContextRefs.current.output) {
      audioContextRefs.current.output.close();
      audioContextRefs.current.output = null;
    }

    audioPlaybackRef.current.sources.forEach((s) => s.stop());
    audioPlaybackRef.current.sources.clear();
    audioPlaybackRef.current.nextStartTime = 0;

    setIsActive(false);
    setIsConnecting(false);
    setStatus("Idle");
  }, []);

  const startSession = async () => {
    if (isConnecting || isActive) return;

    setError(null);
    setIsConnecting(true);
    setStatus("Requesting Microphone...");

    try {
      // 1. Get Stream & Initialize AudioContexts immediately (user gesture context)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicPermission("granted");
      audioStreamRefs.current.stream = stream;

      const inputCtx = new (window.AudioContext ||
        (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext ||
        (window as any).webkitAudioContext)({ sampleRate: 24000 });

      audioContextRefs.current.input = inputCtx;
      audioContextRefs.current.output = outputCtx;

      // Ensure output context is running
      if (outputCtx.state === "suspended") {
        await outputCtx.resume();
      }

      setStatus("Connecting to Gemini...");

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      const styleConfig = liveConversationStyleConfigs[descriptionStyle];
      const systemInstruction =
        (styleConfig.systemInstruction("") || "") +
        (isSinhala
          ? " Respond in Sinhala. If input is not Sinhala, translate the response into Sinhala."
          : "");

      // 2. Connect to Live API
      const sessionPromise = ai.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-09-2025",
        config: {
          systemInstruction: { parts: [{ text: systemInstruction }] },
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: selectedVoice } },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: async () => {
            console.log("Session Opened");
            setIsConnecting(false);
            setIsActive(true);
            setStatus("Listening...");

            // 3. Setup Audio Processing (ScriptProcessor as reliable fallback)
            const source = inputCtx.createMediaStreamSource(stream);
            audioStreamRefs.current.source = source;

            const processor = inputCtx.createScriptProcessor(4096, 1, 1);
            processor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);

              // CRITICAL FIX: Use sessionPromise directly to avoid race conditions
              sessionPromise
                .then((session: any) => {
                  session.sendRealtimeInput({ media: pcmBlob });
                })
                .catch((e: any) => {
                  console.error("Send error", e);
                });
            };

            source.connect(processor);
            processor.connect(inputCtx.destination); // necessary for script processor to run
            audioStreamRefs.current.processor = processor;
          },
          onmessage: async (message: LiveServerMessage) => {
            const inputChunk =
              message.serverContent?.inputTranscription?.text ?? "";
            const outputChunk =
              message.serverContent?.outputTranscription?.text ?? "";

            if (inputChunk || outputChunk) {
              setRealtimeTranscript((prev) => ({
                user: prev.user + inputChunk,
                model: prev.model + outputChunk,
              }));
            }

            if (message.serverContent?.turnComplete) {
              setRealtimeTranscript((currentTranscript) => {
                let finalTurn = { ...currentTranscript };

                const hasAudio =
                  !!message.serverContent?.modelTurn?.parts?.[0]?.inlineData
                    ?.data;
                if (hasAudio && !finalTurn.model.trim()) {
                  finalTurn.model =
                    "[Audio response could not be transcribed due to safety settings]";
                }

                if (finalTurn.user.trim() || finalTurn.model.trim()) {
                  setTranscriptionHistory((prev) => [...prev, finalTurn]);
                }

                return { user: "", model: "" };
              });
            }

            // Handle Audio Output
            const audioData =
              message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData) {
              const outCtx = audioContextRefs.current.output;
              if (outCtx) {
                setStatus("Speaking...");
                try {
                  const audioBuffer = await decodeAudioData(
                    decode(audioData),
                    outCtx,
                    24000,
                    1
                  );

                  const source = outCtx.createBufferSource();
                  source.buffer = audioBuffer;
                  source.connect(outCtx.destination);

                  // Scheduling
                  audioPlaybackRef.current.nextStartTime = Math.max(
                    audioPlaybackRef.current.nextStartTime,
                    outCtx.currentTime
                  );

                  source.start(audioPlaybackRef.current.nextStartTime);
                  audioPlaybackRef.current.nextStartTime +=
                    audioBuffer.duration;

                  source.onended = () => {
                    audioPlaybackRef.current.sources.delete(source);
                    if (audioPlaybackRef.current.sources.size === 0) {
                      setStatus("Listening...");
                    }
                  };
                  audioPlaybackRef.current.sources.add(source);
                } catch (e) {
                  console.error("Audio decode error", e);
                }
              }
            }

            if (message.serverContent?.interrupted) {
              console.log("Interrupted");
              audioPlaybackRef.current.sources.forEach((s) => s.stop());
              audioPlaybackRef.current.sources.clear();
              audioPlaybackRef.current.nextStartTime = 0;
              setRealtimeTranscript({ user: "", model: "" }); // Clear partial transcript
              setStatus("Listening...");
            }
          },
          onclose: () => {
            console.log("Session Closed");
            stopSession();
          },
          onerror: (e: ErrorEvent) => {
            console.error("Session Error", e);
            setError(e.message || "Connection error");
            stopSession();
          },
        },
      });

      sessionPromiseRef.current = sessionPromise;
    } catch (err: any) {
      console.error("Start Session Error", err);
      setError(err.message || "Failed to start session");
      setIsConnecting(false);
      setStatus("Error");
      stopSession();
    }
  };

  const sendText = async () => {
    if (!chatInput.trim() || !sessionPromiseRef.current) return;
    const textToSend = chatInput;
    setChatInput("");

    setRealtimeTranscript((prev) => ({ ...prev, user: textToSend }));

    try {
      const session = await sessionPromiseRef.current;
      session.sendRealtimeInput({ text: textToSend });
    } catch (e: any) {
      setError("Failed to send text: " + (e as Error).message);
      setRealtimeTranscript({ user: "", model: "" });
    }
  };

  return (
    <div className="flex h-full w-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans overflow-hidden">
      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-30 w-72 bg-zinc-50/95 dark:bg-zinc-900/95 backdrop-blur-xl border-r border-zinc-200 dark:border-zinc-800 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex justify-between items-center">
          <h1 className="font-bold text-lg tracking-tight">
            Gemini Live<span className="text-primary">.</span>
          </h1>
          <button
            className="md:hidden p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-xl transition-colors"
            onClick={() => setIsSidebarOpen(false)}
          >
            ✕
          </button>
        </div>

        <div className="p-4">
          <button
            onClick={handleNewSession}
            className="w-full py-2.5 px-4 bg-mainBtn hover:opacity-90 text-zinc-950 rounded-xl font-bold transition-all shadow-lg shadow-mainBtn/20 hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <span>+</span> New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2 thin-scrollbar">
          {sessions.map((session) => (
            <div
              key={session.id}
              onClick={() => handleSelectSession(session.id)}
              className={`p-3 rounded-xl cursor-pointer border transition-all duration-200 ${
                activeSessionId === session.id
                  ? "bg-white dark:bg-zinc-800 border-primary/30 shadow-sm"
                  : "bg-white/50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700/50 hover:bg-white dark:hover:bg-zinc-800 hover:border-primary/20"
              }`}
            >
              <div className="flex justify-between items-start">
                <span className="text-sm font-medium truncate w-full">
                  {session.title}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteSession(session.id);
                  }}
                  className="text-zinc-400 hover:text-red-500 p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                >
                  ×
                </button>
              </div>
              <div className="text-xs text-zinc-500 mt-1 font-mono">
                {new Date(session.timestamp).toLocaleTimeString()}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex flex-col h-full overflow-hidden relative bg-white/50 dark:bg-zinc-900/50">
        {/* Header */}
        <header className="flex flex-col gap-2 sm:gap-3 px-3 sm:px-4 py-2 sm:py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm">
          <div className="w-full flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="md:hidden p-1.5 sm:p-2 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-lg sm:rounded-xl transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span
                  className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full ${
                    isActive
                      ? "bg-mainBtn animate-pulse shadow-lg shadow-mainBtn/50"
                      : "bg-zinc-400"
                  }`}
                ></span>
                <span className="font-bold text-xs sm:text-sm">{status}</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <select
                value={selectedVoice}
                onChange={(e) => setSelectedVoice(e.target.value)}
                className="text-xs font-medium bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-lg sm:rounded-xl px-2 sm:px-3 py-1 sm:py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30 max-w-[65px] sm:max-w-none"
              >
                {DEFAULT_PREBUILT_VOICE_NAMES.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <label className="hidden xs:flex items-center gap-1 sm:gap-2 text-xs font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={isSinhala}
                  onChange={(e) => setIsSinhala(e.target.checked)}
                  className="rounded accent-primary w-3 h-3"
                />
                <span className="hidden sm:inline">Sinhala</span>
                <span className="sm:hidden">SI</span>
              </label>
            </div>
          </div>
          {/* Style buttons - show dropdown on mobile, buttons on desktop */}
          <div className="flex items-center gap-2">
            <select
              value={descriptionStyle}
              onChange={(e) =>
                setDescriptionStyle(e.target.value as DescriptionStyle)
              }
              className="sm:hidden px-2 py-1 rounded-lg bg-white dark:bg-zinc-800 text-xs font-medium border border-zinc-200 dark:border-zinc-700 flex-1"
            >
              {Object.keys(liveConversationStyleConfigs).map((s) => (
                <option key={s} value={s}>
                  {liveConversationStyleConfigs[s as DescriptionStyle].name}
                </option>
              ))}
            </select>
            <div className="hidden sm:flex flex-wrap items-center gap-2">
              {Object.keys(liveConversationStyleConfigs).map((s) => (
                <button
                  key={s}
                  onClick={() => setDescriptionStyle(s as DescriptionStyle)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-xl transition-all ${
                    descriptionStyle === s
                      ? "bg-primary text-zinc-950 shadow-sm"
                      : "bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                  }`}
                >
                  {liveConversationStyleConfigs[s as DescriptionStyle].name}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Transcript */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 min-h-[200px] thin-scrollbar">
          {transcriptionHistory.length === 0 && !error && (
            <div className="h-full flex flex-col items-center justify-center text-zinc-400 space-y-4">
              <button
                onClick={startSession}
                disabled={isConnecting}
                className="flex flex-col items-center justify-center gap-4 text-zinc-400 hover:text-primary transition-colors rounded-2xl p-8 disabled:opacity-50 group"
              >
                <div className="w-20 h-20 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center group-hover:bg-primary/10 group-hover:scale-105 transition-all shadow-lg">
                  <svg
                    className="w-10 h-10"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                    />
                  </svg>
                </div>
                <p className="font-medium">Click to start conversation</p>
              </button>
              {micPermission === "denied" && (
                <p className="text-red-500 text-sm">
                  Microphone permission is denied. Please enable it in browser
                  settings.
                </p>
              )}
            </div>
          )}

          {transcriptionHistory.map((turn, i) => (
            <div key={i} className="space-y-4 animate-fade-in">
              {turn.user && (
                <div className="flex justify-end">
                  <div className="bg-mainBtn text-zinc-950 px-4 py-3 rounded-2xl rounded-br-none max-w-[80%] shadow-lg shadow-mainBtn/20 font-medium">
                    {turn.user}
                  </div>
                </div>
              )}
              {turn.model && (
                <div className="flex justify-start">
                  <div className="bg-white dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 px-4 py-3 rounded-2xl rounded-bl-none max-w-[80%] shadow-sm">
                    {turn.model}
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Realtime Transcript placeholder if needed */}
          {(realtimeTranscript.user || realtimeTranscript.model) && (
            <div className="opacity-60 animate-fade-in">
              {realtimeTranscript.user && (
                <div className="flex justify-end mb-2">
                  <div className="bg-mainBtn/50 text-zinc-950 px-4 py-3 rounded-2xl rounded-br-none max-w-[80%]">
                    {realtimeTranscript.user}
                  </div>
                </div>
              )}
              {realtimeTranscript.model && (
                <div className="flex justify-start">
                  <div className="bg-zinc-200 dark:bg-zinc-700 px-4 py-3 rounded-2xl rounded-bl-none max-w-[80%]">
                    {realtimeTranscript.model}...
                  </div>
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm text-center">
              {error}
            </div>
          )}
          <div ref={transcriptEndRef} />
        </div>

        {/* Controls */}
        <div className="p-4 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border-t border-zinc-200 dark:border-zinc-800">
          <div className="max-w-4xl mx-auto flex items-center justify-center gap-4">
            <div className="flex-1 flex items-center gap-2">
              {isActive && (
                <>
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendText()}
                    placeholder="Type to interject..."
                    className="flex-1 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm transition-all"
                  />
                  <button
                    onClick={sendText}
                    className="p-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 rounded-xl transition-all hover:scale-105"
                  >
                    <svg
                      className="w-5 h-5 text-zinc-600 dark:text-zinc-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 12h14M12 5l7 7-7 7"
                      />
                    </svg>
                  </button>
                </>
              )}
            </div>
            <button
              onClick={isActive ? stopSession : startSession}
              disabled={isConnecting}
              className={`flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-white font-bold shadow-lg transition-all hover:scale-105 active:scale-95 disabled:opacity-70 ${
                isActive
                  ? "bg-red-500 hover:opacity-90 shadow-red-500/20"
                  : "bg-mainBtn text-zinc-950 hover:opacity-90 shadow-mainBtn/20"
              }`}
              title={isActive ? "Stop Conversation" : "Start Conversation"}
            >
              {isActive ? (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5 5a1 1 0 011-1h8a1 1 0 011 1v8a1 1 0 01-1 1H6a1 1 0 01-1-1V5z"
                      clipRule="evenodd"
                    />
                  </svg>
                  Stop
                </>
              ) : (
                <>
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                    />
                  </svg>
                  Start
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LiveConversation;
