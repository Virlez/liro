import type { FlowDocument, ReaderDocument, ReadingProgress } from '../../models';

export const PROGRESS_KEY = 'ligneclaire.progress.v1';
export const PROGRESS_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const MAX_PROGRESS_ITEMS = 50;

export function normalizeSourceUrl(sourceUrl: string): string {
  const url = new URL(sourceUrl);
  url.hash = '';
  url.username = '';
  url.password = '';
  for (const key of [...url.searchParams.keys()]) {
    if (/^(utm_|fbclid$|gclid$)/iu.test(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  return url.toString();
}

export async function hashText(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function sourceKey(document: ReaderDocument): Promise<string | undefined> {
  if (!document.sourceUrl || document.sourceType !== 'article') return undefined;
  return hashText(`${document.sourceType}|${normalizeSourceUrl(document.sourceUrl)}`);
}

async function documentFingerprint(document: ReaderDocument): Promise<string> {
  return hashText(
    document.blocks
      .map((block) => `${block.type}:${block.level ?? 0}:${block.originalText}`)
      .join('\n'),
  );
}

async function chunkFingerprint(flow: FlowDocument, index: number): Promise<string> {
  const chunk = flow.chunks[index];
  return hashText(chunk ? `${chunk.blockType}:${chunk.text}` : '');
}

async function readAll(now = Date.now()): Promise<ReadingProgress[]> {
  const stored = await chrome.storage.local.get(PROGRESS_KEY);
  const value = stored[PROGRESS_KEY];
  if (!Array.isArray(value)) return [];
  return (value as ReadingProgress[]).filter(
    (item) => item?.version === 1 && now - item.updatedAt <= PROGRESS_TTL_MS,
  );
}

export async function saveReadingProgress(
  document: ReaderDocument,
  flow: FlowDocument,
  chunkIndex: number,
  now = Date.now(),
): Promise<void> {
  const key = await sourceKey(document);
  if (!key || !flow.chunks[chunkIndex]) return;
  const all = await readAll(now);
  const previous = all.find((progress) => progress.sourceKey === key);
  const previousCompletedSteps =
    typeof previous?.completedSteps === 'number' && Number.isFinite(previous.completedSteps)
      ? previous.completedSteps
      : (previous?.chunkIndex ?? 0);
  const item: ReadingProgress = {
    version: 1,
    sourceKey: key,
    documentFingerprint: await documentFingerprint(document),
    chunkFingerprint: await chunkFingerprint(flow, chunkIndex),
    chunkIndex,
    completedSteps: Math.max(previousCompletedSteps, Math.min(chunkIndex, flow.chunks.length)),
    totalSteps: flow.chunks.length,
    updatedAt: now,
  };
  const existing = all.filter((progress) => progress.sourceKey !== key);
  await chrome.storage.local.set({
    [PROGRESS_KEY]: [item, ...existing]
      .sort((left, right) => right.updatedAt - left.updatedAt)
      .slice(0, MAX_PROGRESS_ITEMS),
  });
}

export async function loadReadingProgress(
  document: ReaderDocument,
  flow: FlowDocument,
  now = Date.now(),
): Promise<ReadingProgress | undefined> {
  const key = await sourceKey(document);
  if (!key) return undefined;
  const stored = (await readAll(now)).find((item) => item.sourceKey === key);
  if (!stored) return undefined;
  const currentFingerprint = await documentFingerprint(document);
  if (stored.documentFingerprint === currentFingerprint) {
    return { ...stored, chunkIndex: Math.min(stored.chunkIndex, flow.chunks.length - 1) };
  }
  const fingerprints = await Promise.all(
    flow.chunks.map((_chunk, index) => chunkFingerprint(flow, index)),
  );
  const matchedIndex = fingerprints.indexOf(stored.chunkFingerprint);
  return {
    ...stored,
    chunkIndex:
      matchedIndex >= 0
        ? matchedIndex
        : Math.min(stored.completedSteps, Math.max(0, flow.chunks.length - 1)),
    totalSteps: flow.chunks.length,
  };
}

export async function removeReadingProgress(document: ReaderDocument): Promise<void> {
  const key = await sourceKey(document);
  if (!key) return;
  await chrome.storage.local.set({
    [PROGRESS_KEY]: (await readAll()).filter((item) => item.sourceKey !== key),
  });
}

export async function clearReadingProgress(): Promise<void> {
  await chrome.storage.local.remove(PROGRESS_KEY);
}
