import {
  chromium,
  expect,
  test,
  type BrowserContext,
  type Page,
  type Worker,
} from '@playwright/test';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

let context: BrowserContext;
let worker: Worker;
let extensionId: string;
let page: Page;

async function runInjectedAction(
  action: 'OPEN_SELECTION' | 'OPEN_ARTICLE' | 'START_OCR_SELECTION',
) {
  await page.bringToFront();
  await worker.evaluate(async (messageType) => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error('Onglet de fixture introuvable');
    try {
      await chrome.tabs.sendMessage(tab.id, { type: 'GET_SELECTION_STATE' });
    } catch {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['injected.js'] });
    }
    await chrome.tabs.sendMessage(tab.id, { type: messageType });
  }, action);
}

test.beforeAll(async () => {
  const extensionPath = resolve('.output/chrome-mv3');
  const userDataDir = await mkdtemp(join(tmpdir(), 'ligneclaire-e2e-'));
  context = await chromium.launchPersistentContext(userDataDir, {
    headless: true,
    channel: 'chromium',
    args: [`--disable-extensions-except=${extensionPath}`, `--load-extension=${extensionPath}`],
  });
  worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  extensionId = new URL(worker.url()).host;
  page = context.pages()[0] ?? (await context.newPage());
});

test.afterAll(async () => {
  await context?.close();
});

test('le popup expose la nouvelle marque et les actions contextuelles', async () => {
  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await expect(popup.locator('.wordmark')).toContainText('Liro');
  await expect(popup.getByText('LigneClaire')).toHaveCount(0);
  await expect(popup.getByRole('heading', { name: 'Garde le fil. Va au bout.' })).toBeVisible();
  await expect(popup.getByRole('button', { name: /Lancer ma lecture/ })).toBeVisible();
  await expect(popup.getByRole('button', { name: /Lancer ma lecture/ })).toBeFocused();
  await expect(popup.getByRole('button', { name: /Lire à voix haute/ })).toBeVisible();
  await expect(popup.locator('.logo svg')).toBeVisible();
  await expect(popup.getByRole('button', { name: /Scanner une zone/ })).toBeVisible();
  await popup.getByRole('button', { name: 'Préférences rapides' }).click();
  await expect(popup.getByLabel('Préférences rapides')).toBeVisible();
  await popup.keyboard.press('Escape');
  await expect(popup.getByLabel('Préférences rapides')).toHaveCount(0);
  await expect(popup.getByRole('button', { name: 'Préférences rapides' })).toBeFocused();
  await popup.getByRole('button', { name: 'Préférences rapides' }).click();
  await popup.getByRole('button', { name: 'Effacer les reprises' }).focus();
  await popup.keyboard.press('Tab');
  await expect(popup.getByRole('button', { name: /Lancer ma lecture/ })).toBeFocused();
  await popup.close();
});

