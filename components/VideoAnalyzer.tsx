import React, {
  useState,
  ChangeEvent,
  FormEvent,
  useEffect,
  useRef,
} from "react";
import { Chat, Part } from "@google/genai";
import { getGeminiClient } from "../utils/geminiClient";
import { extractFramesFromVideo } from "../utils/video";
import { videoStyleConfigs } from "./styles/featureStyleConfig";
import { DescriptionStyle } from "./styles/styleConfig";
import { AnalyzerChatMessage } from "../types";
import CustomSelect from "./CustomSelect";

// Helper to convert a file to a base64 string
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = (error) => reject(error);
  });
};

const ANALYZER_HISTORY_KEY = "videoanalyzer_sessions";

interface AnalyzerSession {
  id: string;
  title: string;
  messages: AnalyzerChatMessage[];
  timestamp: number;
}

const VideoAnalyzer: React.FC = () => {
  const [chat, setChat] = useState<Chat | null>(null);
  const [videoStyle, setVideoStyle] = useState<DescriptionStyle>("normal");
  const [detailLevel, setDetailLevel] = useState<
    "short" | "medium" | "long" | "full"
  >("full");
  const [sessions, setSessions] = useState<AnalyzerSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<
    { name: string; url: string; type: string }[]
  >([]);
  const [prompt, setPrompt] = useState<string>("");
  const [messages, setMessages] = useState<AnalyzerChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
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
      const newChat = ai.chats.create({
        model: "gemini-2.5-pro",
        config: { systemInstruction: styleConfig.systemInstruction("") },
      });
      setChat(newChat);
    } catch (err) {
      console.error("Failed to initialize Gemini:", err);
      setError("Could not initialize AI model. Please check your API key.");
    }

    // Cleanup preview URLs on unmount
    return () => {
      previewUrls.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, [previewUrls]);

  // Reinitialize chat when selected video style changes
  useEffect(() => {
    try {
      const ai = getGeminiClient();
      const styleConfig = videoStyleConfigs[videoStyle];
      const newChat = ai.chats.create({
        model: "gemini-2.5-pro",
        config: { systemInstruction: styleConfig.systemInstruction("") },
      });
      setChat(newChat);
    } catch (err) {
      console.error(
        "Failed to reinitialize Gemini for video style change:",
        err
      );
    }
  }, [videoStyle]);

  // Save active session to localStorage
  useEffect(() => {
    if (isMounted.current && activeSessionId) {
      const updatedSessions = sessions.map((session) =>
        session.id === activeSessionId
          ? { ...session, messages, timestamp: Date.now() }
          : session
      );
      setSessions(updatedSessions);
      localStorage.setItem(
        ANALYZER_HISTORY_KEY,
        JSON.stringify(updatedSessions)
      );
    } else {
      isMounted.current = true;
    }
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleNewSession = () => {
    const newSession: AnalyzerSession = {
      id: `session-${Date.now()}`,
      title: `Analysis ${sessions.length + 1}`,
      messages: [
        {
          role: "model",
          text: "Hello! Please upload a video or image, ask a question, and I'll analyze it for you.",
        },
      ],
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
    const session = sessions.find((s) => s.id === sessionId);
    if (session) {
      setActiveSessionId(session.id);
      setMessages(session.messages);
      setPendingFiles([]);
      setPreviewUrls([]);
    }
  };

  const handleDeleteSession = (sessionId: string) => {
    const updatedSessions = sessions.filter((s) => s.id !== sessionId);
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
      setPendingFiles((prev) => [...prev, ...newFiles]);

      const newPreviews = newFiles.map((file) => ({
        name: file.name,
        url: URL.createObjectURL(file),
        type: file.type,
      }));
      setPreviewUrls((prev) => [...prev, ...newPreviews]);
    }
  };

  const removePendingFile = (index: number) => {
    URL.revokeObjectURL(previewUrls[index].url);
    setPendingFiles((prev) => prev.filter((_, i) => i !== index));
    setPreviewUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!chat || isLoading || (!prompt.trim() && pendingFiles.length === 0)) {
      return;
    }

    setIsLoading(true);
    setError("");

    const userMessage: AnalyzerChatMessage = {
      role: "user",
      text: prompt,
      files: [...previewUrls],
    };
    setMessages((prev) => [...prev, userMessage]);
    setPrompt("");
    setPendingFiles([]);
    setPreviewUrls([]);

    try {
      const apiParts: Part[] = [];

      for (const file of pendingFiles) {
        if (file.type.startsWith("video/")) {
          const frames = await extractFramesFromVideo(file);
          apiParts.push(
            ...frames.map((frameData) => ({
              inlineData: { mimeType: "image/jpeg", data: frameData },
            }))
          );
        } else if (file.type.startsWith("image/")) {
          const base64Data = await fileToBase64(file);
          apiParts.push({
            inlineData: { mimeType: file.type, data: base64Data },
          });
        }
      }

      // Add the style system instruction and the style-guided prompt to the message.
      const styleConfig = videoStyleConfigs[videoStyle];
      const historyText = messages
        .filter((m) => m.role === "model")
        .map((m) => m.text)
        .join(" ");
      let stylePrompt = styleConfig.framePrompt(historyText);
      // Add detail-level cues for the prompt so users can force a longer output
      if (detailLevel === "short") {
        stylePrompt = `Briefly summarize the action: ${stylePrompt}`;
      } else if (detailLevel === "medium") {
        stylePrompt = `Provide a medium-length description: ${stylePrompt}`;
      } else if (detailLevel === "long") {
        stylePrompt = `Provide a detailed description: ${stylePrompt}`;
      } else if (detailLevel === "full") {
        stylePrompt = `Provide a full, start-to-end description of the entire video: ${stylePrompt}`;
      }
      apiParts.push({ text: stylePrompt });
      if (process.env.NODE_ENV === "development") {
        console.debug(
          "[VideoAnalyzer] style systemInstruction:",
          styleConfig.systemInstruction("")?.slice(0, 240)
        );
        console.debug(
          "[VideoAnalyzer] style framePrompt excerpt:",
          stylePrompt?.slice(0, 240)
        );
      }
      apiParts.push({ text: prompt });

      // FIX: The `sendMessageStream` method for a chat session expects a `message` property
      // containing the parts of the message, not a `contents` object.
      const result = await chat.sendMessageStream({ message: apiParts });

      let modelResponse = "";
      setMessages((prev) => [...prev, { role: "model", text: "" }]);

      for await (const chunk of result) {
        modelResponse += chunk.text;
        setMessages((prev) => {
          const newMessages = [...prev];
          newMessages[newMessages.length - 1].text = modelResponse;
          return newMessages;
        });
      }
    } catch (err) {
      console.error("Video analysis error:", err);
      const errorMessage =
        err instanceof Error ? err.message : "An unknown error occurred.";
      const modelError: AnalyzerChatMessage = {
        role: "model",
        text: `Sorry, an error occurred: ${errorMessage}`,
      };
      setMessages((prev) => [...prev.slice(0, -1), modelError]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="cs-bg-main cs-text flex flex-col md:flex-row h-full w-full font-sans">
      {/* History Sidebar */}
      <div className="hidden md:flex w-64 border-r border-zinc-200 dark:border-zinc-800/50 flex-col flex-shrink-0 bg-zinc-50/80 dark:bg-zinc-900/80 backdrop-blur-sm">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
          <button
            onClick={handleNewSession}
            className="w-full bg-mainBtn hover:opacity-90 text-zinc-950 font-bold py-2.5 px-4 rounded-xl transition-all text-sm shadow-lg shadow-mainBtn/20 hover:shadow-mainBtn/30 hover:scale-[1.02] active:scale-[0.98]"
          >
            + New Analysis
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 thin-scrollbar">
          {sessions.map((session) => (
            <div
              key={session.id}
              onClick={() => handleSelectSession(session.id)}
              className={`p-3 mb-2 rounded-xl cursor-pointer group flex justify-between items-center transition-all duration-200 border ${
                activeSessionId === session.id
                  ? "bg-white dark:bg-zinc-800 border-primary/30 shadow-sm"
                  : "bg-white/50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700/50 hover:bg-white dark:hover:bg-zinc-800 hover:border-primary/20"
              }`}
            >
              <p className="font-medium truncate text-sm">{session.title}</p>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteSession(session.id);
                }}
                className="text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                title="Delete session"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="h-full w-full flex flex-col bg-white/50 dark:bg-zinc-900/50">
        {/* Header */}
        <div className="px-3 sm:px-4 py-2 sm:py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-sm flex-shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <button
                className="md:hidden p-1.5 sm:p-2 rounded-lg sm:rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                onClick={() => setIsSidebarOpen(true)}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>
              <h2 className="text-sm sm:text-base md:text-lg font-bold tracking-tight">
                Video Analyzer<span className="text-primary">.</span>
              </h2>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2">
              <CustomSelect
                value={videoStyle}
                onChange={(v) => setVideoStyle(v as DescriptionStyle)}
                options={Object.keys(videoStyleConfigs).map((s) => ({
                  value: s,
                  label: videoStyleConfigs[s as DescriptionStyle].name,
                }))}
                className="w-[80px] sm:w-[100px]"
              />
              {/* Detail buttons - hidden on mobile */}
              <div className="hidden sm:flex items-center gap-1 p-1 bg-zinc-100 dark:bg-zinc-800 rounded-xl">
                <button
                  onClick={() => setDetailLevel("short")}
                  className={`px-2 sm:px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
                    detailLevel === "short"
                      ? "bg-white dark:bg-zinc-700 shadow-sm"
                      : ""
                  }`}
                >
                  Short
                </button>
                <button
                  onClick={() => setDetailLevel("medium")}
                  className={`px-2 sm:px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
                    detailLevel === "medium"
                      ? "bg-white dark:bg-zinc-700 shadow-sm"
                      : ""
                  }`}
                >
                  Med
                </button>
                <button
                  onClick={() => setDetailLevel("long")}
                  className={`px-2 sm:px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
                    detailLevel === "long"
                      ? "bg-white dark:bg-zinc-700 shadow-sm"
                      : ""
                  }`}
                >
                  Long
                </button>
                <button
                  onClick={() => setDetailLevel("full")}
                  className={`px-2 sm:px-2.5 py-1 text-xs font-medium rounded-lg transition-all ${
                    detailLevel === "full"
                      ? "bg-primary text-zinc-950 shadow-sm"
                      : ""
                  }`}
                >
                  Full
                </button>
              </div>
              {/* Mobile detail selector */}
              <CustomSelect
                value={detailLevel}
                onChange={(v) => setDetailLevel(v as any)}
                options={[
                  { value: "short", label: "Short" },
                  { value: "medium", label: "Med" },
                  { value: "long", label: "Long" },
                  { value: "full", label: "Full" },
                ]}
                className="sm:hidden w-[70px]"
              />
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 pb-28 md:pb-6 thin-scrollbar">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              } animate-fade-in`}
            >
              <div
                className={`max-w-[85%] md:max-w-md lg:max-w-2xl px-4 py-3 rounded-2xl transition-all ${
                  msg.role === "user"
                    ? "bg-mainBtn text-zinc-950 rounded-br-none shadow-lg shadow-mainBtn/20 font-medium"
                    : "bg-white dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 rounded-bl-none border border-zinc-200 dark:border-zinc-700 shadow-sm"
                }`}
              >
                {msg.files && msg.files.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {msg.files.map((file, fileIndex) =>
                      file.type.startsWith("image/") ? (
                        <img
                          key={fileIndex}
                          src={file.url}
                          alt={file.name}
                          className="w-24 h-24 object-cover rounded-xl border border-zinc-200 dark:border-zinc-600"
                        />
                      ) : (
                        <video
                          key={fileIndex}
                          src={file.url}
                          className="w-24 h-24 object-cover rounded-xl border border-zinc-200 dark:border-zinc-600"
                        />
                      )
                    )}
                  </div>
                )}
                <p className="whitespace-pre-wrap leading-relaxed">
                  {msg.text}
                </p>
              </div>
            </div>
          ))}
          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex justify-start animate-fade-in">
              <div className="bg-white dark:bg-zinc-800 rounded-2xl rounded-bl-none px-5 py-4 border border-zinc-200 dark:border-zinc-700 shadow-sm">
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-mainBtn rounded-full animate-bounce"></div>
                  <div
                    className="w-2 h-2 bg-mainBtn rounded-full animate-bounce"
                    style={{ animationDelay: "0.1s" }}
                  ></div>
                  <div
                    className="w-2 h-2 bg-mainBtn rounded-full animate-bounce"
                    style={{ animationDelay: "0.2s" }}
                  ></div>
                </div>
              </div>
            </div>
          )}
          {error && (
            <div className="text-red-500 dark:text-red-400 p-4 rounded-xl bg-red-500/10 dark:bg-red-900/20 border border-red-500/20">
              {error}
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="md:static fixed bottom-0 left-0 right-0 z-30 p-4 md:p-5 border-t border-zinc-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl">
          {previewUrls.length > 0 && (
            <div className="mb-3 p-3 bg-zinc-100 dark:bg-zinc-800/50 rounded-xl border border-zinc-200 dark:border-zinc-700">
              <h4 className="text-xs font-bold text-zinc-600 dark:text-zinc-400 mb-2">
                Attachments:
              </h4>
              <div className="flex flex-wrap gap-2">
                {previewUrls.map((file, index) => (
                  <div key={index} className="relative group">
                    {file.type.startsWith("image/") ? (
                      <img
                        src={file.url}
                        alt={file.name}
                        className="w-16 h-16 object-cover rounded-xl border border-zinc-200 dark:border-zinc-600"
                      />
                    ) : (
                      <video
                        src={file.url}
                        className="w-16 h-16 object-cover rounded-xl border border-zinc-200 dark:border-zinc-600"
                      />
                    )}
                    <button
                      onClick={() => removePendingFile(index)}
                      className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all text-xs font-bold hover:bg-red-600 shadow-lg"
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
            <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-all">
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
                className="ml-2 p-2.5 text-zinc-500 dark:text-zinc-400 hover:text-primary transition-all rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-700"
                title="Attach files"
                aria-label="Attach files"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="w-5 h-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.122 2.122l7.81-7.81"
                  />
                </svg>
              </button>
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Ask about the video or images..."
                className="flex-1 bg-transparent px-3 py-3 focus:outline-none text-zinc-900 dark:text-zinc-100 text-sm"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={
                  isLoading || (!prompt.trim() && pendingFiles.length === 0)
                }
                className="mr-2 p-2.5 text-zinc-950 bg-mainBtn rounded-xl hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-mainBtn/20 transition-all hover:scale-105 active:scale-95"
                aria-label="Send message"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                  className="w-5 h-5"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5"
                  />
                </svg>
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Mobile Sidebar Drawer */}
      <div
        className={`fixed inset-0 z-40 md:hidden ${
          isSidebarOpen ? "" : "pointer-events-none"
        }`}
      >
        <div
          className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-all duration-300 ${
            isSidebarOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={() => setIsSidebarOpen(false)}
        />
        <div
          className={`absolute left-0 top-0 bottom-0 w-72 bg-zinc-50/95 dark:bg-zinc-900/95 backdrop-blur-xl border-r border-zinc-200 dark:border-zinc-800 transform transition-transform duration-300 ${
            isSidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="p-4 border-b border-zinc-200 dark:border-zinc-800">
            <button
              onClick={handleNewSession}
              className="w-full bg-mainBtn hover:opacity-90 text-zinc-950 font-bold py-2.5 px-4 rounded-xl transition-all text-sm shadow-lg shadow-mainBtn/20"
            >
              + New Analysis
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 thin-scrollbar">
            {sessions.map((session) => (
              <div
                key={session.id}
                onClick={() => {
                  handleSelectSession(session.id);
                  setIsSidebarOpen(false);
                }}
                className={`p-3 mb-2 rounded-xl cursor-pointer group flex justify-between items-center transition-all duration-200 border ${
                  activeSessionId === session.id
                    ? "bg-white dark:bg-zinc-800 border-primary/30 shadow-sm"
                    : "bg-white/50 dark:bg-zinc-800/50 border-zinc-200 dark:border-zinc-700/50 hover:bg-white dark:hover:bg-zinc-800 hover:border-primary/20"
                }`}
              >
                <p className="font-medium truncate text-sm">{session.title}</p>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteSession(session.id);
                  }}
                  className="text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                  title="Delete session"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
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
