import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from 'react';
import { evaluateCoach } from '../../features/coach/coach';
import { buildFlowDocument, sectionForChunk } from '../../features/focus/flow';
import { findTokenAtOffset, formatVisualAnchors } from '../../features/formatting/visualAnchors';
import {
  loadReadingProgress,
  removeReadingProgress,
  saveReadingProgress,
} from '../../features/progress/progress';
import {
  MILESTONE_DURATION_MS,
  MILESTONE_MESSAGES,
  crossedMilestones,
  milestonesReachedBy,
  type ReadingMilestone,
} from '../../features/progress/milestones';
import { saveSettings } from '../../features/settings/settings';
import { segmentSentences } from '../../features/speech/segmentation';
import { chooseLiroVoice, filterLiroVoices } from '../../features/speech/voices';
import { trapTabKey } from '../../lib/accessibility/focus';
import type {
  CoachSuggestion,
  CoachSuggestionKind,
  ReaderBlock,
  ReaderDocument,
  ReaderSettings,
  ReadingNeed,
} from '../../models';
import { BrandMark } from '../BrandMark';
import { Calibration } from './Calibration';
import { FlowMap } from './FlowMap';
import { SettingsPanel } from './SettingsPanel';
import { VisualText } from './VisualText';

interface Props {
  document: ReaderDocument;
  initialSettings: ReaderSettings;
  autoPlay?: boolean;
  onClose: () => void;
}

type Stage = 'calibration' | 'map' | 'read' | 'complete';
type ReaderStyle = CSSProperties & Record<`--lc-${string}`, string>;

function settingsForNeeds(settings: ReaderSettings, needs: ReadingNeed[]): ReaderSettings {
  let next = settings;
  if (needs.includes('start')) next = { ...next, chunkSize: 'short' };
  if (needs.includes('focus')) next = { ...next, guideEnabled: true, contextLevel: 'previous' };
  if (needs.includes('decode'))
    next = {
      ...next,
      visualAnchorsEnabled: true,
      spacingPreference: 'expanded',
      letterSpacing: Math.max(next.letterSpacing, 0.04),
      wordSpacing: Math.max(next.wordSpacing, 0.16),
    };
  return next;
}

