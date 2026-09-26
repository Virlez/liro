import type { VisualToken } from '../../models';

const TOKEN_PATTERN =
  /https?:\/\/[^\s<>()]+|www\.[^\s<>()]+|[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}|[\p{L}][\p{L}\p{N}]*(?:_[\p{L}\p{N}]+)+|[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*(?:-[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*)*|\p{N}+(?:[.,]\p{N}+)*|\s+|./gu;
const FRENCH_PREFIX = /^(jusqu|lorsqu|puisqu|qu|[ldjmnstc])(['’])/iu;
const ACRONYM = /^\p{Lu}{3,5}$/u;
const NUMBER = /^\p{N}+(?:[.,]\p{N}+)*$/u;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const URL = /^(?:https?:\/\/|www\.)/iu;
const TECHNICAL_ID = /(?:_|[a-z][A-Z]|\p{L}\d|\d\p{L})/u;

function graphemes(text: string, locale: string): string[] {
  if (typeof Intl.Segmenter === 'function') {
    return [...new Intl.Segmenter(locale, { granularity: 'grapheme' }).segment(text)].map(
      (segment) => segment.segment,
    );
  }
  return Array.from(text);
}

function plainToken(text: string, startOffset: number, isWord = false): VisualToken {
  return {
    id: `token-${startOffset}`,
    originalText: text,
    prefix: '',
    anchor: '',
    remainder: text,
    suffix: '',
    startOffset,
    endOffset: startOffset + text.length,
    isWord,
    isTransformable: false,
  };
}

function wordToken(
  originalText: string,
  startOffset: number,
  anchorLength: number,
  locale: string,
): VisualToken {
  if (
    NUMBER.test(originalText) ||
    URL.test(originalText) ||
    EMAIL.test(originalText) ||
    ACRONYM.test(originalText) ||
    TECHNICAL_ID.test(originalText)
  ) {
    return plainToken(originalText, startOffset, true);
  }

  const prefixMatch = originalText.match(FRENCH_PREFIX);
  const prefix = prefixMatch?.[0] ?? '';
  const mainWord = originalText.slice(prefix.length);
  const letters = graphemes(mainWord, locale);
  if (!letters.length) return plainToken(originalText, startOffset, true);
  const anchor = letters.slice(0, anchorLength).join('');
  return {
    id: `token-${startOffset}`,
    originalText,
    prefix,
    anchor,
    remainder: mainWord.slice(anchor.length),
    suffix: '',
    startOffset,
    endOffset: startOffset + originalText.length,
    isWord: true,
    isTransformable: true,
  };
}

export function formatVisualAnchors(
  text: string,
  options: { anchorLength?: number; locale?: string } = {},
): VisualToken[] {
  const anchorLength = Math.max(1, Math.floor(options.anchorLength ?? 2));
  const locale = options.locale ?? 'fr';
  const tokens: VisualToken[] = [];

  for (const match of text.matchAll(TOKEN_PATTERN)) {
    const value = match[0];
    const offset = match.index;
    if (value.includes('-') && !URL.test(value) && !EMAIL.test(value)) {
      let localOffset = 0;
      for (const part of value.split(/(-)/u)) {
        tokens.push(
          part === '-'
            ? plainToken(part, offset + localOffset)
            : wordToken(part, offset + localOffset, anchorLength, locale),
        );
        localOffset += part.length;
      }
    } else if (/^[\p{L}\p{M}]/u.test(value) || EMAIL.test(value) || URL.test(value)) {
      tokens.push(wordToken(value, offset, anchorLength, locale));
    } else {
      tokens.push(plainToken(value, offset));
    }
  }
  return tokens;
}

export function findTokenAtOffset(tokens: VisualToken[], offset: number): VisualToken | undefined {
  return tokens.find((token) => offset >= token.startOffset && offset < token.endOffset);
}
