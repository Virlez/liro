import type { ReaderSettings } from '../../models';
import { AUTO_VOICE_NAME } from '../speech/voices';

export const SETTINGS_KEY = 'ligneclaire.settings';

export const DEFAULT_SETTINGS: ReaderSettings = {
  version: 2,
  fontFamily: 'atkinson',
  fontSize: 20,
  lineHeight: 1.65,
  columnWidth: 760,
  letterSpacing: 0,
  wordSpacing: 0,
  theme: 'cream',
  visualAnchorsEnabled: false,
  anchorLength: 2,
  guideEnabled: false,
  guideMode: 'paragraph',
  guideOpacity: 0.22,
  speechRate: 1,
  preferredVoice: AUTO_VOICE_NAME,
  ocrLanguage: 'fra',
  calibrationCompleted: false,
  densityPreference: 'comfortable',
  lineWidthPreference: 'compact',
  spacingPreference: 'natural',
  chunkSize: 'balanced',
  contextLevel: 'previous',
  coachEnabled: true,
  coachDismissed: [],
  progressEnabled: true,
  encouragementsEnabled: true,
};

const clamp = (value: unknown, min: number, max: number, fallback: number): number => {
  const number = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, number));
};

export function validateSettings(input: unknown): ReaderSettings {
  const value =
    typeof input === 'object' && input !== null ? (input as Record<string, unknown>) : {};
  const fontFamily = ['atkinson', 'lexend', 'opendyslexic', 'system'].includes(
    String(value.fontFamily),
  )
    ? (value.fontFamily as ReaderSettings['fontFamily'])
    : DEFAULT_SETTINGS.fontFamily;
  const theme = ['light', 'cream', 'dark'].includes(String(value.theme))
    ? (value.theme as ReaderSettings['theme'])
    : DEFAULT_SETTINGS.theme;
  const ocrLanguage = ['fra', 'eng', 'fra+eng'].includes(String(value.ocrLanguage))
    ? (value.ocrLanguage as ReaderSettings['ocrLanguage'])
    : DEFAULT_SETTINGS.ocrLanguage;
  const guideMode = ['paragraph', 'line'].includes(String(value.guideMode))
    ? (value.guideMode as ReaderSettings['guideMode'])
    : DEFAULT_SETTINGS.guideMode;
  const densityPreference = ['comfortable', 'airy'].includes(String(value.densityPreference))
    ? (value.densityPreference as ReaderSettings['densityPreference'])
    : DEFAULT_SETTINGS.densityPreference;
  const lineWidthPreference = ['compact', 'wide'].includes(String(value.lineWidthPreference))
    ? (value.lineWidthPreference as ReaderSettings['lineWidthPreference'])
    : DEFAULT_SETTINGS.lineWidthPreference;
  const spacingPreference = ['natural', 'expanded'].includes(String(value.spacingPreference))
    ? (value.spacingPreference as ReaderSettings['spacingPreference'])
    : DEFAULT_SETTINGS.spacingPreference;
  const chunkSize = ['short', 'balanced', 'long'].includes(String(value.chunkSize))
    ? (value.chunkSize as ReaderSettings['chunkSize'])
    : DEFAULT_SETTINGS.chunkSize;
  const contextLevel = ['minimal', 'previous', 'surrounding'].includes(String(value.contextLevel))
    ? (value.contextLevel as ReaderSettings['contextLevel'])
    : DEFAULT_SETTINGS.contextLevel;
  const coachDismissed = Array.isArray(value.coachDismissed)
    ? value.coachDismissed.filter(
        (kind): kind is ReaderSettings['coachDismissed'][number] =>
          kind === 'guide' || kind === 'shorter-chunks' || kind === 'audio',
      )
    : [];

  const result: ReaderSettings = {
    version: 2,
    fontFamily,
    fontSize: clamp(value.fontSize, 16, 32, DEFAULT_SETTINGS.fontSize),
    lineHeight: clamp(value.lineHeight, 1.3, 2, DEFAULT_SETTINGS.lineHeight),
    columnWidth: clamp(value.columnWidth, 480, 1000, DEFAULT_SETTINGS.columnWidth),
    letterSpacing: clamp(value.letterSpacing, 0, 0.2, DEFAULT_SETTINGS.letterSpacing),
    wordSpacing: clamp(value.wordSpacing, 0, 0.6, DEFAULT_SETTINGS.wordSpacing),
    theme,
    visualAnchorsEnabled:
      typeof value.visualAnchorsEnabled === 'boolean'
        ? value.visualAnchorsEnabled
        : DEFAULT_SETTINGS.visualAnchorsEnabled,
    anchorLength: Math.round(clamp(value.anchorLength, 1, 4, DEFAULT_SETTINGS.anchorLength)),
    guideEnabled:
      typeof value.guideEnabled === 'boolean' ? value.guideEnabled : DEFAULT_SETTINGS.guideEnabled,
    guideMode,
    guideOpacity: clamp(value.guideOpacity, 0.08, 0.55, DEFAULT_SETTINGS.guideOpacity),
    speechRate: clamp(value.speechRate, 0.6, 2, DEFAULT_SETTINGS.speechRate),
    ocrLanguage,
    calibrationCompleted:
      typeof value.calibrationCompleted === 'boolean'
        ? value.calibrationCompleted
        : DEFAULT_SETTINGS.calibrationCompleted,
    densityPreference,
    lineWidthPreference,
    spacingPreference,
    chunkSize,
    contextLevel,
    coachEnabled:
      typeof value.coachEnabled === 'boolean' ? value.coachEnabled : DEFAULT_SETTINGS.coachEnabled,
    coachDismissed,
    progressEnabled:
      typeof value.progressEnabled === 'boolean'
        ? value.progressEnabled
        : DEFAULT_SETTINGS.progressEnabled,
    encouragementsEnabled:
      typeof value.encouragementsEnabled === 'boolean'
        ? value.encouragementsEnabled
        : DEFAULT_SETTINGS.encouragementsEnabled,
  };
  result.preferredVoice =
    typeof value.preferredVoice === 'string' && value.preferredVoice.trim()
      ? value.preferredVoice
      : AUTO_VOICE_NAME;
  return result;
}

export async function loadSettings(): Promise<ReaderSettings> {
  const stored = await chrome.storage.local.get(SETTINGS_KEY);
  return validateSettings(stored[SETTINGS_KEY]);
}

export async function saveSettings(settings: ReaderSettings): Promise<ReaderSettings> {
  const validated = validateSettings(settings);
  await chrome.storage.local.set({ [SETTINGS_KEY]: validated });
  return validated;
}

export async function clearSettings(): Promise<void> {
  await chrome.storage.local.remove(SETTINGS_KEY);
}
