import { describe, expect, it } from 'vitest';
import {
  AUTO_VOICE_NAME,
  chooseBestLocalVoice,
  chooseLiroVoice,
  DENISE_VOICE_NAME,
  filterLiroVoices,
  HENRI_VOICE_NAME,
  rankVoices,
  voiceScore,
  type VoiceCandidate,
} from './voices';

const voice = (input: Partial<VoiceCandidate> & Pick<VoiceCandidate, 'name'>): VoiceCandidate => ({
  name: input.name,
  lang: input.lang ?? 'fr-FR',
  localService: input.localService ?? true,
  default: input.default ?? false,
});

describe('sélection des voix', () => {
  it('préfère une voix française naturelle locale à une voix standard', () => {
    const standard = voice({ name: 'Voix française standard', default: true });
    const natural = voice({ name: 'Voix française Natural' });
    expect(chooseBestLocalVoice([standard, natural], 'fr-FR')).toBe(natural);
  });

  it('ne choisit pas automatiquement une voix nécessitant un service distant', () => {
    const remote = voice({ name: 'French Neural Online', localService: false });
    expect(chooseBestLocalVoice([remote], 'fr-FR')).toBeUndefined();
  });

  it('préfère la langue demandée et garde un ordre stable à score égal', () => {
    const english = voice({ name: 'English Natural', lang: 'en-US' });
    const frenchFirst = voice({ name: 'Français A' });
    const frenchSecond = voice({ name: 'Français B' });
    expect(rankVoices([english, frenchFirst, frenchSecond], 'fr-FR')).toEqual([
      frenchFirst,
      frenchSecond,
      english,
    ]);
    expect(voiceScore(frenchFirst, 'fr-FR')).toBeGreaterThan(voiceScore(english, 'fr-FR'));
  });

  it('présente les voix françaises naturelles puis les voix locales', () => {
    const henri = voice({ name: HENRI_VOICE_NAME, localService: false });
    const google = voice({ name: 'Google français', localService: false });
    const remoteStandard = voice({ name: 'Voix française en ligne', localService: false });
    const local = voice({ name: 'Voix locale du système', localService: true });
    const denise = voice({ name: DENISE_VOICE_NAME, localService: false });
    expect(filterLiroVoices([henri, google, remoteStandard, local, denise])).toEqual([
      denise,
      henri,
      google,
      local,
    ]);
  });

  it('utilise Denise par défaut et respecte le choix de Henri', () => {
    const denise = voice({ name: DENISE_VOICE_NAME, localService: false });
    const henri = voice({ name: HENRI_VOICE_NAME, localService: false });
    expect(chooseLiroVoice([henri, denise])).toBe(denise);
    expect(chooseLiroVoice([henri, denise], HENRI_VOICE_NAME)).toBe(henri);
  });

  it('respecte une voix locale choisie', () => {
    const denise = voice({ name: DENISE_VOICE_NAME, localService: false });
    const local = voice({ name: 'Voix locale du système', localService: true });
    expect(chooseLiroVoice([denise, local], local.name)).toBe(local);
  });

  it('choisit une voix naturelle française adaptée quand Denise est absente', () => {
    const google = voice({ name: 'Google français', localService: false });
    const localStandard = voice({ name: 'Voix locale standard' });
    expect(chooseLiroVoice([localStandard, google], AUTO_VOICE_NAME)).toBe(google);
  });
});