export function Reader({ document, initialSettings, autoPlay = false, onClose }: Props) {
  const [settings, setSettings] = useState(initialSettings);
  const [stage, setStage] = useState<Stage>(
    initialSettings.calibrationCompleted ? 'read' : 'calibration',
  );
  const [needs, setNeeds] = useState<ReadingNeed[]>(['start']);
  const [chunkIndex, setChunkIndex] = useState(0);
  const [resumeIndex, setResumeIndex] = useState<number>();
  const [resumeCompletedSteps, setResumeCompletedSteps] = useState(0);
  const [encouragement, setEncouragement] = useState<ReadingMilestone>();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [keyboardHelpOpen, setKeyboardHelpOpen] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [activeTokenId, setActiveTokenId] = useState<string>();
  const [activeSentenceRange, setActiveSentenceRange] = useState<{
    startOffset: number;
    endOffset: number;
  }>();
  const [backwardEvents, setBackwardEvents] = useState<number[]>([]);
  const [suggestion, setSuggestion] = useState<CoachSuggestion>();
  const [suggestedKinds, setSuggestedKinds] = useState<CoachSuggestionKind[]>([]);
  const [lastSuggestedAt, setLastSuggestedAt] = useState<number>();
  const [undoSettings, setUndoSettings] = useState<ReaderSettings>();
  const [rescueOpen, setRescueOpen] = useState(false);
  const [guideTop, setGuideTop] = useState(150);
  const [resumeReady, setResumeReady] = useState(
    !initialSettings.calibrationCompleted || !initialSettings.progressEnabled,
  );
  const overlayRef = useRef<HTMLDivElement>(null);
  const readerMainRef = useRef<HTMLDivElement>(null);
  const corridorRef = useRef<HTMLDivElement>(null);
  const activeChunkRef = useRef<HTMLElement>(null);
  const rescuePanelRef = useRef<HTMLElement>(null);
  const rescueButtonRef = useRef<HTMLButtonElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const keyboardHelpButtonRef = useRef<HTMLButtonElement>(null);
  const keyboardHelpRef = useRef<HTMLElement>(null);
  const keyboardHelpTitleRef = useRef<HTMLHeadingElement>(null);
  const completionTitleRef = useRef<HTMLHeadingElement>(null);
  const draggingRef = useRef(false);
  const speechSessionRef = useRef(0);
  const speechTimerRef = useRef<number | undefined>(undefined);
  const speakChunkRef = useRef<(index: number, session: number) => void>(() => undefined);
  const autoPlayRequestedRef = useRef(autoPlay);
  const initialDirectEntryRef = useRef(initialSettings.calibrationCompleted);
  const resumeAppliedRef = useRef(false);
  const milestoneInitializedRef = useRef(false);
  const suppressNextMilestoneRef = useRef(false);
  const completedStepsRef = useRef(0);
  const seenMilestonesRef = useRef<Set<ReadingMilestone>>(new Set());
  const focusPassageAfterMoveRef = useRef(initialSettings.calibrationCompleted);

  const flow = useMemo(
    () => buildFlowDocument(document, settings.chunkSize),
    [document, settings.chunkSize],
  );
  const activeChunk = flow.chunks[chunkIndex];
  const activeSection = sectionForChunk(flow, chunkIndex);

  useEffect(() => {
    const updateVoices = () => setVoices(window.speechSynthesis?.getVoices() ?? []);
    updateVoices();
    window.speechSynthesis?.addEventListener('voiceschanged', updateVoices);
    if (initialDirectEntryRef.current) overlayRef.current?.focus();
    return () => {
      window.speechSynthesis?.cancel();
      window.speechSynthesis?.removeEventListener('voiceschanged', updateVoices);
    };
  }, []);

  useEffect(() => {
    let current = true;
    if (!settings.progressEnabled) {
      setResumeIndex(undefined);
      setResumeCompletedSteps(0);
      setResumeReady(true);
      resumeAppliedRef.current = true;
      return () => {
        current = false;
      };
    }
    if (initialDirectEntryRef.current && !resumeAppliedRef.current) setResumeReady(false);
    void loadReadingProgress(document, flow).then((progress) => {
      if (!current) return;
      setResumeIndex(progress?.chunkIndex);
      setResumeCompletedSteps(progress?.completedSteps ?? progress?.chunkIndex ?? 0);
      if (initialDirectEntryRef.current && !resumeAppliedRef.current) {
        if (progress) setChunkIndex(progress.chunkIndex);
        resumeAppliedRef.current = true;
      }
      setResumeReady(true);
    });
    return () => {
      current = false;
    };
  }, [document, flow, settings.progressEnabled]);

  useEffect(() => {
    setSettings(initialSettings);
  }, [initialSettings]);

  useEffect(() => {
    if (chunkIndex >= flow.chunks.length && flow.chunks.length)
      setChunkIndex(flow.chunks.length - 1);
  }, [chunkIndex, flow.chunks.length]);

  useEffect(() => {
    if (stage !== 'read' || !resumeReady || !flow.chunks.length) return;
    const seedMilestones = (completedSteps: number) => {
      completedStepsRef.current = completedSteps;
      milestonesReachedBy(flow.chunks.length, completedSteps).forEach((milestone) =>
        seenMilestonesRef.current.add(milestone),
      );
      milestoneInitializedRef.current = true;
    };

    if (!milestoneInitializedRef.current || suppressNextMilestoneRef.current) {
      suppressNextMilestoneRef.current = false;
      seedMilestones(Math.max(chunkIndex, resumeCompletedSteps));
      return;
    }

    const previousCompletedSteps = completedStepsRef.current;
    if (chunkIndex <= previousCompletedSteps) return;
    completedStepsRef.current = chunkIndex;
    const crossed = crossedMilestones(
      flow.chunks.length,
      previousCompletedSteps,
      chunkIndex,
    ).filter((milestone) => !seenMilestonesRef.current.has(milestone));
    crossed.forEach((milestone) => seenMilestonesRef.current.add(milestone));
    if (settings.encouragementsEnabled && crossed.length)
      setEncouragement(crossed[crossed.length - 1]);
  }, [
    chunkIndex,
    flow.chunks.length,
    resumeCompletedSteps,
    resumeReady,
    settings.chunkSize,
    settings.encouragementsEnabled,
    stage,
  ]);

  useEffect(() => {
    if (settings.encouragementsEnabled && stage === 'read') return;
    setEncouragement(undefined);
  }, [settings.encouragementsEnabled, stage]);

  useEffect(() => {
    if (encouragement === undefined) return;
    const timer = window.setTimeout(() => setEncouragement(undefined), MILESTONE_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [encouragement]);

  useEffect(() => {
    if (!rescueOpen || stage !== 'read') return;
    activeChunkRef.current?.scrollIntoView({ block: 'center', behavior: 'auto' });
    rescuePanelRef.current?.focus();
  }, [chunkIndex, rescueOpen, stage]);

  useEffect(() => {
    if (stage !== 'read' || !resumeReady || !focusPassageAfterMoveRef.current) return;
    focusPassageAfterMoveRef.current = false;
    const frame = window.requestAnimationFrame(() => {
      activeChunkRef.current?.focus({ preventScroll: true });
      activeChunkRef.current?.scrollIntoView({ block: 'center', behavior: 'auto' });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [chunkIndex, resumeReady, stage]);

  useEffect(() => {
    if (keyboardHelpOpen) keyboardHelpTitleRef.current?.focus({ preventScroll: true });
  }, [keyboardHelpOpen]);

  useEffect(() => {
    if (stage === 'complete') completionTitleRef.current?.focus({ preventScroll: true });
  }, [stage]);

  const updateSettings = useCallback((next: ReaderSettings) => {
    setSettings(next);
    void saveSettings(next);
  }, []);

  const updateSettingsPreservingPosition = useCallback(
    (next: ReaderSettings) => {
      if (next.chunkSize !== settings.chunkSize && activeChunk) {
        suppressNextMilestoneRef.current = true;
        const nextFlow = buildFlowDocument(document, next.chunkSize);
        const mapped = nextFlow.chunks.findIndex(
          (chunk) =>
            chunk.blockId === activeChunk.blockId &&
            chunk.startOffset <= activeChunk.startOffset &&
            chunk.endOffset >= activeChunk.startOffset,
        );
        if (mapped >= 0) setChunkIndex(mapped);
      }
      updateSettings(next);
    },
    [activeChunk, document, settings.chunkSize, updateSettings],
  );

  const finishCalibration = (next: ReaderSettings) => {
    updateSettings(next);
    setStage('map');
  };

  const beginReading = (requestedIndex: number) => {
    const currentChunk = flow.chunks[requestedIndex];
    const prepared = settingsForNeeds(settings, needs);
    const preparedFlow = buildFlowDocument(document, prepared.chunkSize);
    const mapped = currentChunk
      ? preparedFlow.chunks.findIndex(
          (chunk) =>
            chunk.blockId === currentChunk.blockId &&
            chunk.startOffset <= currentChunk.startOffset &&
            chunk.endOffset >= currentChunk.startOffset,
        )
      : 0;
    const nextIndex =
      mapped >= 0 ? mapped : Math.min(requestedIndex, preparedFlow.chunks.length - 1);
    suppressNextMilestoneRef.current = true;
    updateSettings(prepared);
    setChunkIndex(Math.max(0, nextIndex));
    focusPassageAfterMoveRef.current = true;
    setStage('read');
    setRescueOpen(false);
    if (prepared.progressEnabled)
      void saveReadingProgress(document, preparedFlow, Math.max(0, nextIndex));
  };

  const toggleNeed = (need: ReadingNeed) => {
    setNeeds((current) =>
      current.includes(need) ? current.filter((item) => item !== need) : [...current, need],
    );
  };

  const chooseVoice = useCallback(() => {
    return chooseLiroVoice(voices, settings.preferredVoice, document.language || 'fr-FR');
  }, [document.language, settings.preferredVoice, voices]);

  const orderedVoices = useMemo(() => filterLiroVoices(voices), [voices]);

  const persist = useCallback(
    (index: number, currentFlow = flow) => {
      if (settings.progressEnabled) void saveReadingProgress(document, currentFlow, index);
    },
    [document, flow, settings.progressEnabled],
  );

  const scrollBehavior = useCallback((): ScrollBehavior => {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  }, []);

  const stopSpeech = useCallback(() => {
    speechSessionRef.current += 1;
    if (speechTimerRef.current !== undefined) {
      window.clearTimeout(speechTimerRef.current);
      speechTimerRef.current = undefined;
    }
    window.speechSynthesis?.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
    setActiveTokenId(undefined);
    setActiveSentenceRange(undefined);
  }, []);

  const speakChunk = useCallback(
    (index: number, session: number) => {
      const chunk = flow.chunks[index];
      if (!chunk || !window.speechSynthesis || session !== speechSessionRef.current) return;

      setChunkIndex(index);
      setRescueOpen(false);
      persist(index);
      const sentences = segmentSentences(chunk.text, document.language || 'fr');
      setActiveSentenceRange(sentences[0]);
      const utterance = new SpeechSynthesisUtterance(chunk.text);
      utterance.lang = document.language || 'fr-FR';
      utterance.rate = settings.speechRate;
      const voice = chooseVoice();
      if (voice) utterance.voice = voice;
      utterance.onboundary = (event) => {
        if (session !== speechSessionRef.current) return;
        if (event.name && event.name !== 'word') return;
        const token = findTokenAtOffset(formatVisualAnchors(chunk.text), event.charIndex);
        if (token) setActiveTokenId(`${chunk.id}-${token.id}`);
        const sentence = sentences.find(
          (item) => event.charIndex >= item.startOffset && event.charIndex < item.endOffset,
        );
        if (sentence) setActiveSentenceRange(sentence);
      };
      utterance.onend = () => {
        if (session !== speechSessionRef.current) return;
        setActiveTokenId(undefined);
        setActiveSentenceRange(undefined);
        const nextIndex = index + 1;
        if (nextIndex >= flow.chunks.length) {
          setIsSpeaking(false);
          setIsPaused(false);
          return;
        }

        setChunkIndex(nextIndex);
        persist(nextIndex);
        speechTimerRef.current = window.setTimeout(() => {
          speechTimerRef.current = undefined;
          speakChunkRef.current(nextIndex, session);
        }, 140);
      };
      utterance.onerror = () => {
        if (session !== speechSessionRef.current) return;
        setIsSpeaking(false);
        setIsPaused(false);
        setActiveTokenId(undefined);
        setActiveSentenceRange(undefined);
      };
      setIsSpeaking(true);
      setIsPaused(false);
      window.speechSynthesis.speak(utterance);
    },
    [chooseVoice, document.language, flow.chunks, persist, settings.speechRate],
  );

  useEffect(() => {
    speakChunkRef.current = speakChunk;
  }, [speakChunk]);

  const speakActive = useCallback(() => {
    if (!activeChunk || !window.speechSynthesis) return;
    if (isSpeaking && !isPaused) {
      window.speechSynthesis.pause();
      setIsPaused(true);
      return;
    }
    if (isSpeaking && isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
      return;
    }

    const session = speechSessionRef.current + 1;
    speechSessionRef.current = session;
    window.speechSynthesis.cancel();
    speakChunkRef.current(chunkIndex, session);
  }, [activeChunk, chunkIndex, isPaused, isSpeaking]);

  useEffect(() => {
    if (
      !autoPlayRequestedRef.current ||
      !resumeReady ||
      stage !== 'read' ||
      !activeChunk ||
      isSpeaking
    )
      return;
    autoPlayRequestedRef.current = false;
    const frame = window.requestAnimationFrame(() => speakActive());
    return () => window.cancelAnimationFrame(frame);
  }, [activeChunk, isSpeaking, resumeReady, speakActive, stage]);

  useEffect(() => {
    if (stage !== 'read' || !isSpeaking) return;
    const frame = window.requestAnimationFrame(() => {
      activeChunkRef.current?.scrollIntoView({
        block: 'center',
        inline: 'nearest',
        behavior: scrollBehavior(),
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [chunkIndex, isSpeaking, scrollBehavior, stage]);

  useEffect(() => {
    if (!activeTokenId || !isSpeaking) return;
    const frame = window.requestAnimationFrame(() => {
      const activeWord = activeChunkRef.current?.querySelector<HTMLElement>('.tts-active-word');
      const scroller = readerMainRef.current;
      if (!activeWord || !scroller) return;
      const wordBounds = activeWord.getBoundingClientRect();
      const scrollerBounds = scroller.getBoundingClientRect();
      const safeTop = scrollerBounds.top + scrollerBounds.height * 0.22;
      const safeBottom = scrollerBounds.bottom - scrollerBounds.height * 0.22;
      if (wordBounds.top < safeTop || wordBounds.bottom > safeBottom) {
        activeWord.scrollIntoView({
          block: 'center',
          inline: 'nearest',
          behavior: scrollBehavior(),
        });
      }
    });
    return () => window.cancelAnimationFrame(frame);
  }, [activeTokenId, isSpeaking, scrollBehavior]);

  const previewVoice = useCallback(() => {
    if (!window.speechSynthesis) return;
    stopSpeech();
    const utterance = new SpeechSynthesisUtterance(
      'Avec Liro, chaque idée avance clairement, à ton rythme.',
    );
    utterance.lang = document.language || 'fr-FR';
    utterance.rate = settings.speechRate;
    const voice = chooseVoice();
    if (voice) utterance.voice = voice;
    window.speechSynthesis.speak(utterance);
  }, [chooseVoice, document.language, settings.speechRate, stopSpeech]);

  const move = useCallback(
    (delta: number) => {
      stopSpeech();
      setRescueOpen(false);
      if (delta > 0 && chunkIndex >= flow.chunks.length - 1) {
        setStage('complete');
        setResumeIndex(undefined);
        void removeReadingProgress(document);
        return;
      }
      const next = Math.max(0, Math.min(flow.chunks.length - 1, chunkIndex + delta));
      focusPassageAfterMoveRef.current = true;
      setChunkIndex(next);
      persist(next);
      if (delta < 0) {
        const now = Date.now();
        const events = [...backwardEvents.filter((time) => now - time <= 90_000), now];
        setBackwardEvents(events);
        const nextSuggestion = evaluateCoach({
          backwardEvents: events,
          now,
          ...(lastSuggestedAt === undefined ? {} : { lastSuggestedAt }),
          alreadySuggested: suggestedKinds,
          settings,
        });
        if (nextSuggestion) setSuggestion(nextSuggestion);
      }
    },
    [
      backwardEvents,
      chunkIndex,
      document,
      flow.chunks.length,
      lastSuggestedAt,
      persist,
      settings,
      stopSpeech,
      suggestedKinds,
    ],
  );

  const applySuggestion = (item: CoachSuggestion) => {
    setSuggestion(undefined);
    setRescueOpen(false);
    setLastSuggestedAt(Date.now());
    setSuggestedKinds((current) =>
      current.includes(item.kind) ? current : [...current, item.kind],
    );
    if (item.kind === 'audio') {
      speakActive();
      return;
    }
    setUndoSettings(settings);
    if (item.kind === 'guide')
      updateSettingsPreservingPosition({ ...settings, guideEnabled: true });
    else updateSettingsPreservingPosition({ ...settings, chunkSize: 'short' });
  };

  const dismissSuggestionForever = (item: CoachSuggestion) => {
    setSuggestion(undefined);
    updateSettings({
      ...settings,
      coachDismissed: settings.coachDismissed.includes(item.kind)
        ? settings.coachDismissed
        : [...settings.coachDismissed, item.kind],
    });
  };

  const showRescue = () => {
    stopSpeech();
    setKeyboardHelpOpen(false);
    setSettingsOpen(false);
    setRescueOpen(true);
    requestAnimationFrame(() => {
      activeChunkRef.current?.scrollIntoView({ block: 'center', behavior: 'auto' });
      rescuePanelRef.current?.focus();
    });
  };

  const close = useCallback(() => {
    stopSpeech();
    onClose();
  }, [onClose, stopSpeech]);

  const closeKeyboardHelp = useCallback(() => {
    setKeyboardHelpOpen(false);
    requestAnimationFrame(() => keyboardHelpButtonRef.current?.focus());
  }, []);

  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
    requestAnimationFrame(() => settingsButtonRef.current?.focus());
  }, []);

  const closeRescue = useCallback((restoreTrigger = true) => {
    setRescueOpen(false);
    requestAnimationFrame(() => {
      if (restoreTrigger) rescueButtonRef.current?.focus();
      else activeChunkRef.current?.focus({ preventScroll: true });
    });
  }, []);

  const resetMilestoneRun = () => {
    setEncouragement(undefined);
    milestoneInitializedRef.current = false;
    suppressNextMilestoneRef.current = false;
    completedStepsRef.current = 0;
    seenMilestonesRef.current.clear();
    setResumeCompletedSteps(0);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const activeTrap = keyboardHelpOpen
      ? keyboardHelpRef.current
      : settingsOpen
        ? (overlayRef.current?.querySelector<HTMLElement>('.settings-panel') ?? null)
        : rescueOpen
          ? rescuePanelRef.current
          : suggestion
            ? (overlayRef.current?.querySelector<HTMLElement>('.coach-card') ?? null)
            : overlayRef.current;
    if (trapTabKey(event, activeTrap)) return;

    if (event.key === 'Escape') {
      event.preventDefault();
      if (keyboardHelpOpen) closeKeyboardHelp();
      else if (settingsOpen) closeSettings();
      else if (rescueOpen) closeRescue();
      else if (suggestion) {
        setSuggestion(undefined);
        setLastSuggestedAt(Date.now());
        requestAnimationFrame(() => activeChunkRef.current?.focus({ preventScroll: true }));
      } else close();
      return;
    }

    const target = event.target as HTMLElement;
    const readingSurface = target === activeChunkRef.current || target === corridorRef.current;
    if (stage !== 'read' || !readingSurface) return;

    if (event.key === ' ') {
      event.preventDefault();
      speakActive();
    } else if (event.key === 'ArrowLeft' || event.key === 'PageUp') {
      event.preventDefault();
      move(-1);
    } else if (event.key === 'ArrowRight' || event.key === 'PageDown') {
      event.preventDefault();
      move(1);
    } else if (event.key === '?') {
      event.preventDefault();
      setKeyboardHelpOpen(true);
    }
  };

  const updateGuideFromPointer = (event: PointerEvent) => {
    if (!draggingRef.current) return;
    const bounds = corridorRef.current?.getBoundingClientRect();
    if (!bounds) return;
    setGuideTop(Math.max(0, Math.min(bounds.height - 52, event.clientY - bounds.top - 26)));
  };

  const guideLineHeight = Math.max(16, settings.fontSize * settings.lineHeight);
  const guideMaxTop = Math.max(
    0,
    (corridorRef.current?.clientHeight ?? guideTop + guideLineHeight) - guideLineHeight,
  );
  const guideLineCount = Math.max(1, Math.floor(guideMaxTop / guideLineHeight) + 1);
  const guideLineNumber = Math.min(
    guideLineCount,
    Math.max(1, Math.round(guideTop / guideLineHeight) + 1),
  );
  const moveGuide = (event: KeyboardEvent<HTMLDivElement>) => {
    let next: number | undefined;
    if (event.key === 'ArrowUp') next = guideTop - guideLineHeight;
    else if (event.key === 'ArrowDown') next = guideTop + guideLineHeight;
    else if (event.key === 'PageUp') next = guideTop - guideLineHeight * 5;
    else if (event.key === 'PageDown') next = guideTop + guideLineHeight * 5;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = guideMaxTop;
    if (next === undefined) return;
    event.preventDefault();
    event.stopPropagation();
    setGuideTop(Math.max(0, Math.min(guideMaxTop, next)));
  };

  const style: ReaderStyle = {
    '--lc-font-size': `${settings.fontSize}px`,
    '--lc-line-height': String(settings.lineHeight),
    '--lc-column-width': `${settings.columnWidth}px`,
    '--lc-letter-spacing': `${settings.letterSpacing}em`,
    '--lc-word-spacing': `${settings.wordSpacing}em`,
    '--lc-guide-opacity': String(settings.guideOpacity),
  };

  const chunkBlock: ReaderBlock | undefined = activeChunk
    ? {
        id: activeChunk.id,
        type: activeChunk.blockType,
        ...(activeChunk.level ? { level: activeChunk.level } : {}),
        originalText: activeChunk.text,
      }
    : undefined;
  const previousChunk = flow.chunks[chunkIndex - 1];
  const nextChunk = flow.chunks[chunkIndex + 1];
  return (
    <div
      ref={overlayRef}
      className={`reader-overlay theme-${settings.theme} font-${settings.fontFamily}`}
      role="dialog"
      aria-modal="true"
      aria-label="Lecteur Liro"
      tabIndex={-1}
      onKeyDown={onKeyDown}
      style={style}
    >
      <header className="reader-toolbar">
        <button
          type="button"
          className="brand-button"
          onClick={() => {
            setKeyboardHelpOpen(false);
            setSettingsOpen(false);
            setRescueOpen(false);
            setStage('map');
          }}
          aria-label="Revenir à la carte du texte"
        >
          <span className="brand-mark" aria-hidden="true">
            <BrandMark />
          </span>
          <span>
            <strong>Liro</strong>
            <small>Garde le fil</small>
          </span>
        </button>
        {stage === 'read' && (
          <div className="toolbar-progress">
            <span>
              Étape {chunkIndex + 1} sur {flow.chunks.length}
            </span>
            <progress value={chunkIndex + 1} max={flow.chunks.length} />
          </div>
        )}
        <div className="toolbar-actions">
          {stage === 'read' && (
            <button
              ref={rescueButtonRef}
              type="button"
              className="rescue-button"
              onClick={showRescue}
              aria-expanded={rescueOpen}
              aria-controls="rescue-panel"
            >
              Retrouver le fil
            </button>
          )}
          {stage === 'read' && (
            <button
              ref={keyboardHelpButtonRef}
              type="button"
              className="keyboard-help-button"
              aria-expanded={keyboardHelpOpen}
              aria-controls="keyboard-help-dialog"
              aria-keyshortcuts="?"
              onClick={() => {
                setSettingsOpen(false);
                setRescueOpen(false);
                setKeyboardHelpOpen(true);
              }}
            >
              Raccourcis clavier
            </button>
          )}
          <button
            ref={settingsButtonRef}
            type="button"
            onClick={() => {
              if (settingsOpen) {
                setSettingsOpen(false);
                return;
              }
              setKeyboardHelpOpen(false);
              setRescueOpen(false);
              setSettingsOpen(true);
            }}
            aria-expanded={settingsOpen}
            aria-controls="settings-panel"
          >
            Réglages
          </button>
          <button type="button" className="close-button" onClick={close} aria-label="Fermer Liro">
            ×
          </button>
        </div>
      </header>

      {encouragement !== undefined && stage === 'read' && (
        <div className="milestone-toast" role="status" aria-live="polite" aria-atomic="true">
          <span aria-hidden="true">✓</span>
          <p>{MILESTONE_MESSAGES[encouragement]}</p>
        </div>
      )}

      <div ref={readerMainRef} className="reader-main">
        {stage === 'calibration' && (
          <Calibration settings={settings} onChange={updateSettings} onDone={finishCalibration} />
        )}
        {stage === 'map' && (
          <FlowMap
            document={document}
            flow={flow}
            needs={needs}
            {...(resumeIndex === undefined ? {} : { resumeIndex })}
            onToggleNeed={toggleNeed}
            onStart={beginReading}
          />
        )}
        {stage === 'read' && chunkBlock && (
          <main
            ref={corridorRef}
            className={`reading-corridor ${settings.guideEnabled && settings.guideMode === 'paragraph' ? 'paragraph-guided' : ''} ${rescueOpen ? 'rescue-active' : ''}`}
            tabIndex={-1}
            aria-keyshortcuts="ArrowLeft ArrowRight PageUp PageDown Space ?"
            onPointerMove={updateGuideFromPointer}
            onPointerUp={() => {
              draggingRef.current = false;
            }}
            onPointerLeave={() => {
              draggingRef.current = false;
            }}
            aria-labelledby="current-section-title"
          >
            {settings.guideEnabled && settings.guideMode === 'line' && (
              <div
                className="reading-guide"
                style={{ top: guideTop }}
                role="separator"
                aria-label="Règle de lecture déplaçable"
                aria-orientation="horizontal"
                aria-valuemin={1}
                aria-valuemax={guideLineCount}
                aria-valuenow={guideLineNumber}
                aria-valuetext={`Ligne ${guideLineNumber} sur ${guideLineCount}`}
                aria-keyshortcuts="ArrowUp ArrowDown PageUp PageDown Home End"
                tabIndex={0}
                onKeyDown={moveGuide}
                onPointerDown={(event) => {
                  draggingRef.current = true;
                  event.currentTarget.setPointerCapture(event.pointerId);
                }}
              />
            )}
            <div className="section-context">
              <span>Section {Math.max(1, (flow.chunks[chunkIndex]?.sectionIndex ?? 0) + 1)}</span>
              <h1 id="current-section-title">
                {activeSection?.title || document.title || 'Lecture'}
              </h1>
            </div>

            {settings.contextLevel !== 'minimal' && previousChunk && (
              <button type="button" className="context-card previous" onClick={() => move(-1)}>
                <span>Juste avant</span>
                <p>{previousChunk.text}</p>
              </button>
            )}

            <article
              ref={activeChunkRef}
              className={`active-chunk ${isSpeaking ? 'audio-playing' : ''}`}
              aria-label={`Étape ${chunkIndex + 1}`}
              aria-keyshortcuts="ArrowLeft ArrowRight PageUp PageDown Space ?"
              tabIndex={-1}
            >
              <VisualText
                block={chunkBlock}
                enabled={settings.visualAnchorsEnabled && chunkBlock.type !== 'code'}
                anchorLength={settings.anchorLength}
                activeTokenId={activeTokenId}
                activeSentenceRange={isSpeaking ? activeSentenceRange : undefined}
                onActivate={() => undefined}
              />
            </article>

            {settings.contextLevel !== 'minimal' && nextChunk && (
              <div className="context-card next" aria-hidden="true">
                <span>Ensuite</span>
                <p>{nextChunk.text}</p>
              </div>
            )}

            <nav className="flow-actions" aria-label="Avancer dans le texte">
              <button type="button" onClick={() => move(-1)} disabled={chunkIndex === 0}>
                Relire
              </button>
              <button
                type="button"
                className={isSpeaking ? 'active' : ''}
                aria-pressed={isSpeaking}
                aria-keyshortcuts="Space"
                onClick={speakActive}
              >
                {isSpeaking && !isPaused
                  ? 'Pause'
                  : isSpeaking && isPaused
                    ? 'Reprendre'
                    : 'Écouter la suite'}
              </button>
              <button type="button" className="primary continue-button" onClick={() => move(1)}>
                {chunkIndex === flow.chunks.length - 1 ? 'Terminer' : 'Continuer'}
              </button>
            </nav>

            {rescueOpen && (
              <section
                ref={rescuePanelRef}
                id="rescue-panel"
                className="rescue-panel"
                role="region"
                aria-labelledby="rescue-title"
                tabIndex={-1}
              >
                <p className="eyebrow">Repère rapide</p>
                <h2 id="rescue-title">{activeSection?.title || 'Dans le passage en cours'}</h2>
                <p>
                  Tu es à l’étape {chunkIndex + 1} sur {flow.chunks.length}.
                </p>
                <div className="rescue-context">
                  {previousChunk && (
                    <article>
                      <strong>Juste avant</strong>
                      <p>{previousChunk.text}</p>
                    </article>
                  )}
                  <article className="current">
                    <strong>Tu reprends ici</strong>
                    <p>{chunkBlock.originalText}</p>
                  </article>
                </div>
                <button
                  type="button"
                  className="primary rescue-resume"
                  onClick={() => {
                    closeRescue(false);
                  }}
                >
                  Reprendre ici
                </button>
              </section>
            )}
          </main>
        )}
        {stage === 'complete' && (
          <main className="completion-card" aria-labelledby="completion-title">
            <span className="completion-mark" aria-hidden="true">
              ✓
            </span>
            <p className="eyebrow">Terminer</p>
            <h1 ref={completionTitleRef} id="completion-title" tabIndex={-1}>
              Tu es arrivé au bout.
            </h1>
            <p>{flow.chunks.length} étapes parcourues, à ton rythme.</p>
            <div>
              <button
                type="button"
                onClick={() => {
                  resetMilestoneRun();
                  setChunkIndex(0);
                  focusPassageAfterMoveRef.current = true;
                  setStage('read');
                }}
              >
                Relire
              </button>
              <button type="button" onClick={() => setStage('map')}>
                Voir la carte
              </button>
              <button type="button" className="primary" onClick={close}>
                Fermer
              </button>
            </div>
          </main>
        )}
      </div>

      {keyboardHelpOpen && stage === 'read' && (
        <section
          ref={keyboardHelpRef}
          id="keyboard-help-dialog"
          className="keyboard-help-dialog"
          role="dialog"
          aria-modal="true"
          aria-labelledby="keyboard-help-title"
          tabIndex={-1}
        >
          <div className="keyboard-help-heading">
            <div>
              <p className="eyebrow">Naviguer sans souris</p>
              <h2 ref={keyboardHelpTitleRef} id="keyboard-help-title" tabIndex={-1}>
                Raccourcis clavier
              </h2>
            </div>
            <button type="button" onClick={closeKeyboardHelp} aria-label="Fermer l’aide clavier">
              ×
            </button>
          </div>
          <dl>
            <div>
              <dt>
                <kbd>→</kbd> ou <kbd>Page ↓</kbd>
              </dt>
              <dd>Passage suivant</dd>
            </div>
            <div>
              <dt>
                <kbd>←</kbd> ou <kbd>Page ↑</kbd>
              </dt>
              <dd>Passage précédent</dd>
            </div>
            <div>
              <dt>
                <kbd>Espace</kbd>
              </dt>
              <dd>Lire, mettre en pause ou reprendre la voix</dd>
            </div>
            <div>
              <dt>
                <kbd>?</kbd>
              </dt>
              <dd>Afficher cette aide</dd>
            </div>
            <div>
              <dt>
                <kbd>Échap</kbd>
              </dt>
              <dd>Fermer la fenêtre active</dd>
            </div>
          </dl>
          <p>Les raccourcis de lecture fonctionnent quand le passage courant est ciblé.</p>
          <button type="button" className="primary" onClick={closeKeyboardHelp}>
            Fermer l’aide
          </button>
        </section>
      )}

      {suggestion && stage === 'read' && (
        <aside className="coach-card" aria-live="polite" aria-label="Suggestion du coach">
          <p className="eyebrow">Une aide, si tu veux</p>
          <h2>{suggestion.title}</h2>
          <p>{suggestion.reason}</p>
          <div>
            <button type="button" className="primary" onClick={() => applySuggestion(suggestion)}>
              {suggestion.actionLabel}
            </button>
            <button
              type="button"
              onClick={() => {
                setSuggestion(undefined);
                setLastSuggestedAt(Date.now());
              }}
            >
              Pas maintenant
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => dismissSuggestionForever(suggestion)}
            >
              Ne plus proposer
            </button>
          </div>
        </aside>
      )}

      {undoSettings && (
        <div className="undo-toast" role="status">
          Aide activée.
          <button
            type="button"
            onClick={() => {
              updateSettingsPreservingPosition(undoSettings);
              setUndoSettings(undefined);
            }}
          >
            Annuler
          </button>
          <button type="button" onClick={() => setUndoSettings(undefined)} aria-label="Fermer">
            ×
          </button>
        </div>
      )}

      {settingsOpen && (
        <SettingsPanel
          settings={settings}
          voices={orderedVoices}
          onChange={updateSettingsPreservingPosition}
          onPreviewVoice={previewVoice}
          onRecalibrate={() => {
            setSettingsOpen(false);
            setStage('calibration');
          }}
          onClose={closeSettings}
        />
      )}

      <div className="sr-only" aria-live="polite">
        {stage === 'read'
          ? `${isSpeaking ? 'Lecture vocale. ' : ''}Étape ${chunkIndex + 1} sur ${flow.chunks.length}`
          : ''}
      </div>
    </div>
  );
}
