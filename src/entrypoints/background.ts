import { defineBackground } from '#imports';
import { loadSettings } from '../features/settings/settings';
import type { ActionResponse, ExtensionMessage, PopupAction } from '../lib/browser/messages';

const PROTECTED_PROTOCOLS = ['chrome:', 'edge:', 'about:', 'devtools:'];

async function activeTab(): Promise<chrome.tabs.Tab> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('Aucun onglet actif accessible.');
  const url = tab.url ? new URL(tab.url) : null;
  if (
    !url ||
    PROTECTED_PROTOCOLS.includes(url.protocol) ||
    url.hostname === 'chromewebstore.google.com'
  ) {
    throw new Error(
      'Chrome interdit les extensions sur cette page. Ouvrez une page web classique.',
    );
  }
  return tab;
}

async function ensureInjected(tabId: number): Promise<void> {
  try {
    await chrome.tabs.sendMessage(tabId, {
      type: 'GET_SELECTION_STATE',
    } satisfies ExtensionMessage);
  } catch {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['injected.js'] });
  }
}

async function sendAction(action: PopupAction, autoPlay = false): Promise<ActionResponse> {
  try {
    const tab = await activeTab();
    await ensureInjected(tab.id!);
    const types = {
      selection: 'OPEN_SELECTION',
      article: 'OPEN_ARTICLE',
      scan: 'START_OCR_SELECTION',
    } as const;
    await chrome.tabs.sendMessage(tab.id!, {
      type: types[action],
      ...(action === 'scan' ? {} : { autoPlay }),
    } satisfies ExtensionMessage);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Impossible d’ouvrir Liro dans cette page.',
    };
  }
}

async function sendContextualReader(autoPlay: boolean): Promise<ActionResponse> {
  try {
    const tab = await activeTab();
    await ensureInjected(tab.id!);
    const selection: { available: boolean } = await chrome.tabs.sendMessage(tab.id!, {
      type: 'GET_SELECTION_STATE',
    } satisfies ExtensionMessage);
    await chrome.tabs.sendMessage(tab.id!, {
      type: selection.available ? 'OPEN_SELECTION' : 'OPEN_ARTICLE',
      autoPlay,
    } satisfies ExtensionMessage);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Impossible d’ouvrir Liro dans cette page.',
    };
  }
}

async function ensureOffscreenDocument(): Promise<void> {
  const offscreenUrl = chrome.runtime.getURL('offscreen.html');
  const contexts = await chrome.runtime.getContexts({
    contextTypes: [chrome.runtime.ContextType.OFFSCREEN_DOCUMENT],
    documentUrls: [offscreenUrl],
  });
  if (contexts.length) return;
  await chrome.offscreen.createDocument({
    url: 'offscreen.html',
    reasons: [chrome.offscreen.Reason.WORKERS],
    justification:
      'Exécuter localement le worker OCR Tesseract sur la capture choisie par l’utilisateur.',
  });
}

export default defineBackground(() => {
  chrome.runtime.onMessage.addListener((message: ExtensionMessage, sender, sendResponse) => {
    if (message.type === 'RUN_ACTION') {
      void sendAction(message.action, message.autoPlay).then(sendResponse);
      return true;
    }
    if (message.type === 'QUERY_SELECTION') {
      void (async () => {
        try {
          const tab = await activeTab();
          await ensureInjected(tab.id!);
          const response: { available: boolean } = await chrome.tabs.sendMessage(tab.id!, {
            type: 'GET_SELECTION_STATE',
          } satisfies ExtensionMessage);
          sendResponse({
            ok: true,
            selectionAvailable: response.available,
          } satisfies ActionResponse);
        } catch (error) {
          sendResponse({
            ok: false,
            selectionAvailable: false,
            message: error instanceof Error ? error.message : 'Page inaccessible.',
          } satisfies ActionResponse);
        }
      })();
      return true;
    }
    if (message.type === 'OCR_CAPTURE_REQUEST') {
      void (async () => {
        try {
          const tab = await activeTab();
          if (sender.tab?.id && sender.tab.id !== tab.id)
            throw new Error('L’onglet actif a changé. Revenez à la page et relancez le scan.');
          if (!tab.windowId) throw new Error('Fenêtre introuvable.');
          const image = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
          const settings = await loadSettings();
          await ensureOffscreenDocument();
          await chrome.runtime.sendMessage({
            type: 'OCR_PROCESS',
            image,
            rect: message.rect,
            language: settings.ocrLanguage,
            tabId: tab.id!,
          } satisfies ExtensionMessage);
          sendResponse({ ok: true });
        } catch (error) {
          const tabId = sender.tab?.id;
          if (tabId)
            await chrome.tabs.sendMessage(tabId, {
              type: 'OCR_ERROR',
              message: error instanceof Error ? error.message : 'La capture a échoué.',
              tabId,
            } satisfies ExtensionMessage);
          sendResponse({ ok: false });
        }
      })();
      return true;
    }
    if (
      message.type === 'OCR_PROGRESS' ||
      message.type === 'OCR_RESULT' ||
      message.type === 'OCR_ERROR'
    ) {
      if (!sender.tab && message.tabId)
        void chrome.tabs.sendMessage(message.tabId, message).catch(() => undefined);
    }
    return false;
  });

  chrome.commands.onCommand.addListener((command) => {
    if (command === 'open-reader') void sendContextualReader(false);
    if (command === 'open-reader-speech') void sendContextualReader(true);
  });
});
