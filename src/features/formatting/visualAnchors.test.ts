import { describe, expect, it } from 'vitest';
import { findTokenAtOffset, formatVisualAnchors } from './visualAnchors';

function rendered(text: string): string {
  return formatVisualAnchors(text)
    .map(
      (token) =>
        `${token.prefix}${token.anchor ? `**${token.anchor}**` : ''}${token.remainder}${token.suffix}`,
    )
    .join('');
}

describe('formatVisualAnchors', () => {
  it.each([
    ['accessibilité', '**ac**cessibilité'],
    ['A à de', '**A** **à** **de**'],
    ['École', '**Éc**ole'],
    ['l’accessibilité', 'l’**ac**cessibilité'],
    ["d'une", "d'**un**e"],
    ['qu’elle', 'qu’**el**le'],
    ['j’aimerais', 'j’**ai**merais'],
    ['c’était', 'c’**ét**ait'],
    ['porte-monnaie', '**po**rte-**mo**nnaie'],
    ['sous-titre', '**so**us-**ti**tre'],
    ['Hello world', '**He**llo **wo**rld'],
  ])('transforme %s', (input, expected) => expect(rendered(input)).toBe(expected));

  it.each([
    'PDF',
    'OCR',
    'TDAH',
    '123',
    '12,5',
    'test@example.com',
    'https://example.com',
    'api_client',
    'camelCase',
  ])('préserve %s', (input) => {
    expect(rendered(input)).toBe(input);
    expect(formatVisualAnchors(input).every((token) => !token.isTransformable)).toBe(true);
  });

  it('préserve ponctuation, espaces multiples et emoji', () => {
    expect(rendered('Bonjour,   👋 monde !')).toBe('**Bo**njour,   👋 **mo**nde !');
  });

  it('compte les graphèmes Unicode combinés', () => {
    expect(rendered('e\u0301cole')).toBe('**e\u0301c**ole');
  });

  it('gère le texte vide', () => expect(formatVisualAnchors('')).toEqual([]));

  it('conserve les offsets UTF-16 originaux', () => {
    const text = '👋 accessibilité';
    const token = formatVisualAnchors(text).find((item) => item.isWord)!;
    expect(text.slice(token.startOffset, token.endOffset)).toBe(token.originalText);
    expect(findTokenAtOffset(formatVisualAnchors(text), token.startOffset + 3)).toEqual(token);
  });
});
