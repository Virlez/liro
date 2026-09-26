import { describe, expect, it } from 'vitest';
import { segmentSentences } from './segmentation';
import { findTokenAtOffset, formatVisualAnchors } from '../formatting/visualAnchors';

describe('segmentSentences', () => {
  it.each([
    ['Une phrase. Une autre ! Une question ?', 3],
    ['« Bonjour ! » Puis il part.', 2],
    ['Première ligne.\nDeuxième ligne.', 2],
  ])('segmente %s', (text, count) => expect(segmentSentences(text)).toHaveLength(count));

  it('rattache les abréviations courantes', () => {
    expect(segmentSentences('Le Dr. Martin arrive. Ensuite, il lit.')).toHaveLength(2);
  });

  it('conserve des offsets utilisables pour le surlignage', () => {
    const text = 'Bonjour monde. Salut !';
    const sentence = segmentSentences(text)[0]!;
    const tokens = formatVisualAnchors(text);
    expect(text.slice(sentence.startOffset, sentence.endOffset)).toBe(sentence.text);
    expect(findTokenAtOffset(tokens, sentence.startOffset + 8)?.originalText).toBe('monde');
  });

  it('retourne une liste vide pour des espaces', () => expect(segmentSentences('   ')).toEqual([]));
});
