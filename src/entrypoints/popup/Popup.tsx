import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { BrandMark } from '../../components/BrandMark';
import { clearReadingProgress } from '../../features/progress/progress';
import { loadSettings, saveSettings } from '../../features/settings/settings';
import type { ActionResponse, ExtensionMessage, PopupAction } from '../../lib/browser/messages';
import { trapTabKey } from '../../lib/accessibility/focus';
import type { ReaderSettings } from '../../models';

export function Popup() {
  const [busy, setBusy] = useState<PopupAction>();
  const [selectionAvailable, setSelectionAvailable] = useState(false);
  const [error, setError] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<ReaderSettings>();
  const shellRef = useRef<HTMLElement>(null);
  const startButtonRef = useRef<HTMLButtonElement>(null);
  const settingsButtonRef = useRef<HTMLButtonElement>(null);
  const primaryAction: PopupAction = selectionAvailable ? 'selection' : 'article';

  useEffect(() => {
    startButtonRef.current?.focus({ preventScroll: true });
    void Promise.all([
      chrome.runtime.sendMessage({ type: 'QUERY_SELECTION' } satisfies ExtensionMessage),
      loadSettings(),
    ])
      .then(([response, loaded]: [ActionResponse, ReaderSettings]) => {
        setSelectionAvailable(response.selectionAvailable ?? false);
        setSettings(loaded);
      })
      .catch(() => undefined);
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      if (settingsOpen) {
        setSettingsOpen(false);
        requestAnimationFrame(() => settingsButtonRef.current?.focus());
      } else window.close();
      return;
    }
    trapTabKey(event, shellRef.current);
  };

  const updateSetting = async <K extends keyof ReaderSettings>(
    key: K,
    value: ReaderSettings[K],
  ) => {
    if (!settings) return;
    const next = { ...settings, [key]: value };
    setSettings(next);
    await saveSettings(next);
  };

  const run = async (action: PopupAction, autoPlay = false) => {
    setBusy(action);
    setError('');
    try {
      const response: ActionResponse = await chrome.runtime.sendMessage({
        type: 'RUN_ACTION',
        action,
        autoPlay,
      } satisfies ExtensionMessage);
      if (!response.ok) throw new Error(response.message ?? 'Cette action est indisponible.');
      window.close();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Impossible de lancer la lecture.');
      setBusy(undefined);
    }
  };

  return (
    <main ref={shellRef} className="popup-shell" tabIndex={-1} onKeyDown={onKeyDown}>
      <div className="ambient ambient-one" aria-hidden="true" />
      <div className="ambient ambient-two" aria-hidden="true" />
      <header className="brand-header">
        <div className="logo" aria-hidden="true">
          <BrandMark />
        </div>
        <div className="wordmark">
          <p>Liro</p>
          <small>Lecture adaptative</small>
        </div>
      </header>

      <section className="hero" aria-labelledby="popup-title">
        <p className="product-kicker">Le web, enfin à ton rythme</p>
        <h1 id="popup-title">
          Garde le fil.
          <br />
          <span>Va au bout.</span>
        </h1>
        <p className="promise">Une page à la fois, sans bruit et sans pression.</p>
      </section>

      <button
        ref={startButtonRef}
        type="button"
        className="start-button"
        disabled={Boolean(busy)}
        onClick={() => void run(primaryAction)}
      >
        <span>
          <strong>Lancer ma lecture</strong>
          <small>
            {selectionAvailable
              ? 'Avec le passage sélectionné'
              : 'Avec le contenu principal de cette page'}
          </small>
        </span>
        <span className="start-icon" aria-hidden="true">
          →
        </span>
      </button>

      <div className="secondary-actions">
        <button
          type="button"
          className="speech-action"
          disabled={Boolean(busy)}
          onClick={() => void run(primaryAction, true)}
        >
          <span aria-hidden="true">▶</span>
          <span>
            <strong>Lire à voix haute</strong>
            <small>Ouvrir Liro et démarrer avec ma voix</small>
          </span>
        </button>
        {selectionAvailable && (
          <button type="button" disabled={Boolean(busy)} onClick={() => void run('article')}>
            <span aria-hidden="true">≡</span>
            <span>
              <strong>Page entière</strong>
              <small>Extraire le contenu principal</small>
            </span>
          </button>
        )}
        <button type="button" disabled={Boolean(busy)} onClick={() => void run('scan')}>
          <span aria-hidden="true">⌗</span>
          <span>
            <strong>Scanner une zone</strong>
            <small>Image, PDF ou texte inaccessible</small>
          </span>
        </button>
      </div>

      <section className="flow-preview" aria-label="Parcours Liro">
        <span>
          <b>1</b> Adapter
        </span>
        <i aria-hidden="true" />
        <span>
          <b>2</b> Suivre
        </span>
        <i aria-hidden="true" />
        <span>
          <b>3</b> Finir
        </span>
      </section>

      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}

      <button
        ref={settingsButtonRef}
        className="settings-link"
        type="button"
        aria-expanded={settingsOpen}
        aria-controls="quick-settings"
        onClick={() => setSettingsOpen((open) => !open)}
      >
        {settingsOpen ? 'Masquer les préférences' : 'Préférences rapides'}
      </button>
      {settingsOpen && settings && (
        <section id="quick-settings" className="quick-settings" aria-label="Préférences rapides">
          <label>
            Police de lecture
            <select
              value={settings.fontFamily}
              onChange={(event) =>
                void updateSetting('fontFamily', event.target.value as ReaderSettings['fontFamily'])
              }
            >
              <option value="atkinson">Atkinson Hyperlegible</option>
              <option value="lexend">Lexend</option>
              <option value="opendyslexic">OpenDyslexic</option>
              <option value="system">Système</option>
            </select>
          </label>
          <label>
            Thème
            <select
              value={settings.theme}
              onChange={(event) =>
                void updateSetting('theme', event.target.value as ReaderSettings['theme'])
              }
            >
              <option value="light">Clair</option>
              <option value="cream">Crème</option>
              <option value="dark">Sombre</option>
            </select>
          </label>
          <label>
            Langue OCR
            <select
              value={settings.ocrLanguage}
              onChange={(event) =>
                void updateSetting(
                  'ocrLanguage',
                  event.target.value as ReaderSettings['ocrLanguage'],
                )
              }
            >
              <option value="fra">Français</option>
              <option value="eng">Anglais</option>
              <option value="fra+eng">Français + anglais</option>
            </select>
          </label>
          <label className="popup-check">
            <input
              type="checkbox"
              checked={settings.progressEnabled}
              onChange={(event) => void updateSetting('progressEnabled', event.target.checked)}
            />
            Retrouver ma dernière étape
          </label>
          <button
            type="button"
            className="clear-history"
            onClick={() => void clearReadingProgress()}
          >
            Effacer les reprises
          </button>
        </section>
      )}
      <footer>
        <span aria-hidden="true">●</span> Tes textes restent sur cet appareil
      </footer>
    </main>
  );
}
