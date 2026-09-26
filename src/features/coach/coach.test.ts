import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../settings/settings';
import { COACH_COOLDOWN_MS, evaluateCoach, rescueSuggestion } from './coach';

describe('coach explicable', () => {
  it('attend deux retours en 90 secondes et propose le guide en premier', () => {
    expect(
      evaluateCoach({
        backwardEvents: [1_000],
        now: 2_000,
        alreadySuggested: [],
        settings: DEFAULT_SETTINGS,
      }),
    ).toBeUndefined();
    expect(
      evaluateCoach({
        backwardEvents: [1_000, 2_000],
        now: 2_000,
        alreadySuggested: [],
        settings: DEFAULT_SETTINGS,
      })?.kind,
    ).toBe('guide');
  });

  it('respecte le délai, les suggestions déjà faites et le refus permanent', () => {
    const base = {
      backwardEvents: [8_000, 9_000],
      now: 10_000,
      settings: DEFAULT_SETTINGS,
    };
    expect(
      evaluateCoach({ ...base, lastSuggestedAt: 9_000, alreadySuggested: [] }),
    ).toBeUndefined();
    expect(
      evaluateCoach({
        ...base,
        lastSuggestedAt: 10_000 - COACH_COOLDOWN_MS,
        alreadySuggested: ['guide'],
      }),
    ).toBeUndefined();
    expect(
      evaluateCoach({
        ...base,
        settings: { ...DEFAULT_SETTINGS, coachDismissed: ['guide'] },
        alreadySuggested: [],
      }),
    ).toBeUndefined();
  });

  it('enchaîne guide, blocs courts puis audio selon les préférences', () => {
    expect(rescueSuggestion(DEFAULT_SETTINGS).kind).toBe('guide');
    expect(rescueSuggestion({ ...DEFAULT_SETTINGS, guideEnabled: true }).kind).toBe(
      'shorter-chunks',
    );
    expect(
      rescueSuggestion({ ...DEFAULT_SETTINGS, guideEnabled: true, chunkSize: 'short' }).kind,
    ).toBe('audio');
  });
});
