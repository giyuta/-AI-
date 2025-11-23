import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { HistorySidebar } from './components/HistorySidebar';
import { Player } from './components/Player';
import { HistoryItem, RepeatMode, Token } from './types';
import { generateJapaneseSpeech, analyzeJapaneseText } from './services/geminiService';
import { Sparkles, Loader2, Menu, X, PlusCircle } from 'lucide-react';

const STORAGE_KEY = 'nihongo-flow-history';

const App: React.FC = () => {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeItem, setActiveItem] = useState<HistoryItem | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [inputText, setInputText] = useState('');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load history on mount
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setHistory(parsed);
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  // Save history on change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
  }, [history]);

  // Generate Speech Handler
  const handleGenerate = async () => {
    if (!inputText.trim()) return;
    setIsLoading(true);
    setError(null);
    setAudioUrl(null); // Clear previous

    try {
      // Parallel execution: Generate Audio AND Analyze Text for Furigana
      const [audioResult, tokensResult] = await Promise.allSettled([
        generateJapaneseSpeech(inputText),
        analyzeJapaneseText(inputText)
      ]);

      if (audioResult.status === 'rejected') {
        throw new Error(audioResult.reason?.message || "Failed to generate speech");
      }

      const url = audioResult.value;
      const tokens = tokensResult.status === 'fulfilled' ? tokensResult.value : [];

      // Check if text already exists in history to update it, or create new
      let newItem: HistoryItem;
      const existingIndex = history.findIndex(h => h.text === inputText);

      if (existingIndex >= 0) {
        // Update existing item with new analysis if it didn't have it, and bump to top
        newItem = { 
            ...history[existingIndex], 
            createdAt: Date.now(),
            tokens: tokens.length > 0 ? tokens : history[existingIndex].tokens 
        }; 
        const newHist = [...history];
        newHist.splice(existingIndex, 1);
        setHistory([newItem, ...newHist]);
      } else {
        newItem = {
          id: uuidv4(),
          text: inputText,
          tokens: tokens, // Store the analysis
          createdAt: Date.now(),
          lastPosition: 0,
          repeatMode: RepeatMode.ONCE,
          playbackRate: 1.0
        };
        setHistory([newItem, ...history]);
      }

      setActiveItem(newItem);
      setAudioUrl(url);

    } catch (err: any) {
      setError(err.message || "Failed to generate speech. Please check your API key.");
    } finally {
      setIsLoading(false);
    }
  };

  // Select item from history
  const handleSelectHistory = async (item: HistoryItem) => {
    setActiveItem(item);
    setInputText(item.text); // Pre-fill input text in case they want to edit later
    setError(null);
    setIsSidebarOpen(false); // Close mobile sidebar
    
    setIsLoading(true);
    try {
        const url = await generateJapaneseSpeech(item.text);
        setAudioUrl(url);
    } catch (err: any) {
        setError("Could not restore audio. Try generating again.");
    } finally {
        setIsLoading(false);
    }
  };

  const handleDeleteHistory = (id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
    if (activeItem?.id === id) {
      handleBackToInput();
    }
  };

  const handleUpdateProgress = (id: string, progress: number, repeatMode: number, playbackRate: number) => {
    setHistory(prev => prev.map(item => {
        if (item.id === id) {
            return { ...item, lastPosition: progress, repeatMode, playbackRate };
        }
        return item;
    }));
  };

  const handleBackToInput = () => {
      setActiveItem(null);
      setAudioUrl(null);
      // We keep inputText populated so they can edit it
  };

  const clearInput = () => {
      handleBackToInput();
      setInputText('');
  }

  return (
    <div className="flex h-full w-full bg-slate-100 overflow-hidden relative">
      
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-20 md:hidden" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* Sidebar (Desktop & Mobile) */}
      <div className={`fixed inset-y-0 left-0 z-30 transform transition-transform duration-300 md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
         <HistorySidebar 
            history={history} 
            onSelect={handleSelectHistory} 
            onDelete={handleDeleteHistory}
            selectedId={activeItem?.id || null} 
         />
         <button 
           onClick={() => setIsSidebarOpen(false)}
           className="absolute top-4 right-4 md:hidden text-slate-500"
         >
           <X />
         </button>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full w-full min-w-0 bg-slate-50">
        
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0 h-16">
          <div className="flex items-center gap-3">
             <button 
                onClick={() => setIsSidebarOpen(true)}
                className="md:hidden text-slate-600 hover:text-indigo-600"
             >
                <Menu />
             </button>
             <div className="flex items-center gap-2 cursor-pointer" onClick={handleBackToInput}>
                <span className="bg-indigo-600 text-white p-1.5 rounded-lg">
                    <Sparkles className="w-5 h-5" />
                </span>
                <h1 className="text-xl font-bold text-slate-800 tracking-tight hidden sm:block">Nihongo<span className="text-indigo-600">Flow</span></h1>
             </div>
          </div>
          
          <div className="flex items-center gap-3">
             {activeItem && (
                 <button 
                    onClick={clearInput}
                    className="text-sm font-medium text-slate-600 hover:text-indigo-600 flex items-center gap-1 transition-colors"
                 >
                    <PlusCircle className="w-4 h-4" />
                    <span className="hidden sm:inline">New Text</span>
                 </button>
             )}
             <div className="text-xs font-medium text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100 hidden md:block">
                AI Voice: Fenrir
             </div>
          </div>
        </header>

        {/* Workspace */}
        <div className="flex-1 overflow-hidden relative">
            
            {/* VIEW 1: Input Creation Mode */}
            {!activeItem && (
                <div className="h-full flex flex-col items-center justify-center p-6 max-w-4xl mx-auto w-full animate-in fade-in zoom-in duration-300">
                    <div className="w-full flex flex-col gap-4 h-[70vh]">
                         <div className="flex items-center justify-between">
                            <label className="text-lg font-bold text-slate-700">Japanese Text Input</label>
                            <span className="text-xs text-slate-400">Paste or type Japanese text</span>
                         </div>
                        
                        <textarea
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            placeholder="ここに日本語を入力してください... (Enter your Japanese text here)"
                            className="flex-1 w-full border border-slate-300 rounded-xl p-6 text-xl md:text-2xl leading-relaxed focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm resize-none"
                            autoFocus
                        />
                        
                        <div className="flex flex-col gap-2">
                            {error && <p className="text-red-500 text-sm text-center bg-red-50 p-2 rounded">{error}</p>}
                            <button 
                                onClick={handleGenerate}
                                disabled={isLoading || !inputText.trim()}
                                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-lg px-8 py-4 rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Sparkles className="w-6 h-6" />}
                                Generate Speech
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* VIEW 2: Player Mode */}
            {activeItem && (
                <div className="h-full flex flex-col p-4 md:p-6 max-w-5xl mx-auto w-full animate-in slide-in-from-bottom-4 duration-500">
                    <Player 
                        activeItem={activeItem} 
                        audioUrl={audioUrl}
                        onUpdateProgress={handleUpdateProgress}
                        onBack={handleBackToInput}
                    />
                </div>
            )}

        </div>
      </main>
    </div>
  );
};

export default App;