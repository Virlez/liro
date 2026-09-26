export type SourceType = 'selection' | 'article' | 'ocr';
export type ReaderBlockType = 'heading' | 'paragraph' | 'list-item' | 'quote' | 'code';

export interface ReaderDocument {
  id: string;
  sourceType: SourceType;
  sourceUrl?: string;
  title?: string;
  language: string;
  blocks: ReaderBlock[];
  createdAt: number;
}

export interface ReaderBlock {
  id: string;
  type: ReaderBlockType;
  level?: number;
  originalText: string;
}

export interface ReaderSettings {
  version: 2;
  fontFamily: 'atkinson' | 'lexend' | 'opendyslexic' | 'system';
  fontSize: number;
  lineHeight: number;
  columnWidth: number;
  letterSpacing: number;
  wordSpacing: number;
  theme: 'light' | 'cream' | 'dark';
  visualAnchorsEnabled: boolean;
  anchorLength: number;
  guideEnabled: boolean;
  guideMode: 'paragraph' | 'line';
  guideOpacity: number;
  speechRate: number;
  preferredVoice?: string;
  ocrLanguage: 'fra' | 'eng' | 'fra+eng';
  calibrationCompleted: boolean;
  densityPreference: 'comfortable' | 'airy';
  lineWidthPreference: 'compact' | 'wide';
  spacingPreference: 'natural' | 'expanded';
  chunkSize: 'short' | 'balanced' | 'long';
  contextLevel: 'minimal' | 'previous' | 'surrounding';
  coachEnabled: boolean;
  coachDismissed: CoachSuggestionKind[];
  progressEnabled: boolean;
  encouragementsEnabled: boolean;
}

export type ReadingNeed = 'start' | 'focus' | 'decode' | 'resume';

export type CoachSuggestionKind = 'guide' | 'shorter-chunks' | 'audio';

export interface CoachSuggestion {
  kind: CoachSuggestionKind;
  title: string;
  reason: string;
  actionLabel: string;
}

export interface FlowChunk {
  id: string;
  blockId: string;
  blockType: ReaderBlockType;
  level?: number;
  text: string;
  sectionIndex: number;
  startOffset: number;
  endOffset: number;
}

export interface FlowSection {
  id: string;
  title: string;
  level: number;
  chunkIndexes: number[];
}

export interface FlowDocument {
  chunks: FlowChunk[];
  sections: FlowSection[];
  wordCount: number;
  estimatedMinutes: number;
}

export interface ReadingProgress {
  version: 1;
  sourceKey: string;
  documentFingerprint: string;
  chunkFingerprint: string;
  chunkIndex: number;
  completedSteps: number;
  totalSteps: number;
  updatedAt: number;
}

export interface VisualToken {
  id: string;
  originalText: string;
  prefix: string;
  anchor: string;
  remainder: string;
  suffix: string;
  startOffset: number;
  endOffset: number;
  isWord: boolean;
  isTransformable: boolean;
}

export interface TextSelectionRect {
  x: number;
  y: number;
  width: number;
  height: number;
  viewportWidth: number;
  viewportHeight: number;
  devicePixelRatio: number;
}
