export interface SentenceSegment {
  id: string;
  text: string;
  startOffset: number;
  endOffset: number;
}

export function segmentSentences(text: string, locale = 'fr'): SentenceSegment[] {
  if (!text.trim()) return [];
  if (typeof Intl.Segmenter === 'function') {
    const raw = [...new Intl.Segmenter(locale, { granularity: 'sentence' }).segment(text)]
      .filter((part) => part.segment.trim())
      .map((part, index) => ({
        id: `sentence-${index}`,
        text: part.segment,
        startOffset: part.index,
        endOffset: part.index + part.segment.length,
      }));
    const merged: SentenceSegment[] = [];
    for (const sentence of raw) {
      const previous = merged.at(-1);
      if (previous && /\b(?:M|Mme|Mlle|Dr|Pr|etc)\.\s*$/iu.test(previous.text)) {
        previous.text += sentence.text;
        previous.endOffset = sentence.endOffset;
      } else {
        merged.push({ ...sentence, id: `sentence-${merged.length}` });
      }
    }
    return merged;
  }
  const result: SentenceSegment[] = [];
  const matcher = /[^.!?\n]+(?:[.!?]+[”»"']?|\n+|$)\s*/gu;
  for (const match of text.matchAll(matcher)) {
    if (!match[0].trim()) continue;
    result.push({
      id: `sentence-${result.length}`,
      text: match[0],
      startOffset: match.index,
      endOffset: match.index + match[0].length,
    });
  }
  return result;
}
