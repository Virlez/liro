import { describe, expect, it } from 'vitest';
import type { ReaderDocument } from '../../models';
import { buildFlowDocument } from '../focus/flow';
import {
  PROGRESS_KEY,
  clearReadingProgress,
  loadReadingProgress,
  normalizeSourceUrl,
  saveReadingProgress,
} from './progress';

const makeDocument = (extra = false): ReaderDocument => ({
  id: extra ? 'changed' : 'original',
  sourceType: 'article',
  sourceUrl: 'https://example.com/read?id=4&utm_source=test#private',
  title: 'Titre confidentiel',
  language: 'fr',
  createdAt: 1,
  blocks: [
    { id: 'p1', type: 'paragraph', originalText: 'Premier passage à lire.' },
    ...(extra ? [{ id: 'new', type: 'paragraph' as const, originalText: 'Un ajout récent.' }] : []),
    { id: 'p2', type: 'paragraph', originalText: 'Deuxième passage stable et reconnaissable.' },
  ],
});

describe('reprise privée', () => {
  it('normalise la source avant de la hacher', () => {
    expect(normalizeSourceUrl(makeDocument().sourceUrl!)).toBe('https://example.com/read?id=4');
  });

  it('ne stocke ni URL, ni titre, ni texte et retrouve une étape inchangée', async () => {
    const document = makeDocument();
    const flow = buildFlowDocument(document, 'balanced');
    await saveReadingProgress(document, flow, 1, 100_000);
    const stored = JSON.stringify((await chrome.storage.local.get(PROGRESS_KEY))[PROGRESS_KEY]);
    expect(stored).not.toContain('example.com');
    expect(stored).not.toContain('Titre confidentiel');
    expect(stored).not.toContain('Deuxième passage');
    expect((await loadReadingProgress(document, flow, 100_001))?.chunkIndex).toBe(1);
  });

  it('retrouve le même passage quand la page a changé', async () => {
    const original = makeDocument();
    await saveReadingProgress(original, buildFlowDocument(original, 'balanced'), 1, 200_000);
    const changed = makeDocument(true);
    const progress = await loadReadingProgress(
      changed,
      buildFlowDocument(changed, 'balanced'),
      200_001,
    );
    expect(progress?.chunkIndex).toBe(2);
  });

  it('conserve le maximum parcouru après un retour en arrière', async () => {
    const document = makeDocument();
    const flow = buildFlowDocument(document, 'balanced');
    await saveReadingProgress(document, flow, 1, 300_000);
    await saveReadingProgress(document, flow, 0, 300_001);
    const progress = await loadReadingProgress(document, flow, 300_002);
    expect(progress?.chunkIndex).toBe(0);
    expect(progress?.completedSteps).toBe(1);
  });

  it('efface toutes les reprises', async () => {
    const document = makeDocument();
    await saveReadingProgress(document, buildFlowDocument(document, 'balanced'), 0);
    await clearReadingProgress();
    expect((await chrome.storage.local.get(PROGRESS_KEY))[PROGRESS_KEY]).toBeUndefined();
  });
});
