import React, { useState, useEffect } from 'react';
import ChatBot from './components/ChatBot';
import LiveConversation from './components/LiveConversation';
import VideoAnalyzer from './components/VideoAnalyzer';
import ScreenDescriber from './components/ScreenDescriber';
import DarkModeToggle from './components/DarkModeToggle';

type View = 'chat' | 'voice' | 'video' | 'screen';
type Theme = 'light' | 'dark';

const App: React.FC = () => {
  const [activeView, setActiveView] = useState<View>('screen');
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined' && window.localStorage) {
      const storedTheme = window.localStorage.getItem('theme');
      if (storedTheme === 'light' || storedTheme === 'dark') {
        return storedTheme;
      }
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    }
    return 'light'; // Default to light
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Listen for sidebar nav clicks to navigate app-wide
  useEffect(() => {
    const navHandler = (ev: Event) => {
      try {
        const e = ev as CustomEvent<string>;
        const view = e.detail as View;
        if (view === 'screen' || view === 'video' || view === 'voice' || view === 'chat') {
          setActiveView(view);
        }
      } catch (err) {
        // ignore
      }
    };
    window.addEventListener('navigateToView', navHandler as EventListener);
    return () => { window.removeEventListener('navigateToView', navHandler as EventListener); };
  }, []);

  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'dark' ? 'light' : 'dark'));
  };
  
  const navItems: { id: View; label: string }[] = [
    { id: 'screen', label: 'Screen' },
    { id: 'video', label: 'Video' },
    { id: 'voice', label: 'Voice' },
    { id: 'chat', label: 'Chat' },
  ];

  const renderActiveView = () => {
    switch (activeView) {
      case 'screen':
        return <ScreenDescriber />;
      case 'video':
        return <VideoAnalyzer />;
      case 'voice':
        return <LiveConversation />;
      case 'chat':
        return <ChatBot />;
      default:
        return <ScreenDescriber />;
    }
  };

  return (
    <div className="bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 min-h-screen font-sans flex flex-col transition-colors duration-300">
      <header className="border-b border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-950 z-10 flex-shrink-0">
        <div className="max-w-[90rem] mx-auto px-6 sm:px-8 lg:px-12">
          <div className="flex items-center justify-between h-16">
             <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-black flex items-center justify-center flex-shrink-0 relative overflow-hidden">
                    <svg viewBox="0 0 100 100" className="w-8 h-8" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <rect width="100" height="100" fill="black"/>
                        <rect x="20" y="35" width="60" height="40" fill="#424242"/>
                        <rect x="25" y="40" width="50" height="30" fill="lightgreen"/>
                        <circle cx="35" cy="55" r="8" fill="black"/>
                        <circle cx="65" cy="55" r="8" fill="black"/>
                        <rect x="45" y="60" width="10" height="10" fill="black"/>
                    </svg>
                </div>
                <h1 className="text-xl font-bold text-zinc-900 dark:text-zinc-100">
                    CreativeSense AI
                </h1>
             </div>
             <nav className="hidden md:flex items-center gap-2">
                {navItems.map((item) => (
                   <button
                     key={item.id}
                     onClick={() => setActiveView(item.id)}
                     className={`px-4 py-2 font-medium rounded-lg transition-colors outline-none focus-visible:ring-2 border ${
                       activeView === item.id
                         ? 'text-white bg-primary-500 border-transparent focus-visible:ring-primary-500'
                         : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 border-zinc-300 dark:border-zinc-700 focus-visible:ring-zinc-400'
                     }`}
                   >
                     {item.label}
                   </button>
                ))}
                <div className="pl-2 ml-1 border-l border-zinc-300 dark:border-zinc-700">
                  <DarkModeToggle theme={theme} toggleTheme={toggleTheme} />
                </div>
             </nav>
             {/* Mobile header nav: compact select */}
             <div className="md:hidden flex items-center gap-2 ml-auto">
               <select value={activeView} onChange={(e) => setActiveView(e.target.value as View)} className="px-3 py-2 rounded-md bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-100 border border-zinc-300 dark:border-zinc-700">
                 {navItems.map((n) => (<option key={n.id} value={n.id}>{n.label}</option>))}
               </select>
               <DarkModeToggle theme={theme} toggleTheme={toggleTheme} />
             </div>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-[90rem] mx-auto w-full px-6 sm:px-8 lg:px-12 pt-6">
         <div className="h-[calc(97vh-5rem)] max-h-screen rounded-lg overflow-hidden border border-zinc-300 dark:border-zinc-600">
            {renderActiveView()}
         </div>
      </main>
    </div>
  );
};

export default App;
