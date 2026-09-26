import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  SETTINGS_KEY,
  loadSettings,
  saveSettings,
  validateSettings,
} from './settings';
import { AUTO_VOICE_NAME, HENRI_VOICE_NAME } from '../speech/voices';

describe('réglages', () => {
  it('fournit les valeurs par défaut', () =>
    expect(validateSettings(undefined)).toEqual(DEFAULT_SETTINGS));

  it('borne les valeurs invalides et migre une ancienne structure', () => {
    const result = validateSettings({
      version: 0,
      fontSize: 99,
      lineHeight: 0,
      columnWidth: 20,
      speechRate: 8,
      theme: 'inconnu',
    });
    expect(result.fontSize).toBe(32);
    expect(result.lineHeight).toBe(1.3);
    expect(result.columnWidth).toBe(480);
    expect(result.speechRate).toBe(2);
    expect(result.version).toBe(2);
    expect(result.theme).toBe(DEFAULT_SETTINGS.theme);
    expect(result.calibrationCompleted).toBe(false);
    expect(result.chunkSize).toBe('balanced');
    expect(result.encouragementsEnabled).toBe(true);
  });

  it('sauvegarde et restaure les préférences', async () => {
    await saveSettings({ ...DEFAULT_SETTINGS, fontSize: 27, theme: 'dark' });
    expect(await loadSettings()).toMatchObject({ fontSize: 27, theme: 'dark' });
    expect((await chrome.storage.local.get(SETTINGS_KEY))[SETTINGS_KEY]).toBeDefined();
  });

  it('accepte OpenDyslexic comme préférence optionnelle', () => {
    expect(validateSettings({ fontFamily: 'opendyslexic' }).fontFamily).toBe('opendyslexic');
  });

  it('utilise la sélection multi-navigateur par défaut et conserve un choix manuel', () => {
    expect(validateSettings(undefined).preferredVoice).toBe(AUTO_VOICE_NAME);
    expect(validateSettings({ preferredVoice: HENRI_VOICE_NAME }).preferredVoice).toBe(
      HENRI_VOICE_NAME,
    );
    expect(validateSettings({ preferredVoice: 'Voix locale du système' }).preferredVoice).toBe(
      'Voix locale du système',
    );
  });

  it('valide les nouveaux réglages Flow et filtre les exclusions du coach', () => {
    expect(
      validateSettings({
        version: 2,
        calibrationCompleted: true,
        chunkSize: 'short',
        contextLevel: 'minimal',
        coachDismissed: ['guide', 'inconnu'],
        progressEnabled: false,
        encouragementsEnabled: false,
      }),
    ).toMatchObject({
      version: 2,
      calibrationCompleted: true,
      chunkSize: 'short',
      contextLevel: 'minimal',
      coachDismissed: ['guide'],
      progressEnabled: false,
      encouragementsEnabled: false,
    });
  });
});
