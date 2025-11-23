export interface Token {
  surface: string;
  reading?: string; // Hiragana, only for kanji words
}

export interface HistoryItem {
  id: string;
  text: string;
  tokens?: Token[]; // Store analyzed tokens with readings
  createdAt: number;
  lastPosition: number; // In seconds
  repeatMode: number;
  playbackRate?: number;
}

export enum RepeatMode {
  ONCE = 1,
  FIVE = 5,
  TEN = 10,
  THIRTY = 30,
}

export interface Segment {
  segment: string;
  reading?: string; // Added reading for display
  index: number;
  input: string;
  isWordLike: boolean;
  startCharIndex: number;
  endCharIndex: number;
}

export interface AudioState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isLoading: boolean;
  currentRepeat: number;
}