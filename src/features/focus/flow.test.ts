import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '../settings/settings';
import type { ReaderDocument } from '../../models';
import { buildFlowDocument, sectionForChunk } from './flow';

const document: ReaderDocument = {
  id: 'doc',
  sourceType: 'article',
  sourceUrl: 'https://example.com/article',
  title: 'Comprendre un texte',
  language: 'fr',
  createdAt: 1,
  blocks: [
    { id: 'h1', type: 'heading', level: 1, originalText: 'Première partie' },
    {
      id: 'p1',
      type: 'paragraph',
      originalText: Array.from(
        { length: 12 },
        (_, index) => `La phrase numéro ${index + 1} apporte une information complète.`,
      ).join(' '),
    },
    { id: 'h2', type: 'heading', level: 2, originalText: 'Deuxième partie' },
    { id: 'li1', type: 'list-item', originalText: 'Un élément de liste reste entier.' },
  ],
};

describe('moteur Focus', () => {
  it('crée une carte par titres et conserve les listes', () => {
    const flow = buildFlowDocument(document, 'balanced');
    expect(flow.sections.map((section) => section.title)).toEqual([
      'Première partie',
      'Deuxième partie',
    ]);
    expect(flow.chunks.at(-1)?.text).toBe('Un élément de liste reste entier.');
    expect(sectionForChunk(flow, flow.chunks.length - 1)?.title).toBe('Deuxième partie');
    expect(flow.estimatedMinutes).toBeGreaterThanOrEqual(1);
  });

  it('produit davantage d’étapes courtes sans couper les phrases', () => {
    const short = buildFlowDocument(document, 'short');
    const long = buildFlowDocument(document, 'long');
    expect(short.chunks.length).toBeGreaterThan(long.chunks.length);
    expect(short.chunks.every((chunk) => /[.!?]$/u.test(chunk.text))).toBe(true);
  });

  it('accepte les tailles issues des réglages validés', () => {
    expect(buildFlowDocument(document, DEFAULT_SETTINGS.chunkSize).chunks.length).toBeGreaterThan(
      0,
    );
  });

  it('rend lisible une sélection composée uniquement d’un titre', () => {
    const flow = buildFlowDocument(
      {
        ...document,
        blocks: [{ id: 'heading-only', type: 'heading', level: 2, originalText: 'Titre seul' }],
      },
      'short',
    );
    expect(flow.chunks).toHaveLength(1);
    expect(flow.chunks[0]?.text).toBe('Titre seul');
  });
});
