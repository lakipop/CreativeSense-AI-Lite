import React, { useState, useEffect } from "react";
import ChatBot from "./components/ChatBot";
import LiveConversation from "./components/LiveConversation";
import VideoAnalyzer from "./components/VideoAnalyzer";
import ScreenDescriber from "./components/ScreenDescriber";
import { SunIcon, MoonIcon } from "@heroicons/react/24/outline";

type View = "chat" | "voice" | "video" | "screen";
type Theme = "light" | "dark";

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<View>("screen");
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== "undefined" && window.localStorage) {
      const storedTheme = window.localStorage.getItem("theme");
      if (storedTheme === "light" || storedTheme === "dark") {
        return storedTheme;
      }
      if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
        return "dark";
      }
    }
    return "dark"; // Default to dark for premium feel
  });

  useEffect(() => {
    if (theme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    localStorage.setItem("theme", theme);
  }, [theme]);

  // Listen for sidebar nav clicks to navigate app-wide
  useEffect(() => {
    const navHandler = (ev: Event) => {
      try {
        const e = ev as CustomEvent<string>;
        const view = e.detail as View;
        if (
          view === "screen" ||
          view === "video" ||
          view === "voice" ||
          view === "chat"
        ) {
          setActiveView(view);
        }
      } catch (err) {
        // ignore
      }
    };
    window.addEventListener("navigateToView", navHandler as EventListener);
    return () => {
      window.removeEventListener("navigateToView", navHandler as EventListener);
    };
  }, []);

  const toggleTheme = () => {
    setTheme((prevTheme) => (prevTheme === "dark" ? "light" : "dark"));
  };

  const navItems: { id: View; label: string; icon: string }[] = [
    { id: "screen", label: "Screen", icon: "🖥️" },
    { id: "video", label: "Video", icon: "🎬" },
    { id: "voice", label: "Voice", icon: "🎤" },
    { id: "chat", label: "Chat", icon: "💬" },
  ];

  const renderActiveView = () => {
    switch (activeView) {
      case "screen":
        return <ScreenDescriber />;
      case "video":
        return <VideoAnalyzer />;
      case "voice":
        return <LiveConversation />;
      case "chat":
        return <ChatBot />;
      default:
        return <ScreenDescriber />;
    }
  };

  return (
    <div className="bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 min-h-screen font-sans flex flex-col transition-colors duration-300 selection:bg-primary/30">
      {/* Animated Background Blobs - Dark Mode Only */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-5%] w-72 h-72 bg-cyan-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob dark:block hidden"></div>
        <div className="absolute top-[20%] right-[-5%] w-72 h-72 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-2000 dark:block hidden"></div>
        <div className="absolute bottom-[-10%] left-[30%] w-72 h-72 bg-green-500 rounded-full mix-blend-multiply filter blur-3xl opacity-10 animate-blob animation-delay-4000 dark:block hidden"></div>
      </div>

      {/* Premium Header with Glassmorphism */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-zinc-200/50 dark:border-zinc-800/50 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl transition-colors duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Brand */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 dark:from-primary/10 dark:to-secondary/10 border border-zinc-200 dark:border-zinc-800 flex items-center justify-center flex-shrink-0 relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-primary to-secondary opacity-0 group-hover:opacity-20 transition-opacity"></div>
                <svg
                  viewBox="0 0 100 100"
                  className="w-7 h-7"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <rect
                    x="20"
                    y="35"
                    width="60"
                    height="40"
                    className="fill-zinc-700 dark:fill-zinc-500"
                  />
                  <rect
                    x="25"
                    y="40"
                    width="50"
                    height="30"
                    className="fill-primary"
                  />
                  <circle
                    cx="35"
                    cy="55"
                    r="8"
                    className="fill-zinc-900 dark:fill-zinc-950"
                  />
                  <circle
                    cx="65"
                    cy="55"
                    r="8"
                    className="fill-zinc-900 dark:fill-zinc-950"
                  />
                  <rect
                    x="45"
                    y="60"
                    width="10"
                    height="10"
                    className="fill-zinc-900 dark:fill-zinc-950"
                  />
                </svg>
              </div>
              <div className="flex flex-col">
                <h1 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-white">
                  CreativeSense
                  <span className="text-primary">.</span>
                  <span className="text-zinc-400 dark:text-zinc-500 font-medium">
                    AI
                  </span>
                </h1>
                <span className="text-[10px] text-zinc-500 dark:text-zinc-600 font-mono tracking-wider hidden sm:block">
                  MULTIMODAL PLATFORM
                </span>
              </div>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex items-center gap-2">
              {navItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => setActiveView(item.id)}
                  className={`relative px-4 py-2 font-medium rounded-xl transition-all duration-300 outline-none focus-visible:ring-2 focus-visible:ring-primary/50 ${
                    activeView === item.id
                      ? "text-zinc-900 dark:text-white bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-lg shadow-primary/5"
                      : "text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800/50"
                  }`}
                >
                  {activeView === item.id && (
                    <span className="absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-primary to-transparent"></span>
                  )}
                  <span className="mr-2">{item.icon}</span>
                  {item.label}
                </button>
              ))}

              {/* Theme Toggle */}
              <div className="pl-2 ml-2 border-l border-zinc-200 dark:border-zinc-800">
                <button
                  onClick={toggleTheme}
                  className="p-2.5 rounded-xl bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-primary dark:hover:text-primary hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-all hover:scale-105 active:scale-95 border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700"
                  title={`Switch to ${
                    theme === "dark" ? "Light" : "Dark"
                  } Mode`}
                >
                  {theme === "dark" ? (
                    <SunIcon className="w-5 h-5" />
                  ) : (
                    <MoonIcon className="w-5 h-5" />
                  )}
                </button>
              </div>
            </nav>

            {/* Mobile Navigation */}
            <div className="md:hidden flex items-center gap-3">
              <select
                value={activeView}
                onChange={(e) => setActiveView(e.target.value as View)}
                className="px-3 py-2 rounded-xl bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary/50"
              >
                {navItems.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.icon} {n.label}
                  </option>
                ))}
              </select>
              <button
                onClick={toggleTheme}
                className="p-2 rounded-xl bg-zinc-100 dark:bg-zinc-900 text-zinc-600 dark:text-zinc-400 hover:text-primary border border-zinc-200 dark:border-zinc-800"
              >
                {theme === "dark" ? (
                  <SunIcon className="w-5 h-5" />
                ) : (
                  <MoonIcon className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content - Offset for fixed header */}
      <main className="flex-1 pt-16 relative z-10">
        <div className="h-[calc(100vh-4rem)] max-w-7xl mx-auto w-full">
          <div className="h-full p-4 sm:p-6">
            <div className="h-full rounded-2xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 backdrop-blur-sm shadow-xl shadow-zinc-900/5 dark:shadow-black/20">
              {renderActiveView()}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
