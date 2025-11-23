import React from 'react';
import { HistoryItem } from '../types';
import { Trash2, Clock, PlayCircle } from 'lucide-react';

interface HistorySidebarProps {
  history: HistoryItem[];
  onSelect: (item: HistoryItem) => void;
  onDelete: (id: string) => void;
  selectedId: string | null;
}

export const HistorySidebar: React.FC<HistorySidebarProps> = ({ history, onSelect, onDelete, selectedId }) => {
  return (
    <div className="w-full md:w-80 bg-white border-r border-slate-200 h-full flex flex-col shrink-0">
      <div className="p-4 border-b border-slate-100 bg-slate-50">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Clock className="w-5 h-5 text-indigo-600" />
          Learning History
        </h2>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {history.length === 0 ? (
          <div className="text-center text-slate-400 mt-10 p-4">
            <p className="text-sm">No history yet.</p>
            <p className="text-xs mt-1">Generate speech to save it automatically.</p>
          </div>
        ) : (
          history.map((item) => (
            <div 
              key={item.id}
              className={`group relative p-3 rounded-lg border transition-all cursor-pointer hover:shadow-md ${
                selectedId === item.id 
                  ? 'bg-indigo-50 border-indigo-200 shadow-sm' 
                  : 'bg-white border-slate-100 hover:border-slate-300'
              }`}
              onClick={() => onSelect(item)}
            >
              <div className="pr-8">
                <p className="text-sm font-medium text-slate-800 line-clamp-2 mb-1">
                  {item.text}
                </p>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                  <span>•</span>
                  <span>{item.repeatMode}x mode</span>
                </div>
              </div>

              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(item.id);
                }}
                className="absolute top-3 right-3 text-slate-300 hover:text-red-500 transition-colors p-1"
                aria-label="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              
              {selectedId === item.id && (
                 <div className="absolute bottom-3 right-3 text-indigo-600">
                    <PlayCircle className="w-4 h-4 animate-pulse" />
                 </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
