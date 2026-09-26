import { useEffect, useRef, useState } from 'react';
import { clearReadingProgress } from '../../features/progress/progress';
import { AUTO_VOICE_NAME, DENISE_VOICE_NAME, HENRI_VOICE_NAME } from '../../features/speech/voices';
import type { ReaderSettings } from '../../models';

interface Props {
  settings: ReaderSettings;
  voices: SpeechSynthesisVoice[];
  onChange: (next: ReaderSettings) => void;
  onPreviewVoice: () => void;
  onRecalibrate: () => void;
  onClose: () => void;
}

export function SettingsPanel({
  settings,
  voices,
  onChange,
  onPreviewVoice,
  onRecalibrate,
  onClose,
}: Props) {
  const [historyCleared, setHistoryCleared] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const naturalOnlineVoices = voices.filter((voice) => !voice.localService);
  const localVoices = voices.filter(
    (voice) =>
      voice.localService && voice.name !== DENISE_VOICE_NAME && voice.name !== HENRI_VOICE_NAME,
  );
  const selectedVoice =
    voices.find((voice) => voice.name === settings.preferredVoice)?.name ?? AUTO_VOICE_NAME;
  const patch = <K extends keyof ReaderSettings>(key: K, value: ReaderSettings[K]) =>
    onChange({ ...settings, [key]: value });

  const clearProgress = async () => {
    await clearReadingProgress();
    setHistoryCleared(true);
  };

  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <aside
      id="settings-panel"
      className="settings-panel"
      role="dialog"
      aria-modal="true"
      aria-label="Réglages de lecture"
    >
      <div className="settings-heading">
        <div>
          <p className="eyebrow">Selon tes préférences</p>
          <h2 ref={titleRef} id="settings-title" tabIndex={-1}>
            Réglages
          </h2>
        </div>
        <button type="button" onClick={onClose} aria-label="Fermer les réglages">
          ×
        </button>
      </div>

      <section className="settings-live-preview" aria-label="Aperçu en direct">
        <p>
          <span aria-hidden="true">●</span> Aperçu en direct
        </p>
        <div
          style={{
            fontSize: settings.fontSize,
            lineHeight: settings.lineHeight,
            letterSpacing: `${settings.letterSpacing}em`,
            wordSpacing: `${settings.wordSpacing}em`,
          }}
        >
          Lire devient plus simple quand chaque idée trouve sa place.
        </div>
      </section>

      <fieldset>
        <legend>Rythme de lecture</legend>
        <label>
          Taille des étapes
          <select
            value={settings.chunkSize}
            onChange={(event) =>
              patch('chunkSize', event.target.value as ReaderSettings['chunkSize'])
            }
          >
            <option value="short">Courtes</option>
            <option value="balanced">Équilibrées</option>
            <option value="long">Longues</option>
          </select>
        </label>
        <label>
          Contexte autour du passage
          <select
            value={settings.contextLevel}
            onChange={(event) =>
              patch('contextLevel', event.target.value as ReaderSettings['contextLevel'])
            }
          >
            <option value="minimal">Aucun</option>
            <option value="previous">Avant et après</option>
            <option value="surrounding">Avant et après, renforcé</option>
          </select>
        </label>
        <label className="check-setting">
          <input
            type="checkbox"
            checked={settings.coachEnabled}
            onChange={(event) => patch('coachEnabled', event.target.checked)}
          />
          Proposer une aide après des retours répétés
        </label>
        <label className="check-setting">
          <input
            type="checkbox"
            checked={settings.encouragementsEnabled}
            onChange={(event) => patch('encouragementsEnabled', event.target.checked)}
          />
          Encourager ma progression sur les textes longs
        </label>
        <label className="check-setting">
          <input
            type="checkbox"
            checked={settings.progressEnabled}
            onChange={(event) => patch('progressEnabled', event.target.checked)}
          />
          Mémoriser localement où reprendre
        </label>
        <button type="button" className="secondary-action" onClick={() => void clearProgress()}>
          Effacer toutes les reprises
        </button>
        {historyCleared && (
          <p className="setting-confirmation" role="status">
            Les reprises ont été effacées.
          </p>
        )}
      </fieldset>

      <fieldset>
        <legend>Décodage</legend>
        <label>
          Police
          <select
            aria-label="Police"
            value={settings.fontFamily}
            onChange={(event) =>
              patch('fontFamily', event.target.value as ReaderSettings['fontFamily'])
            }
          >
            <option value="atkinson">Atkinson Hyperlegible</option>
            <option value="lexend">Lexend</option>
            <option value="opendyslexic">OpenDyslexic</option>
            <option value="system">Système</option>
          </select>
        </label>
        <label>
          Taille : {settings.fontSize} px
          <input
            type="range"
            aria-label="Taille du texte"
            min="16"
            max="32"
            value={settings.fontSize}
            onChange={(event) => patch('fontSize', Number(event.target.value))}
          />
        </label>
        <label>
          Interligne : {settings.lineHeight.toFixed(2)}
          <input
            type="range"
            min="1.3"
            max="2"
            step="0.05"
            value={settings.lineHeight}
            onChange={(event) => patch('lineHeight', Number(event.target.value))}
          />
        </label>
        <label>
          Largeur : {settings.columnWidth} px
          <input
            type="range"
            min="480"
            max="1000"
            step="20"
            value={settings.columnWidth}
            onChange={(event) => patch('columnWidth', Number(event.target.value))}
          />
        </label>
        <label>
          Espacement des lettres : {settings.letterSpacing.toFixed(2)} em
          <input
            type="range"
            min="0"
            max="0.2"
            step="0.01"
            value={settings.letterSpacing}
            onChange={(event) => patch('letterSpacing', Number(event.target.value))}
          />
        </label>
        <label>
          Espacement des mots : {settings.wordSpacing.toFixed(2)} em
          <input
            type="range"
            min="0"
            max="0.6"
            step="0.04"
            value={settings.wordSpacing}
            onChange={(event) => patch('wordSpacing', Number(event.target.value))}
          />
        </label>
        <label className="check-setting">
          <input
            type="checkbox"
            checked={settings.visualAnchorsEnabled}
            onChange={(event) => patch('visualAnchorsEnabled', event.target.checked)}
          />
          Renforcer le début des mots
        </label>
        <label className="check-setting">
          <input
            type="checkbox"
            checked={settings.guideEnabled}
            onChange={(event) => patch('guideEnabled', event.target.checked)}
          />
          Activer le repère visuel
        </label>
        <label>
          Type de repère
          <select
            value={settings.guideMode}
            onChange={(event) =>
              patch('guideMode', event.target.value as ReaderSettings['guideMode'])
            }
          >
            <option value="paragraph">Paragraphe</option>
            <option value="line">Ligne déplaçable</option>
          </select>
        </label>
        <button type="button" className="secondary-action" onClick={onRecalibrate}>
          Refaire le réglage visuel
        </button>
      </fieldset>

      <fieldset>
        <legend>Ambiance et voix</legend>
        <label>
          Thème
          <select
            value={settings.theme}
            onChange={(event) => patch('theme', event.target.value as ReaderSettings['theme'])}
          >
            <option value="light">Clair</option>
            <option value="cream">Crème</option>
            <option value="dark">Sombre</option>
          </select>
        </label>
        <label>
          Vitesse vocale : {settings.speechRate.toFixed(1)}×
          <input
            type="range"
            min="0.6"
            max="2"
            step="0.1"
            value={settings.speechRate}
            onChange={(event) => patch('speechRate', Number(event.target.value))}
          />
        </label>
        <label>
          Voix
          <select
            value={selectedVoice}
            onChange={(event) => patch('preferredVoice', event.target.value)}
          >
            <option value={AUTO_VOICE_NAME}>Automatique — meilleure voix disponible</option>
            {naturalOnlineVoices.length > 0 && (
              <optgroup label="Voix naturelles en ligne">
                {naturalOnlineVoices.map((voice) => (
                  <option key={voice.name} value={voice.name}>
                    {voice.name} — {voice.lang}
                  </option>
                ))}
              </optgroup>
            )}
            {localVoices.length > 0 && (
              <optgroup label="Voix locales de cet appareil">
                {localVoices.map((voice) => (
                  <option key={voice.name} value={voice.name}>
                    {voice.name} — {voice.lang}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
        </label>
        <button type="button" className="secondary-action" onClick={onPreviewVoice}>
          Écouter un exemple
        </button>
        <label>
          Langue OCR
          <select
            value={settings.ocrLanguage}
            onChange={(event) =>
              patch('ocrLanguage', event.target.value as ReaderSettings['ocrLanguage'])
            }
          >
            <option value="fra">Français</option>
            <option value="eng">Anglais</option>
            <option value="fra+eng">Français + anglais</option>
          </select>
        </label>
      </fieldset>

      <p className="settings-disclaimer">
        Ces options peuvent faciliter le confort de lecture selon tes préférences. Elles ne
        constituent pas un traitement médical.
      </p>
    </aside>
  );
}
