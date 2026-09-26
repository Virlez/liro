import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { defineUnlistedScript } from '#imports';
import readerCss from '../styles/reader.css?inline';
import { Reader } from '../components/Reader/Reader';
import { OcrProgress } from '../components/OcrReview/OcrProgress';
import { OcrReview } from '../components/OcrReview/OcrReview';
import {
  documentFromOcr,
  extractArticleDocument,
  extractSelectionDocument,
} from '../features/extraction/extract';
import { selectArea } from '../features/ocr/selectArea';
import { loadSettings, SETTINGS_KEY, validateSettings } from '../features/settings/settings';
import type { ExtensionMessage } from '../lib/browser/messages';
import type { ReaderDocument, ReaderSettings } from '../models';

declare global {
  interface Window {
    __ligneClaireLoaded?: boolean;
  }
}

interface UiState {
  document?: ReaderDocument;
  settings?: ReaderSettings;
  autoPlay?: boolean;
  ocr?: { kind: 'progress'; progress: number; status: string } | { kind: 'review'; text: string };
  error?: string;
}

const BUNDLED_FONTS = [
  { family: 'LiroAtkinsonHyperlegible', path: 'fonts/atkinson-400.woff2', weight: '400' },
  { family: 'LiroAtkinsonHyperlegible', path: 'fonts/atkinson-700.woff2', weight: '700' },
  { family: 'LiroLexend', path: 'fonts/lexend-400.woff2', weight: '400' },
  { family: 'LiroLexend', path: 'fonts/lexend-700.woff2', weight: '700' },
  { family: 'LiroOpenDyslexic', path: 'fonts/opendyslexic-400.woff2', weight: '400' },
  { family: 'LiroOpenDyslexic', path: 'fonts/opendyslexic-700.woff2', weight: '700' },
] as const;

async function installBundledFonts(): Promise<void> {
  await Promise.allSettled(
    BUNDLED_FONTS.map(async ({ family, path, weight }) => {
      const response = await fetch(chrome.runtime.getURL(path));
      if (!response.ok) throw new Error(`Impossible de charger ${path}.`);
      const face = new FontFace(family, await response.arrayBuffer(), {
        style: 'normal',
        weight,
      });
      document.fonts.add(await face.load());
    }),
  );
}

export default defineUnlistedScript(() => {
  if (window.__ligneClaireLoaded) return;
  window.__ligneClaireLoaded = true;
  void installBundledFonts();
  let previouslyFocused = document.activeElement as HTMLElement | null;
  const host = document.createElement('div');
  host.id = 'ligneclaire-root';
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = readerCss;
  const app = document.createElement('div');
  shadow.append(style, app);
  document.documentElement.append(host);
  let root: Root | undefined;
  let state: UiState = {};

  const closeUi = () => {
    root?.unmount();
    root = undefined;
    state = {};
    app.replaceChildren();
    previouslyFocused?.focus();
  };
  const render = () => {
    root ??= createRoot(app);
    if (state.document && state.settings) {
      root.render(
        <Reader
          key={`${state.document.id}-${state.autoPlay ? 'speech' : 'reader'}`}
          document={state.document}
          initialSettings={state.settings}
          {...(state.autoPlay === undefined ? {} : { autoPlay: state.autoPlay })}
          onClose={closeUi}
        />,
      );
    } else if (state.ocr?.kind === 'progress') {
      root.render(
        <OcrProgress
          progress={state.ocr.progress}
          status={state.ocr.status}
          onCancel={() => {
            void chrome.runtime.sendMessage({ type: 'OCR_CANCEL' } satisfies ExtensionMessage);
            closeUi();
          }}
        />,
      );
    } else if (state.ocr?.kind === 'review') {
      root.render(
        <OcrReview
          initialText={state.ocr.text}
          onCancel={closeUi}
          onRetry={() => void startScan()}
          onOpen={(text) => {
            void (async () => {
              state = {
                document: documentFromOcr(text),
                settings: state.settings ?? (await loadSettings()),
              };
              render();
            })();
          }}
        />,
      );
    } else if (state.error) {
      root.render(
        <div className="error-panel" role="alert">
          {state.error}
          <button type="button" onClick={closeUi} aria-label="Fermer">
            ×
          </button>
        </div>,
      );
    } else root.render(<></>);
  };
  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local' || !changes[SETTINGS_KEY] || !state.document) return;
    state = {
      ...state,
      settings: validateSettings(changes[SETTINGS_KEY].newValue),
    };
    render();
  });
  const showDocument = async (
    readerDocument: ReaderDocument | null,
    fallback: string,
    autoPlay = false,
  ) => {
    previouslyFocused = document.activeElement as HTMLElement | null;
    if (!readerDocument?.blocks.length) {
      state = { error: fallback };
      render();
      return;
    }
    state = { document: readerDocument, settings: await loadSettings(), autoPlay };
    render();
  };
  const startScan = async () => {
    closeUi();
    const rect = await selectArea();
    if (!rect) return;
    state = {
      settings: await loadSettings(),
    };
    // Keep the page completely unobstructed until captureVisibleTab has run.
    // The offscreen worker emits OCR_PROGRESS only after the clean screenshot exists.
    await chrome.runtime.sendMessage({
      type: 'OCR_CAPTURE_REQUEST',
      rect,
    } satisfies ExtensionMessage);
  };

  chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
    if (message.type === 'GET_SELECTION_STATE') {
      sendResponse({ available: Boolean(window.getSelection()?.toString().trim()) });
      return false;
    }
    if (message.type === 'OPEN_SELECTION') {
      try {
        void showDocument(
          extractSelectionDocument(),
          'Aucun texte sélectionné. Sélectionnez du texte sur la page, puis réessayez.',
          message.autoPlay,
        );
      } catch (error) {
        state = {
          error: error instanceof Error ? error.message : 'Impossible de lire cette sélection.',
        };
        render();
      }
      sendResponse({ ok: true });
      return false;
    }
    if (message.type === 'OPEN_ARTICLE') {
      void showDocument(
        extractArticleDocument(),
        'Aucun contenu principal exploitable. Sélectionnez du texte ou utilisez « Scanner une zone ».',
        message.autoPlay,
      );
      sendResponse({ ok: true });
      return false;
    }
    if (message.type === 'START_OCR_SELECTION') {
      void startScan();
      sendResponse({ ok: true });
      return false;
    }
    if (message.type === 'OCR_PROGRESS') {
      state = {
        ...state,
        ocr: { kind: 'progress', progress: message.progress, status: message.status },
      };
      render();
    }
    if (message.type === 'OCR_RESULT') {
      state = { ...state, ocr: { kind: 'review', text: message.text } };
      render();
    }
    if (message.type === 'OCR_ERROR' || message.type === 'SHOW_ERROR') {
      state = { error: message.message, ...(state.settings ? { settings: state.settings } : {}) };
      render();
    }
    return false;
  });
});
