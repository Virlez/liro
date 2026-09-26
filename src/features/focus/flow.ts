import type {
  FlowChunk,
  FlowDocument,
  FlowSection,
  ReaderBlock,
  ReaderDocument,
  ReaderSettings,
} from '../../models';
import { segmentSentences } from '../speech/segmentation';

const TARGET_LENGTH: Record<ReaderSettings['chunkSize'], number> = {
  short: 280,
  balanced: 520,
  long: 820,
};

const wordsIn = (text: string): number => text.trim().split(/\s+/u).filter(Boolean).length;

function splitBlock(
  block: ReaderBlock,
  sectionIndex: number,
  targetLength: number,
  language: string,
): FlowChunk[] {
  if (
    block.type === 'code' ||
    block.type === 'list-item' ||
    block.originalText.length <= targetLength
  ) {
    return [
      {
        id: `${block.id}-chunk-0`,
        blockId: block.id,
        blockType: block.type,
        ...(block.level ? { level: block.level } : {}),
        text: block.originalText,
        sectionIndex,
        startOffset: 0,
        endOffset: block.originalText.length,
      },
    ];
  }

  const sentences = segmentSentences(block.originalText, language);
  if (sentences.length < 2) {
    return [
      {
        id: `${block.id}-chunk-0`,
        blockId: block.id,
        blockType: block.type,
        text: block.originalText,
        sectionIndex,
        startOffset: 0,
        endOffset: block.originalText.length,
      },
    ];
  }

  const chunks: FlowChunk[] = [];
  let group = [sentences[0]!];
  for (const sentence of sentences.slice(1)) {
    const length = sentence.endOffset - group[0]!.startOffset;
    if (length > targetLength && group.length) {
      const startOffset = group[0]!.startOffset;
      const endOffset = group.at(-1)!.endOffset;
      chunks.push({
        id: `${block.id}-chunk-${chunks.length}`,
        blockId: block.id,
        blockType: block.type,
        text: block.originalText.slice(startOffset, endOffset).trim(),
        sectionIndex,
        startOffset,
        endOffset,
      });
      group = [sentence];
    } else group.push(sentence);
  }
  if (group.length) {
    const startOffset = group[0]!.startOffset;
    const endOffset = group.at(-1)!.endOffset;
    chunks.push({
      id: `${block.id}-chunk-${chunks.length}`,
      blockId: block.id,
      blockType: block.type,
      text: block.originalText.slice(startOffset, endOffset).trim(),
      sectionIndex,
      startOffset,
      endOffset,
    });
  }
  return chunks;
}

export function buildFlowDocument(
  document: ReaderDocument,
  chunkSize: ReaderSettings['chunkSize'],
): FlowDocument {
  const sections: FlowSection[] = [];
  const chunks: FlowChunk[] = [];
  const ensureSection = (title = document.title || 'Début', level = 1): number => {
    if (!sections.length) sections.push({ id: 'section-0', title, level, chunkIndexes: [] });
    return sections.length - 1;
  };

  for (const block of document.blocks) {
    if (block.type === 'heading') {
      sections.push({
        id: `section-${sections.length}`,
        title: block.originalText,
        level: block.level ?? 2,
        chunkIndexes: [],
      });
      continue;
    }
    const sectionIndex = ensureSection();
    for (const chunk of splitBlock(
      block,
      sectionIndex,
      TARGET_LENGTH[chunkSize],
      document.language,
    )) {
      sections[sectionIndex]!.chunkIndexes.push(chunks.length);
      chunks.push(chunk);
    }
  }

  if (!chunks.length) {
    const fallbackSection: FlowSection = {
      id: 'section-0',
      title: document.title || 'Début',
      level: 1,
      chunkIndexes: document.blocks.map((_block, index) => index),
    };
    const fallbackChunks: FlowChunk[] = document.blocks.map((block) => ({
      id: `${block.id}-chunk-0`,
      blockId: block.id,
      blockType: block.type,
      ...(block.level ? { level: block.level } : {}),
      text: block.originalText,
      sectionIndex: 0,
      startOffset: 0,
      endOffset: block.originalText.length,
    }));
    const wordCount = document.blocks.reduce(
      (total, block) => total + wordsIn(block.originalText),
      0,
    );
    return {
      chunks: fallbackChunks,
      sections: [fallbackSection],
      wordCount,
      estimatedMinutes: Math.max(1, Math.ceil(wordCount / 220)),
    };
  }

  const nonEmptySections = sections.filter((section) => section.chunkIndexes.length);
  const remappedChunks = chunks.map((chunk) => {
    const section = sections[chunk.sectionIndex]!;
    const nextIndex = nonEmptySections.indexOf(section);
    return nextIndex === chunk.sectionIndex ? chunk : { ...chunk, sectionIndex: nextIndex };
  });
  const wordCount = document.blocks.reduce(
    (total, block) => total + wordsIn(block.originalText),
    0,
  );
  return {
    chunks: remappedChunks,
    sections: nonEmptySections,
    wordCount,
    estimatedMinutes: Math.max(1, Math.ceil(wordCount / 220)),
  };
}

export function sectionForChunk(flow: FlowDocument, chunkIndex: number): FlowSection | undefined {
  const chunk = flow.chunks[chunkIndex];
  return chunk ? flow.sections[chunk.sectionIndex] : undefined;
}
