import React, { useRef, useState, useEffect, useMemo } from 'react';
import { HistoryItem, RepeatMode, Segment } from '../types';
import { Play, Pause, RotateCcw, ChevronDown, Check, FastForward, ArrowLeft, Gauge } from 'lucide-react';

interface PlayerProps {
  activeItem: HistoryItem;
  audioUrl: string | null;
  onUpdateProgress: (id: string, progress: number, repeatMode: number, playbackRate: number) => void;
  onBack: () => void;
}

const PLAYBACK_SPEEDS = [0.8, 1.0, 1.5, 2.0, 3.0];

export const Player: React.FC<PlayerProps> = ({ activeItem, audioUrl, onUpdateProgress, onBack }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(activeItem.lastPosition || 0);
  const [duration, setDuration] = useState(0);
  const [repeatMode, setRepeatMode] = useState<number>(activeItem.repeatMode || RepeatMode.ONCE);
  const [playbackRate, setPlaybackRate] = useState<number>(activeItem.playbackRate || 1.0);
  const [currentRepeatCount, setCurrentRepeatCount] = useState(1);
  const [showRepeatMenu, setShowRepeatMenu] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  // Construct segments from stored tokens OR fallback to Intl.Segmenter
  const segments = useMemo(() => {
    // Priority: Use persisted tokens from AI analysis if available
    if (activeItem.tokens && activeItem.tokens.length > 0) {
      const segs: Segment[] = [];
      let charIndex = 0;
      activeItem.tokens.forEach((token, idx) => {
        segs.push({
          segment: token.surface,
          reading: token.reading,
          index: idx,
          input: token.surface,
          isWordLike: true,
          startCharIndex: charIndex,
          endCharIndex: charIndex + token.surface.length
        });
        charIndex += token.surface.length;
      });
      return segs;
    }

    // Fallback: Use Intl.Segmenter (mostly for old history or if analysis failed)
    if (!activeItem.text) return [];
    
    // Fix: Cast Intl to any to avoid TS error in some envs
    const Segmenter = (Intl as any).Segmenter;

    if (!Segmenter) {
       return [{
        segment: activeItem.text,
        index: 0,
        input: activeItem.text,
        isWordLike: true,
        startCharIndex: 0,
        endCharIndex: activeItem.text.length
      }];
    }

    const segmenter = new Segmenter('ja-JP', { granularity: 'word' });
    const iterator = segmenter.segment(activeItem.text);
    const segs: Segment[] = [];
    let charIndex = 0;
    for (const seg of iterator) {
      segs.push({
        segment: seg.segment,
        index: seg.index,
        input: seg.input,
        isWordLike: seg.isWordLike,
        startCharIndex: charIndex,
        endCharIndex: charIndex + seg.segment.length
      });
      charIndex += seg.segment.length;
    }
    return segs;
  }, [activeItem.text, activeItem.tokens]);

  const totalChars = activeItem.text.length;

  // Restore position and speed on load
  useEffect(() => {
    if (audioRef.current) {
        if (activeItem.lastPosition > 0) {
            audioRef.current.currentTime = activeItem.lastPosition;
            setCurrentTime(activeItem.lastPosition);
        }
        audioRef.current.playbackRate = playbackRate;
    }
  }, [audioUrl]); 

  // Apply playback rate whenever it changes
  useEffect(() => {
    if (audioRef.current) {
        audioRef.current.playbackRate = playbackRate;
    }
    // Update history
    onUpdateProgress(activeItem.id, currentTime, repeatMode, playbackRate);
  }, [playbackRate]);

  // Handle Playback Logic
  const togglePlay = () => {
    if (!audioRef.current || !audioUrl) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const time = audioRef.current.currentTime;
      setCurrentTime(time);
      // Debounce saving progress
      if (Math.floor(time) % 2 === 0) {
         onUpdateProgress(activeItem.id, time, repeatMode, playbackRate);
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleEnded = () => {
    if (currentRepeatCount < repeatMode) {
      setCurrentRepeatCount(prev => prev + 1);
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.play();
      }
    } else {
      setIsPlaying(false);
      setCurrentRepeatCount(1);
      if (audioRef.current) {
          audioRef.current.currentTime = 0;
      }
    }
  };

  const handleWordClick = (seg: Segment) => {
    if (!audioRef.current || duration === 0) return;
    // Linear estimation of time based on character position
    const estimatedStartTime = (seg.startCharIndex / totalChars) * duration;
    audioRef.current.currentTime = estimatedStartTime;
    setCurrentTime(estimatedStartTime);
    if (!isPlaying) {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  const isSegmentActive = (seg: Segment) => {
    if (duration === 0) return false;
    const progress = currentTime / duration;
    const charProgress = progress * totalChars;
    // Use a slightly larger window for active state to make it feel smoother
    return charProgress >= seg.startCharIndex && charProgress < seg.endCharIndex;
  };

  return (
    <div className="flex flex-col h-full bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden relative">
      <audio
        ref={audioRef}
        src={audioUrl || undefined}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      {/* Top Bar: Controls */}
      <div className="bg-slate-50 p-3 md:p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-10 shadow-sm">
        
        <div className="flex items-center gap-3 md:gap-4">
          <button onClick={onBack} className="md:hidden p-2 -ml-2 text-slate-500">
             <ArrowLeft className="w-5 h-5" />
          </button>

          <button
            onClick={togglePlay}
            disabled={!audioUrl}
            className={`w-10 h-10 md:w-12 md:h-12 rounded-full flex items-center justify-center transition-all ${
              audioUrl 
                ? 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:shadow-lg' 
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current ml-1" />}
          </button>

          <button
            onClick={() => {
                if (audioRef.current) audioRef.current.currentTime = 0;
            }}
            disabled={!audioUrl}
            className="text-slate-500 hover:text-indigo-600 transition-colors p-2"
            title="Restart"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-2 md:gap-4">
            {/* Speed Control */}
            <div className="relative">
                <button 
                    onClick={() => setShowSpeedMenu(!showSpeedMenu)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                    <Gauge className="w-4 h-4 text-slate-400" />
                    <span>{playbackRate}x</span>
                </button>
                {showSpeedMenu && (
                    <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowSpeedMenu(false)}></div>
                    <div className="absolute top-full right-0 mt-2 w-24 bg-white rounded-lg shadow-xl border border-slate-100 py-1 z-20">
                        {PLAYBACK_SPEEDS.map((speed) => (
                            <button
                                key={speed}
                                onClick={() => {
                                    setPlaybackRate(speed);
                                    setShowSpeedMenu(false);
                                }}
                                className="w-full flex items-center justify-between px-4 py-2 text-sm text-left hover:bg-slate-50 text-slate-700"
                            >
                                <span>{speed}x</span>
                                {playbackRate === speed && <Check className="w-3 h-3 text-indigo-600" />}
                            </button>
                        ))}
                    </div>
                    </>
                )}
            </div>

            {/* Repetition Controls */}
            <div className="relative">
            <button 
                onClick={() => setShowRepeatMenu(!showRepeatMenu)}
                className="flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-md text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
                <span className="text-indigo-600 font-bold">{repeatMode}x</span>
                <span className="hidden md:inline">Loops</span>
                <ChevronDown className="w-4 h-4 text-slate-400" />
            </button>

            {/* Repeat Progress Indicator */}
            {isPlaying && repeatMode > 1 && (
                <div className="absolute -top-6 left-0 right-0 text-center">
                    <span className="text-xs font-semibold text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100 whitespace-nowrap shadow-sm">
                    {currentRepeatCount} / {repeatMode}
                    </span>
                </div>
            )}

            {showRepeatMenu && (
                <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowRepeatMenu(false)}></div>
                    <div className="absolute top-full right-0 mt-2 w-32 bg-white rounded-lg shadow-xl border border-slate-100 py-1 z-20">
                    {[1, 5, 10, 30].map((count) => (
                        <button
                        key={count}
                        onClick={() => {
                            setRepeatMode(count);
                            setShowRepeatMenu(false);
                            onUpdateProgress(activeItem.id, currentTime, count, playbackRate);
                        }}
                        className="w-full flex items-center justify-between px-4 py-2 text-sm text-left hover:bg-slate-50 text-slate-700"
                        >
                        <span>{count}x Loop</span>
                        {repeatMode === count && <Check className="w-3 h-3 text-indigo-600" />}
                        </button>
                    ))}
                    </div>
                </>
            )}
            </div>
        </div>
      </div>

      {/* Main Text Display Area */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col items-center">
         {activeItem.text ? (
             <div className="w-full max-w-4xl leading-[3.5] text-slate-800 text-xl md:text-2xl lg:text-3xl font-medium tracking-wide text-justify md:text-center">
                 {segments.map((seg, idx) => {
                     const active = isSegmentActive(seg);
                     return (
                        <span
                            key={idx}
                            onClick={() => handleWordClick(seg)}
                            className={`
                                inline-block rounded-lg cursor-pointer transition-all duration-200 mx-1 select-none px-1.5
                                ${active 
                                    ? 'bg-indigo-600 text-white shadow-lg z-10 relative transform scale-105' 
                                    : 'hover:bg-indigo-50 hover:text-indigo-700'
                                }
                            `}
                        >
                            <ruby className="ruby-align-center">
                                {seg.segment}
                                {seg.reading && (
                                    <rt className={`
                                        text-[0.65em] font-normal select-none mb-1 block text-center
                                        ${active ? 'text-indigo-100' : 'text-slate-500'}
                                    `}>
                                        {seg.reading}
                                    </rt>
                                )}
                            </ruby>
                        </span>
                     );
                 })}
             </div>
         ) : (
             <div className="text-slate-300 flex flex-col items-center gap-3 mt-20">
                 <FastForward className="w-12 h-12 opacity-20" />
                 <p>No Text Content</p>
             </div>
         )}
      </div>

      {/* Progress Bar */}
      <div className="bg-slate-50 p-4 border-t border-slate-200">
         <input 
            type="range"
            min="0"
            max={duration || 100}
            step="0.1"
            value={currentTime}
            onChange={(e) => {
                if(audioRef.current) {
                    const t = parseFloat(e.target.value);
                    audioRef.current.currentTime = t;
                    setCurrentTime(t);
                }
            }}
            className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 hover:accent-indigo-700 transition-colors"
         />
         <div className="flex justify-between text-xs font-mono text-slate-500 mt-2 px-1">
             <span>{formatTime(currentTime)}</span>
             <span>{formatTime(duration)}</span>
         </div>
      </div>
    </div>
  );
};

const formatTime = (seconds: number) => {
    if (isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};