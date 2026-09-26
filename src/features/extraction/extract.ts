import { Readability } from '@mozilla/readability';
import DOMPurify from 'dompurify';
import type { ReaderBlock, ReaderDocument, ReaderBlockType } from '../../models';

const MAX_TEXT_LENGTH = 250_000;
const BLOCK_SELECTOR = 'h1,h2,h3,h4,h5,h6,p,li,blockquote,pre';
const REMOVABLE_SELECTOR =
  'script,style,noscript,form,nav,aside,iframe,#ligneclaire-root,#ligneclaire-area-selector';

function id(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`;
}

function cloneComposedNode(source: Node, target: Document): Node {
  if (source.nodeType === Node.TEXT_NODE) return target.createTextNode(source.textContent ?? '');
  if (source.nodeType === Node.COMMENT_NODE) return target.createComment(source.textContent ?? '');
  if (source.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
    const fragment = target.createDocumentFragment();
    for (const child of source.childNodes) fragment.append(cloneComposedNode(child, target));
    return fragment;
  }
  if (!(source instanceof Element)) return target.createTextNode('');

  if (source.tagName.toLowerCase() === 'slot') {
    const slot = source as HTMLSlotElement;
    const assigned = slot.assignedNodes({ flatten: true });
    const fragment = target.createDocumentFragment();
    for (const child of assigned.length ? assigned : slot.childNodes)
      fragment.append(cloneComposedNode(child, target));
    return fragment;
  }

  const clone = target.createElementNS(source.namespaceURI, source.tagName.toLowerCase());
  for (const attribute of source.attributes) clone.setAttribute(attribute.name, attribute.value);
  const children = source.shadowRoot?.childNodes ?? source.childNodes;
  for (const child of children) clone.append(cloneComposedNode(child, target));
  return clone;
}

/** Clone the rendered, composed tree so Readability can see open Shadow DOM content. */
export function cloneComposedDocument(source: Document): Document {
  const target = source.implementation.createHTMLDocument(source.title);
  const root = cloneComposedNode(source.documentElement, target);
  target.replaceChild(root, target.documentElement);
  return target;
}

export function selectPrimaryArticleRoot(source: Document): Element | undefined {
  const articles = [...source.querySelectorAll('article')].filter(
    (element) => !element.parentElement?.closest('article'),
  );
  return (
    articles.find((element) => {
      const paragraphs = [...element.querySelectorAll('p')].filter(
        (paragraph) => (paragraph.textContent?.trim().length ?? 0) >= 30,
      );
      return paragraphs.length >= 2 && (element.textContent?.trim().length ?? 0) >= 280;
    }) ?? articles.find((element) => (element.textContent?.trim().length ?? 0) >= 120)
  );
}

export function sanitizeSourceHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'article',
      'section',
      'h1',
      'h2',
      'h3',
      'h4',
      'h5',
      'h6',
      'p',
      'ul',
      'ol',
      'li',
      'blockquote',
      'pre',
      'code',
      'a',
      'strong',
      'em',
      'br',
    ],
    ALLOWED_ATTR: ['href', 'title', 'lang'],
    ALLOW_UNKNOWN_PROTOCOLS: false,
  });
}

function elementToBlock(element: Element): ReaderBlock | null {
  const originalText = (element.textContent ?? '').replace(/\u00a0/gu, ' ').trim();
  if (!originalText) return null;
  const tag = element.tagName.toLowerCase();
  let type: ReaderBlockType = 'paragraph';
  let level: number | undefined;
  if (/^h[1-6]$/u.test(tag)) {
    type = 'heading';
    level = Number(tag[1]);
  } else if (tag === 'li') type = 'list-item';
  else if (tag === 'blockquote') type = 'quote';
  else if (tag === 'pre' || tag === 'code') type = 'code';
  return level
    ? { id: id('block'), type, level, originalText }
    : { id: id('block'), type, originalText };
}

export function htmlToBlocks(html: string): ReaderBlock[] {
  const parsed = new DOMParser().parseFromString(sanitizeSourceHtml(html), 'text/html');
  return [...parsed.body.querySelectorAll(BLOCK_SELECTOR)]
    .filter((element) => !element.closest('li') || element.tagName.toLowerCase() === 'li')
    .filter(
      (element) => !element.closest('blockquote') || element.tagName.toLowerCase() === 'blockquote',
    )
    .map(elementToBlock)
    .filter((block): block is ReaderBlock => block !== null);
}

function textToBlocks(text: string): ReaderBlock[] {
  return text
    .slice(0, MAX_TEXT_LENGTH)
    .split(/\n\s*\n|\n/gu)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((originalText) => ({ id: id('block'), type: 'paragraph', originalText }));
}

export function extractSelectionDocument(): ReaderDocument | null {
  const selection = window.getSelection();
  const text = selection?.toString().trim() ?? '';
  if (!selection || selection.rangeCount === 0 || !text) return null;
  if (text.length > MAX_TEXT_LENGTH)
    throw new Error('La sélection dépasse la limite de 250 000 caractères.');

  const container = document.createElement('div');
  for (let index = 0; index < selection.rangeCount; index += 1) {
    container.append(selection.getRangeAt(index).cloneContents());
  }
  const blocks = htmlToBlocks(container.innerHTML);
  const documentResult: ReaderDocument = {
    id: id('document'),
    sourceType: 'selection',
    sourceUrl: location.href,
    language: document.documentElement.lang || 'fr',
    blocks: blocks.length ? blocks : textToBlocks(text),
    createdAt: Date.now(),
  };
  if (document.title) documentResult.title = document.title;
  return documentResult;
}

export function extractArticleDocumentFrom(
  source: Document,
  sourceUrl: string,
): ReaderDocument | null {
  const clone = cloneComposedDocument(source);
  clone.querySelectorAll(REMOVABLE_SELECTOR).forEach((node) => node.remove());
  const primaryRoot = selectPrimaryArticleRoot(clone);
  let readabilitySource = clone;
  if (primaryRoot) {
    const isolated = clone.implementation.createHTMLDocument(clone.title);
    isolated.documentElement.lang = clone.documentElement.lang;
    isolated.head.innerHTML = clone.head.innerHTML;
    isolated.body.append(primaryRoot.cloneNode(true));
    readabilitySource = isolated;
  }
  const article = new Readability(readabilitySource, { charThreshold: 120 }).parse();
  if (!article?.content?.trim()) return null;
  const blocks = htmlToBlocks(article.content);
  if (!blocks.length) return null;
  return {
    id: id('document'),
    sourceType: 'article',
    sourceUrl,
    title: article.title || source.title,
    language: article.lang || source.documentElement.lang || 'fr',
    blocks,
    createdAt: Date.now(),
  };
}

export function extractArticleDocument(): ReaderDocument | null {
  return extractArticleDocumentFrom(document, location.href);
}

export function documentFromOcr(text: string): ReaderDocument {
  return {
    id: id('document'),
    sourceType: 'ocr',
    sourceUrl: location.href,
    title: 'Texte numérisé',
    language: 'fr',
    blocks: textToBlocks(text),
    createdAt: Date.now(),
  };
}
