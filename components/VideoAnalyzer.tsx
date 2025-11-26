import React, { useState, ChangeEvent, FormEvent, useEffect, useRef } from 'react';
import { Chat, Part } from '@google/genai';
import { getGeminiClient } from '../utils/geminiClient';
import { extractFramesFromVideo } from '../utils/video';
import { videoStyleConfigs } from './styles/featureStyleConfig';
import { DescriptionStyle } from './styles/styleConfig';
import { AnalyzerChatMessage } from '../types';

// Helper to convert a file to a base64 string
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = (error) => reject(error);
  });
};

const ANALYZER_HISTORY_KEY = 'videoanalyzer_sessions';

interface AnalyzerSession {
  id: string;
  title: string;
  messages: AnalyzerChatMessage[];
  timestamp: number;
}

const VideoAnalyzer: React.FC = () => {
  const [chat, setChat] = useState<Chat | null>(null);
  const [videoStyle, setVideoStyle] = useState<DescriptionStyle>('normal');
  const [detailLevel, setDetailLevel] = useState<'short'|'medium'|'long'|'full'>('full');
  const [sessions, setSessions] = useState<AnalyzerSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<{name: string, url: string, type: string}[]>([]);
  const [prompt, setPrompt] = useState<string>('');
  const [messages, setMessages] = useState<AnalyzerChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMounted = useRef(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Load sessions from localStorage
  useEffect(() => {
    const savedSessions = localStorage.getItem(ANALYZER_HISTORY_KEY);
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
  }, []);

  useEffect(() => {
    try {
      const ai = getGeminiClient();
      const styleConfig = videoStyleConfigs[videoStyle];
      const newChat = ai.chats.create({ model: 'gemini-2.5-pro', config: { systemInstruction: styleConfig.systemInstruction('') } });
      setChat(newChat);
    } catch (err) {
      console.error("Failed to initialize Gemini:", err);
      setError("Could not initialize AI model. Please check your API key.");
    }

    // Cleanup preview URLs on unmount
    return () => {
        previewUrls.forEach(p => URL.revokeObjectURL(p.url));
    }
  }, [previewUrls]);

  // Reinitialize chat when selected video style changes
  useEffect(() => {
    try {
      const ai = getGeminiClient();
      const styleConfig = videoStyleConfigs[videoStyle];
      const newChat = ai.chats.create({ model: 'gemini-2.5-pro', config: { systemInstruction: styleConfig.systemInstruction('') } });
      setChat(newChat);
    } catch (err) {
      console.error('Failed to reinitialize Gemini for video style change:', err);
    }
  }, [videoStyle]);

  // Save active session to localStorage
  useEffect(() => {
    if (isMounted.current && activeSessionId) {
      const updatedSessions = sessions.map(session =>
        session.id === activeSessionId
          ? { ...session, messages, timestamp: Date.now() }
          : session
      );
      setSessions(updatedSessions);
      localStorage.setItem(ANALYZER_HISTORY_KEY, JSON.stringify(updatedSessions));
    } else {
      isMounted.current = true;
    }
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleNewSession = () => {
    const newSession: AnalyzerSession = {
      id: `session-${Date.now()}`,
      title: `Analysis ${sessions.length + 1}`,
      messages: [{ role: 'model', text: "Hello! Please upload a video or image, ask a question, and I'll analyze it for you." }],
      timestamp: Date.now(),
    };
    const updatedSessions = [newSession, ...sessions];
    setSessions(updatedSessions);
    setActiveSessionId(newSession.id);
    setMessages(newSession.messages);
    setPendingFiles([]);
    setPreviewUrls([]);
    localStorage.setItem(ANALYZER_HISTORY_KEY, JSON.stringify(updatedSessions));
  };

  const handleSelectSession = (sessionId: string) => {
    const session = sessions.find(s => s.id === sessionId);
    if (session) {
      setActiveSessionId(session.id);
      setMessages(session.messages);
      setPendingFiles([]);
      setPreviewUrls([]);
    }
  };

  const handleDeleteSession = (sessionId: string) => {
    const updatedSessions = sessions.filter(s => s.id !== sessionId);
    setSessions(updatedSessions);
    localStorage.setItem(ANALYZER_HISTORY_KEY, JSON.stringify(updatedSessions));
    
    if (activeSessionId === sessionId) {
      if (updatedSessions.length > 0) {
        setActiveSessionId(updatedSessions[0].id);
        setMessages(updatedSessions[0].messages);
      } else {
        handleNewSession();
      }
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
        const newFiles = Array.from(files) as File[];
        setPendingFiles(prev => [...prev, ...newFiles]);

        const newPreviews = newFiles.map(file => ({
            name: file.name,
            url: URL.createObjectURL(file),
            type: file.type
        }));
        setPreviewUrls(prev => [...prev, ...newPreviews]);
    }
  };
  
  const removePendingFile = (index: number) => {
    URL.revokeObjectURL(previewUrls[index].url);
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!chat || isLoading || (!prompt.trim() && pendingFiles.length === 0)) {
      return;
    }
    
    setIsLoading(true);
    setError('');
    
    const userMessage: AnalyzerChatMessage = {
        role: 'user',
        text: prompt,
        files: [...previewUrls]
    };
    setMessages(prev => [...prev, userMessage]);
    setPrompt('');
    setPendingFiles([]);
    setPreviewUrls([]);

    try {
      const apiParts: Part[] = [];

      for(const file of pendingFiles) {
        if (file.type.startsWith('video/')) {
            const frames = await extractFramesFromVideo(file);
            apiParts.push(...frames.map(frameData => ({
                inlineData: { mimeType: 'image/jpeg', data: frameData },
            })));
        } else if (file.type.startsWith('image/')) {
            const base64Data = await fileToBase64(file);
            apiParts.push({ inlineData: { mimeType: file.type, data: base64Data }});
        }
      }
      
  // Add the style system instruction and the style-guided prompt to the message.
  const styleConfig = videoStyleConfigs[videoStyle];
  const historyText = messages.filter(m => m.role === 'model').map(m => m.text).join(' ');
  let stylePrompt = styleConfig.framePrompt(historyText);
  // Add detail-level cues for the prompt so users can force a longer output
  if (detailLevel === 'short') {
    stylePrompt = `Briefly summarize the action: ${stylePrompt}`;
  } else if (detailLevel === 'medium') {
    stylePrompt = `Provide a medium-length description: ${stylePrompt}`;
  } else if (detailLevel === 'long') {
    stylePrompt = `Provide a detailed description: ${stylePrompt}`;
  } else if (detailLevel === 'full') {
    stylePrompt = `Provide a full, start-to-end description of the entire video: ${stylePrompt}`;
  }
  apiParts.push({ text: stylePrompt });
  if (process.env.NODE_ENV === 'development') {
    console.debug('[VideoAnalyzer] style systemInstruction:', styleConfig.systemInstruction('')?.slice(0, 240));
    console.debug('[VideoAnalyzer] style framePrompt excerpt:', stylePrompt?.slice(0, 240));
  }
  apiParts.push({ text: prompt });
      
      // FIX: The `sendMessageStream` method for a chat session expects a `message` property
      // containing the parts of the message, not a `contents` object.
      const result = await chat.sendMessageStream({ message: apiParts });
      
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

    } catch (err) {
      console.error('Video analysis error:', err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      const modelError: AnalyzerChatMessage = { role: 'model', text: `Sorry, an error occurred: ${errorMessage}`};
      setMessages(prev => [...prev.slice(0, -1), modelError]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-zinc-50 dark:bg-zinc-950 flex flex-col md:flex-row h-full w-full text-zinc-900 dark:text-zinc-100 font-sans">
      {/* History Sidebar */}
      <div className="hidden md:flex w-64 border-r border-zinc-300 dark:border-zinc-700 flex-col flex-shrink-0 bg-white dark:bg-zinc-900">
        <div className="p-3 border-b border-zinc-300 dark:border-zinc-700">
          <button
            onClick={handleNewSession}
            className="w-full bg-primary-500 hover:bg-primary-600 text-white font-medium py-2 px-3 rounded-lg transition-colors text-sm"
          >
            + New Analysis
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

      {/* Main Content Area */}
      <div className="h-full w-full flex flex-col bg-white dark:bg-zinc-900">
        {/* Header */}
        <div className="px-6 py-4 border-b border-zinc-300 dark:border-zinc-700 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <button className="md:hidden" onClick={() => setIsSidebarOpen(true)}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <h2 className="text-lg font-semibold">Video & Image Analyzer</h2>
          </div>
          <div className="flex items-center gap-2">
            <select value={videoStyle} onChange={(e) => setVideoStyle(e.target.value as DescriptionStyle)} className="px-2 py-1 rounded-lg bg-white dark:bg-zinc-800 text-xs border border-zinc-300 dark:border-zinc-700">
              {Object.keys(videoStyleConfigs).map((s) => (
                <option key={s} value={s}>{videoStyleConfigs[s as DescriptionStyle].name}</option>
              ))}
            </select>
            <select value={detailLevel} onChange={(e) => setDetailLevel(e.target.value as any)} className="px-2 py-1 rounded-lg bg-white dark:bg-zinc-800 text-xs border border-zinc-300 dark:border-zinc-700">
              <option value="short">Short</option>
              <option value="medium">Medium</option>
              <option value="long">Long</option>
              <option value="full">Full</option>
            </select>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4 pb-28 md:pb-6">
          {messages.map((msg, index) => (
            <div key={index} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xs md:max-w-md lg:max-w-2xl px-4 py-3 rounded-2xl ${
                  msg.role === 'user' 
                    ? 'bg-primary-500 text-white rounded-br-none' 
                    : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 rounded-bl-none'
              }`}>
                {msg.files && msg.files.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                      {msg.files.map((file, fileIndex) => (
                          file.type.startsWith('image/') ?
                              <img key={fileIndex} src={file.url} alt={file.name} className="w-24 h-24 object-cover rounded-md border border-zinc-200 dark:border-zinc-600" /> :
                              <video key={fileIndex} src={file.url} className="w-24 h-24 object-cover rounded-md border border-zinc-200 dark:border-zinc-600" />
                      ))}
                  </div>
                )}
                <p className="whitespace-pre-wrap">{msg.text}</p>
              </div>
            </div>
          ))}
          {isLoading && messages[messages.length - 1]?.role === 'user' && (
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
          {error && <div className="text-red-500 dark:text-red-400 p-3 rounded-lg bg-red-500/10 dark:bg-red-900/20">{error}</div>}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="md:static fixed bottom-0 left-0 right-0 z-30 p-4 md:p-6 border-t border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900">
          {previewUrls.length > 0 && (
            <div className="mb-3 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-lg">
              <h4 className="text-xs font-semibold text-zinc-600 dark:text-zinc-400 mb-2">Attachments:</h4>
              <div className="flex flex-wrap gap-2">
                {previewUrls.map((file, index) => (
                  <div key={index} className="relative group">
                    {file.type.startsWith('image/') ?
                      <img src={file.url} alt={file.name} className="w-16 h-16 object-cover rounded-md border border-zinc-300 dark:border-zinc-600" /> :
                      <video src={file.url} className="w-16 h-16 object-cover rounded-md border border-zinc-300 dark:border-zinc-600" />
                    }
                    <button 
                      onClick={() => removePendingFile(index)} 
                      className="absolute -top-1 -right-1 bg-red-600 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs font-bold hover:bg-red-700"
                      aria-label="Remove file"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <form onSubmit={handleSubmit}>
            <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800 rounded-lg border border-zinc-300 dark:border-zinc-700 focus-within:border-primary-500 dark:focus-within:border-primary-500 transition-all">
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*,image/*"
                multiple
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="ml-2 p-2 text-zinc-600 dark:text-zinc-400 hover:text-primary-500 dark:hover:text-primary-500 transition-colors rounded-lg"
                title="Attach files"
                aria-label="Attach files"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.122 2.122l7.81-7.81" />
                </svg>
              </button>
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ask about the video or images..."
                className="flex-1 bg-transparent px-4 py-3 focus:outline-none text-zinc-900 dark:text-zinc-100"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={isLoading || (!prompt.trim() && pendingFiles.length === 0)}
                className="mr-2 p-2 text-primary-500 hover:text-primary-600 disabled:text-zinc-400 dark:disabled:text-zinc-600 disabled:cursor-not-allowed transition-colors rounded-lg"
                aria-label="Send message"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-6 h-6">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
                </svg>
              </button>
            </div>
          </form>
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
              + New Analysis
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
    </div>
  );
};

export default VideoAnalyzer;