test('le premier usage calibre quatre préférences puis montre la carte', async () => {
  await worker.evaluate(async () => {
    await chrome.storage.local.set({
      'ligneclaire.settings': { version: 2, calibrationCompleted: false },
    });
  });
  await page.goto('http://127.0.0.1:4173/french.html');
  await page.locator('article p').first().selectText();
  await runInjectedAction('OPEN_SELECTION');
  const dialog = page.getByRole('dialog', { name: 'Lecteur Liro' });
  const firstCalibrationTitle = dialog.getByRole('heading', { name: 'Quantité d’air' });
  await expect(firstCalibrationTitle).toBeVisible();
  await expect(firstCalibrationTitle).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(dialog.getByRole('button', { name: /Confortable/ })).toBeFocused();
  await page.keyboard.press('ArrowRight');
  await expect(dialog.getByRole('button', { name: /Plus aéré/ })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(dialog.getByRole('heading', { name: 'Longueur des lignes' })).toBeFocused();
  await dialog.getByRole('button', { name: /Lignes courtes/ }).click();
  await dialog.getByRole('button', { name: /Naturel/ }).click();
  await dialog.getByRole('button', { name: /Le paragraphe/ }).click();
  await expect(dialog.getByRole('heading', { name: 'Qu’est-ce qui te bloque ?' })).toBeVisible();
  await dialog.press('Escape');
});

test('la sélection s’ouvre et se ferme avec Échap', async () => {
  await page.goto('http://127.0.0.1:4173/french.html');
  await page.locator('article p').first().selectText();
  await runInjectedAction('OPEN_SELECTION');
  const dialog = page.getByRole('dialog', { name: 'Lecteur Liro' });
  await expect(dialog).toBeVisible({
    timeout: 10_000,
  });
  await expect(dialog.getByText('J’aimerais qu’elle puisse lire')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Lecteur Liro' })).toHaveCount(0);
});

test('le corridor, l’aide et les couches actives se naviguent au clavier', async () => {
  await worker.evaluate(async () => {
    await chrome.storage.local.set({
      'ligneclaire.settings': {
        version: 2,
        calibrationCompleted: true,
        chunkSize: 'short',
        progressEnabled: false,
      },
    });
  });
  await page.goto('http://127.0.0.1:4173/article.html');
  await runInjectedAction('OPEN_ARTICLE');
  const dialog = page.getByRole('dialog', { name: 'Lecteur Liro' });
  let passage = dialog.getByRole('article', { name: 'Étape 1' });
  await expect(passage).toBeFocused();
  await page.keyboard.press('ArrowRight');
  passage = dialog.getByRole('article', { name: 'Étape 2' });
  await expect(passage).toBeFocused();
  await passage.dispatchEvent('keydown', { key: '?' });

  const help = dialog.getByRole('dialog', { name: 'Raccourcis clavier' });
  await expect(help.getByRole('heading', { name: 'Raccourcis clavier' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(help.getByRole('button', { name: 'Fermer l’aide', exact: true })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(help).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Raccourcis clavier' })).toBeFocused();

  const settingsButton = dialog.getByRole('button', { name: 'Réglages' });
  await settingsButton.click();
  const settingsPanel = dialog.getByRole('dialog', { name: 'Réglages de lecture' });
  await expect(settingsPanel.getByRole('heading', { name: 'Réglages' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(settingsPanel).toHaveCount(0);
  await expect(settingsButton).toBeFocused();

  const navigationButton = dialog.getByRole('button', { name: 'Relire' });
  await navigationButton.focus();
  await page.keyboard.press('Space');
  await expect(dialog.getByRole('button', { name: 'Écouter la suite' })).toBeVisible();
  await expect(dialog.getByRole('article', { name: 'Étape 1' })).toBeFocused();

  await dialog.getByRole('button', { name: 'Revenir à la carte du texte' }).click();
  await expect(dialog.locator('.flow-map > h1')).toBeFocused();
  const sectionButtons = dialog.locator('.document-map li button');
  expect(await sectionButtons.count()).toBeGreaterThan(1);
  await sectionButtons.first().focus();
  await page.keyboard.press('ArrowDown');
  await expect(sectionButtons.nth(1)).toBeFocused();
  await page.keyboard.press('Escape');
});

test('le bouton principal reste lisible au survol', async () => {
  await worker.evaluate(async () => {
    await chrome.storage.local.set({
      'ligneclaire.settings': { version: 2, calibrationCompleted: true },
    });
  });
  await page.goto('http://127.0.0.1:4173/french.html');
  await page.locator('article p').first().selectText();
  await runInjectedAction('OPEN_SELECTION');
  const dialog = page.getByRole('dialog', { name: 'Lecteur Liro' });
  const continueButton = dialog.locator('.continue-button');
  await continueButton.hover();
  await expect(continueButton).toHaveCSS('background-color', 'rgb(73, 53, 207)');
  await expect(continueButton).toHaveCSS('color', 'rgb(255, 255, 255)');
  await dialog.press('Escape');
});

test('les réglages modifient instantanément le lecteur ouvert', async () => {
  await worker.evaluate(async () => {
    await chrome.storage.local.set({
      'ligneclaire.settings': {
        version: 2,
        calibrationCompleted: true,
        fontFamily: 'atkinson',
        fontSize: 20,
        theme: 'cream',
      },
    });
  });
  await page.goto('http://127.0.0.1:4173/french.html');
  await page.locator('article p').first().selectText();
  await runInjectedAction('OPEN_SELECTION');
  const dialog = page.getByRole('dialog', { name: 'Lecteur Liro' });
  await dialog.getByRole('button', { name: 'Réglages' }).click();
  const settingsPanel = dialog.getByLabel('Réglages de lecture');
  const preview = settingsPanel.getByLabel('Aperçu en direct');
  await expect(preview).toBeVisible();
  await expect(settingsPanel.getByRole('button', { name: 'Écouter un exemple' })).toBeVisible();
  await settingsPanel.getByRole('combobox', { name: 'Police' }).selectOption('opendyslexic');
  await expect(dialog).toHaveClass(/font-opendyslexic/);
  await expect
    .poll(() => dialog.evaluate((element) => getComputedStyle(element).fontFamily))
    .toContain('LiroOpenDyslexic');
  await expect
    .poll(() =>
      page.evaluate(() =>
        Array.from(document.fonts).some(
          (face) => face.family === 'LiroOpenDyslexic' && face.status === 'loaded',
        ),
      ),
    )
    .toBe(true);

  await settingsPanel.getByRole('slider', { name: 'Taille du texte' }).fill('26');
  await expect(dialog).toHaveAttribute('style', /--lc-font-size: 26px/);
  await expect(preview.locator('div')).toHaveCSS('font-size', '26px');

  await settingsPanel.getByLabel('Activer le repère visuel').check();
  await settingsPanel.getByLabel('Type de repère').selectOption('line');
  await settingsPanel.getByRole('button', { name: 'Fermer les réglages' }).click();
  const guide = dialog.getByRole('separator', { name: 'Règle de lecture déplaçable' });
  const initialGuideLine = Number(await guide.getAttribute('aria-valuenow'));
  await guide.press('ArrowDown');
  await expect(guide).toHaveAttribute('aria-valuenow', String(initialGuideLine + 1));
  await guide.press('End');
  const lastGuideLine = await guide.getAttribute('aria-valuemax');
  expect(lastGuideLine).not.toBeNull();
  await expect(guide).toHaveAttribute('aria-valuenow', lastGuideLine!);

  await dialog.getByRole('button', { name: 'Réglages' }).click();

  const popup = await context.newPage();
  await popup.goto(`chrome-extension://${extensionId}/popup.html`);
  await popup.getByRole('button', { name: 'Préférences rapides' }).click();
  await popup.getByLabel('Thème').selectOption('dark');
  await expect(dialog).toHaveClass(/theme-dark/);
  await popup.getByLabel('Police de lecture').selectOption('lexend');
  await expect(dialog).toHaveClass(/font-lexend/);
  await popup.close();
  await settingsPanel.getByRole('button', { name: 'Fermer les réglages' }).click();
  await dialog.press('Escape');
});

test('les jalons encouragent discrètement les textes d’au moins vingt étapes', async () => {
  test.setTimeout(60_000);
  await worker.evaluate(async () => {
    await chrome.storage.local.remove('ligneclaire.progress.v1');
    await chrome.storage.local.set({
      'ligneclaire.settings': {
        version: 2,
        calibrationCompleted: true,
        chunkSize: 'short',
        progressEnabled: false,
        encouragementsEnabled: true,
        theme: 'dark',
      },
    });
  });
  await page.setViewportSize({ width: 600, height: 720 });
  await page.emulateMedia({ reducedMotion: 'reduce' });

  try {
    await page.goto('http://127.0.0.1:4173/long.html');
    await runInjectedAction('OPEN_ARTICLE');
    const dialog = page.getByRole('dialog', { name: 'Lecteur Liro' });
    const continueButton = dialog.locator('.continue-button');
    await expect(dialog.locator('.toolbar-progress').getByText('Étape 1 sur 20')).toBeVisible();

    for (let index = 0; index < 5; index += 1) await continueButton.click();
    let toast = dialog.getByRole('status');
    await expect(toast).toContainText('un quart du texte');
    await expect(toast).not.toBeFocused();
    await expect(toast).toHaveCSS('animation-name', 'none');
    await expect(toast).toHaveCSS('background-color', 'rgb(41, 46, 28)');
    await expect(toast).toHaveCSS('color', 'rgb(244, 255, 210)');

    await dialog.getByRole('button', { name: 'Réglages' }).click();
    const settingsPanel = dialog.getByLabel('Réglages de lecture');
    const encouragementToggle = settingsPanel.getByLabel(
      'Encourager ma progression sur les textes longs',
    );
    await encouragementToggle.uncheck();
    await expect(toast).toHaveCount(0);
    await encouragementToggle.check();
    await settingsPanel.getByRole('button', { name: 'Fermer les réglages' }).click();

    for (let index = 0; index < 5; index += 1) await continueButton.click();
    toast = dialog.getByRole('status');
    await expect(toast).toContainText('la moitié');
    await expect(toast).toHaveCount(0, { timeout: 5_000 });

    for (let index = 0; index < 5; index += 1) await continueButton.click();
    toast = dialog.getByRole('status');
    await expect(toast).toContainText('la fin');
    await expect(toast).toHaveCount(0, { timeout: 5_000 });

    await dialog.getByRole('button', { name: 'Relire' }).click();
    await continueButton.click();
    await expect(dialog.getByRole('status')).toHaveCount(0);
    await dialog.press('Escape');
  } finally {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.setViewportSize({ width: 1280, height: 720 });
  }
});

test('Retrouver le fil rappelle le contexte et ramène directement au passage', async () => {
  await worker.evaluate(async () => {
    await chrome.storage.local.set({
      'ligneclaire.settings': {
        version: 2,
        calibrationCompleted: true,
        chunkSize: 'short',
        guideEnabled: false,
        guideMode: 'paragraph',
      },
    });
  });
  await page.goto('http://127.0.0.1:4173/busy.html');
  await runInjectedAction('OPEN_ARTICLE');
  const dialog = page.getByRole('dialog', { name: 'Lecteur Liro' });
  await dialog.getByRole('button', { name: 'Continuer' }).click();
  const rescueButton = dialog.getByRole('button', { name: 'Retrouver le fil' });
  await rescueButton.click();
  const rescuePanel = dialog.getByRole('region', { name: 'Un article au milieu du bruit' });
  await expect(rescuePanel).toBeVisible();
  await expect(rescuePanel).toBeFocused();
  await expect(rescuePanel).toContainText(/étape 2 sur/i);
  await expect(rescuePanel.getByText('Juste avant')).toBeVisible();
  await expect(rescuePanel.getByText('Tu reprends ici')).toBeVisible();
  await expect(rescuePanel.getByRole('button', { name: 'Reprendre ici' })).toBeVisible();
  await expect(rescuePanel.getByRole('button', { name: 'Essayer le guide' })).toHaveCount(0);
  await expect(dialog.locator('.active-chunk')).toBeInViewport();

  await rescuePanel.getByRole('button', { name: 'Reprendre ici' }).click();
  await expect(rescuePanel).toHaveCount(0);
  await expect(dialog.getByRole('article', { name: 'Étape 2' })).toBeFocused();
  await dialog.press('Escape');
});

test('Readability extrait l’article et écarte la navigation', async () => {
  await page.goto('http://127.0.0.1:4173/busy.html');
  await runInjectedAction('OPEN_ARTICLE');
  const dialog = page.getByRole('dialog', { name: 'Lecteur Liro' });
  await expect(
    dialog.getByRole('heading', { name: 'Un article au milieu du bruit' }),
  ).toBeVisible();
  await expect(dialog.getByText('Encore une publicité factice', { exact: true })).toHaveCount(0);
  await dialog.press('Escape');
});

test('les articles en Shadow DOM sont extraits sans les recommandations', async () => {
  await worker.evaluate(async () => {
    await chrome.storage.local.set({
      'ligneclaire.settings': { version: 2, calibrationCompleted: true },
    });
  });
  await page.goto('http://127.0.0.1:4173/shadow.html');
  await runInjectedAction('OPEN_ARTICLE');
  const dialog = page.getByRole('dialog', { name: 'Lecteur Liro' });
  await expect(
    dialog.locator('.reader-block').filter({
      hasText: /premier paragraphe du véritable article/i,
    }),
  ).toBeVisible();
  await expect(dialog.getByText(/Autres articles recommandés/i)).toHaveCount(0);
  await dialog.press('Escape');
});

test('la lecture reprend sans stocker le contenu', async () => {
  await worker.evaluate(async () => {
    await chrome.storage.local.remove('ligneclaire.progress.v1');
    await chrome.storage.local.set({
      'ligneclaire.settings': {
        version: 2,
        calibrationCompleted: true,
        chunkSize: 'short',
        progressEnabled: true,
      },
    });
  });
  await page.goto('http://127.0.0.1:4173/busy.html');
  await runInjectedAction('OPEN_ARTICLE');
  let dialog = page.getByRole('dialog', { name: 'Lecteur Liro' });
  await dialog.getByRole('button', { name: 'Continuer' }).click();
  await dialog.press('Escape');
  await runInjectedAction('OPEN_ARTICLE');
  dialog = page.getByRole('dialog', { name: 'Lecteur Liro' });
  await expect(dialog.getByText(/Étape 2 sur/).first()).toBeVisible();
  await dialog.press('Escape');
});

test('le sélecteur OCR prend le focus et s’annule avec Échap', async () => {
  await page.goto('http://127.0.0.1:4173/image.html');
  const sourceHeading = page.getByRole('heading', { name: 'Image contenant du texte' });
  await sourceHeading.evaluate((element) => {
    (element as HTMLElement).tabIndex = -1;
    (element as HTMLElement).focus();
  });
  await runInjectedAction('START_OCR_SELECTION');
  const selector = page.getByRole('dialog', { name: 'Sélectionner une zone à numériser' });
  await expect(selector).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(selector).toHaveCount(0);
  await expect(sourceHeading).toBeFocused();
});

test('la capture OCR locale peut être corrigée puis ouverte', async () => {
  test.setTimeout(120_000);
  await worker.evaluate(async () => {
    await chrome.storage.local.set({
      'ligneclaire.settings': { version: 2, calibrationCompleted: true },
    });
  });
  await page.goto('http://127.0.0.1:4173/image.html');
  const image = await page.locator('img').boundingBox();
  expect(image).not.toBeNull();
  await runInjectedAction('START_OCR_SELECTION');
  await expect(
    page.getByRole('dialog', { name: 'Sélectionner une zone à numériser' }),
  ).toBeVisible();
  await page.mouse.move(image!.x + 10, image!.y + 10);
  await page.mouse.down();
  await page.mouse.move(image!.x + image!.width - 10, image!.y + image!.height - 10, { steps: 8 });
  await page.mouse.up();
  const review = page.getByRole('dialog', { name: 'Vérifier le texte numérisé' });
  const alert = page.getByRole('alert');
  await Promise.race([
    review.waitFor({ state: 'visible', timeout: 90_000 }),
    alert.waitFor({ state: 'visible', timeout: 90_000 }).then(async () => {
      throw new Error(await alert.innerText());
    }),
  ]);
  const textarea = review.getByLabel('Texte reconnu');
  await expect(textarea).toHaveValue(/Liro rend ce texte lisible/i);
  await expect(textarea).not.toHaveValue(/Reconnaissance du texte|Préparation|Annuler/i);
  await expect(textarea).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(review.getByRole('button', { name: 'Ouvrir dans Liro' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(textarea).toBeFocused();
  await textarea.fill('Texte OCR corrigé par l’utilisateur.');
  await review.getByRole('button', { name: 'Ouvrir dans Liro' }).click();
  const reader = page.getByRole('dialog', { name: 'Lecteur Liro' });
  await expect(
    reader.locator('.reader-block').filter({ hasText: 'Texte OCR corrigé par l’utilisateur.' }),
  ).toBeVisible();
  await page.keyboard.press('Escape');
});

test('les fixtures couvrent SPA, image, canvas et contenu technique', async () => {
  for (const path of [
    'spa.html',
    'image.html',
    'canvas.html',
    'technical.html',
    'busy.html',
    'shadow.html',
  ]) {
    await page.goto(`http://127.0.0.1:4173/${path}`);
    await expect(page.locator('body')).not.toBeEmpty();
  }
});
