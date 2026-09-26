export interface VoiceCandidate {
  name: string;
  lang: string;
  localService: boolean;
  default: boolean;
}

export const DENISE_VOICE_NAME = 'Microsoft Denise Online (Natural) - French (France)';
export const HENRI_VOICE_NAME = 'Microsoft Henri Online (Natural) - French (France)';
export const AUTO_VOICE_NAME = 'liro:auto';

const LIRO_VOICE_ORDER = [DENISE_VOICE_NAME, HENRI_VOICE_NAME] as const;

const NATURAL_VOICE_HINT = /\b(natural|neural|premium|enhanced|haute qualité|high quality)\b/i;
const GOOGLE_FRENCH_VOICE = /^Google\s+fran[cç]ais$/iu;

const normalizeLanguage = (language: string): string => language.toLowerCase().replace('_', '-');
const baseLanguage = (language: string): string => normalizeLanguage(language).split('-')[0] ?? '';

export function isNaturalVoice(voice: VoiceCandidate): boolean {
  return NATURAL_VOICE_HINT.test(voice.name) || GOOGLE_FRENCH_VOICE.test(voice.name);
}

export function voiceScore(voice: VoiceCandidate, language: string): number {
  const normalizedVoiceLanguage = normalizeLanguage(voice.lang);
  const normalizedLanguage = normalizeLanguage(language || 'fr-FR');
  let score = 0;
  if (baseLanguage(normalizedVoiceLanguage) === baseLanguage(normalizedLanguage)) score += 400;
  if (normalizedVoiceLanguage === normalizedLanguage) score += 40;
  if (voice.localService) score += 80;
  if (isNaturalVoice(voice)) score += 160;
  if (voice.default) score += 10;
  return score;
}

export function rankVoices<T extends VoiceCandidate>(voices: readonly T[], language: string): T[] {
  return voices
    .map((voice, index) => ({ voice, index, score: voiceScore(voice, language) }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ voice }) => voice);
}

export function chooseBestLocalVoice<T extends VoiceCandidate>(
  voices: readonly T[],
  language: string,
): T | undefined {
  const requestedBase = baseLanguage(language || 'fr-FR');
  const localMatches = voices.filter(
    (voice) => voice.localService && baseLanguage(voice.lang) === requestedBase,
  );
  return rankVoices(localMatches, language)[0];
}

export function filterLiroVoices<T extends VoiceCandidate>(voices: readonly T[]): T[] {
  const featuredVoices = LIRO_VOICE_ORDER.flatMap((name) => {
    const match = voices.find((voice) => voice.name === name);
    return match ? [match] : [];
  });
  const naturalOnlineVoices = voices.filter(
    (voice) =>
      !voice.localService &&
      baseLanguage(voice.lang) === 'fr' &&
      isNaturalVoice(voice) &&
      !LIRO_VOICE_ORDER.some((featuredName) => featuredName === voice.name),
  );
  const localVoices = voices.filter(
    (voice) =>
      voice.localService && !LIRO_VOICE_ORDER.some((featuredName) => featuredName === voice.name),
  );
  return [...featuredVoices, ...naturalOnlineVoices, ...localVoices];
}

export function chooseLiroVoice<T extends VoiceCandidate>(
  voices: readonly T[],
  preferredVoice = AUTO_VOICE_NAME,
  language = 'fr-FR',
): T | undefined {
  const allowedVoices = filterLiroVoices(voices);
  const preferred = allowedVoices.find((voice) => voice.name === preferredVoice);
  if (preferred) return preferred;
  const denise = allowedVoices.find((voice) => voice.name === DENISE_VOICE_NAME);
  if (denise) return denise;
  return (
    rankVoices(allowedVoices, language).find(
      (voice) => baseLanguage(voice.lang) === baseLanguage(language),
    ) ?? allowedVoices[0]
  );
}
