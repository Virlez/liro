import type { CoachSuggestion, CoachSuggestionKind, ReaderSettings } from '../../models';

export const COACH_BACKTRACK_WINDOW_MS = 90_000;
export const COACH_COOLDOWN_MS = 5 * 60_000;

const SUGGESTIONS: Record<CoachSuggestionKind, CoachSuggestion> = {
  guide: {
    kind: 'guide',
    title: 'Garder ce passage en vue',
    reason:
      'Tu es revenu plusieurs fois en arrière. Un repère visuel peut aider à retrouver le fil.',
    actionLabel: 'Essayer le guide',
  },
  'shorter-chunks': {
    kind: 'shorter-chunks',
    title: 'Réduire la prochaine étape',
    reason: 'Tu es revenu plusieurs fois sur ce passage. Des blocs plus courts peuvent l’alléger.',
    actionLabel: 'Raccourcir les blocs',
  },
  audio: {
    kind: 'audio',
    title: 'Écouter ce passage',
    reason:
      'Tu es revenu plusieurs fois sur ce passage. Tu peux changer de canal sans perdre ta place.',
    actionLabel: 'Écouter maintenant',
  },
};

export interface CoachEvaluation {
  backwardEvents: number[];
  now: number;
  lastSuggestedAt?: number;
  alreadySuggested: CoachSuggestionKind[];
  settings: ReaderSettings;
}

export function preferredSuggestion(settings: ReaderSettings): CoachSuggestionKind {
  if (!settings.guideEnabled) return 'guide';
  if (settings.chunkSize !== 'short') return 'shorter-chunks';
  return 'audio';
}

export function evaluateCoach(input: CoachEvaluation): CoachSuggestion | undefined {
  if (!input.settings.coachEnabled) return undefined;
  const recent = input.backwardEvents.filter(
    (time) => input.now - time <= COACH_BACKTRACK_WINDOW_MS,
  );
  if (recent.length < 2) return undefined;
  if (input.lastSuggestedAt && input.now - input.lastSuggestedAt < COACH_COOLDOWN_MS)
    return undefined;
  const kind = preferredSuggestion(input.settings);
  if (input.alreadySuggested.includes(kind) || input.settings.coachDismissed.includes(kind))
    return undefined;
  return SUGGESTIONS[kind];
}

export function rescueSuggestion(settings: ReaderSettings): CoachSuggestion {
  return SUGGESTIONS[preferredSuggestion(settings)];
}
