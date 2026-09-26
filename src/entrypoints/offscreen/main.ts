import { createWorker, OEM, type Worker } from 'tesseract.js';
import type { ExtensionMessage } from '../../lib/browser/messages';
import type { TextSelectionRect } from '../../models';

let worker: Worker | undefined;
let workerLanguage = '';
let activeTabId = 0;
let cancelled = false;

function progress(status: string, value: number) {
  if (!cancelled && activeTabId)
    void chrome.runtime.sendMessage({
      type: 'OCR_PROGRESS',
      progress: value,
      status,
      tabId: activeTabId,
    } satisfies ExtensionMessage);
}

async function withTimeout<T>(
  promise: Promise<T>,
  milliseconds: number,
  message: string,
): Promise<T> {
  let timer = 0;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timer = self.setTimeout(() => reject(new Error(message)), milliseconds);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function cropCapture(imageUrl: string, rect: TextSelectionRect): Promise<string> {
  const image = new Image();
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error('La capture ne peut pas être décodée.'));
    image.src = imageUrl;
  });
  const scaleX = image.naturalWidth / rect.viewportWidth;
  const scaleY = image.naturalHeight / rect.viewportHeight;
  const sx = Math.max(0, Math.round(rect.x * scaleX));
  const sy = Math.max(0, Math.round(rect.y * scaleY));
  const width = Math.min(image.naturalWidth - sx, Math.round(rect.width * scaleX));
  const height = Math.min(image.naturalHeight - sy, Math.round(rect.height * scaleY));
  if (width < 24 || height < 24)
    throw new Error('La zone choisie est trop petite. Dessinez un rectangle plus grand.');
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Le recadrage de la capture est indisponible.');
  context.drawImage(image, sx, sy, width, height, 0, 0, width, height);
  const result = canvas.toDataURL('image/png');
  canvas.width = 1;
  canvas.height = 1;
  image.src = '';
  return result;
}

async function getWorker(language: string): Promise<Worker> {
  if (worker && workerLanguage === language) return worker;
  await worker?.terminate();
  workerLanguage = language;
  worker = await createWorker(language, OEM.LSTM_ONLY, {
    workerPath: chrome.runtime.getURL('ocr/worker.min.js'),
    workerBlobURL: false,
    corePath: chrome.runtime.getURL('ocr/'),
    langPath: chrome.runtime.getURL('tessdata/'),
    logger: (message) => {
      if (cancelled || !activeTabId) return;
      void chrome.runtime.sendMessage({
        type: 'OCR_PROGRESS',
        progress: message.progress ?? 0,
        status: message.status === 'recognizing text' ? 'Reconnaissance' : 'Chargement du moteur',
        tabId: activeTabId,
      } satisfies ExtensionMessage);
    },
  });
  return worker;
}

chrome.runtime.onMessage.addListener((message: ExtensionMessage, _sender, sendResponse) => {
  if (message.type === 'OCR_PROCESS') {
    void (async () => {
      activeTabId = message.tabId;
      cancelled = false;
      try {
        progress('Recadrage de la capture', 0.02);
        const cropped = await cropCapture(message.image, message.rect);
        progress('Initialisation du moteur local', 0.04);
        const ocrWorker = await withTimeout(
          getWorker(message.language),
          30_000,
          'Le moteur OCR local ne répond pas. Rechargez l’extension puis réessayez.',
        );
        if (cancelled) return;
        const result = await withTimeout(
          ocrWorker.recognize(cropped),
          60_000,
          'La reconnaissance OCR prend trop de temps. Essayez une zone plus petite.',
        );
        if (cancelled) return;
        const text = result.data.text.trim();
        if (!text)
          throw new Error(
            'Aucun texte n’a été détecté. Essayez une zone plus nette ou plus grande.',
          );
        await chrome.runtime.sendMessage({
          type: 'OCR_RESULT',
          text,
          tabId: message.tabId,
        } satisfies ExtensionMessage);
        sendResponse({ ok: true });
      } catch (error) {
        if (!cancelled)
          await chrome.runtime.sendMessage({
            type: 'OCR_ERROR',
            message: error instanceof Error ? error.message : 'Le moteur OCR est indisponible.',
            tabId: message.tabId,
          } satisfies ExtensionMessage);
        sendResponse({ ok: false });
      }
    })();
    return true;
  }
  if (message.type === 'OCR_CANCEL') {
    cancelled = true;
    void worker?.terminate();
    worker = undefined;
    workerLanguage = '';
    sendResponse({ ok: true });
  }
  return false;
});
