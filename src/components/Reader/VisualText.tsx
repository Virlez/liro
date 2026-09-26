import type { ClipboardEvent, ElementType, ReactNode } from 'react';
import { formatVisualAnchors } from '../../features/formatting/visualAnchors';
import type { ReaderBlock } from '../../models';

interface Props {
  block: ReaderBlock;
  enabled: boolean;
  anchorLength: number;
  activeTokenId: string | undefined;
  activeSentenceRange: { startOffset: number; endOffset: number } | undefined;
  onActivate: () => void;
}

function BlockTag({
  block,
  children,
  ...props
}: { block: ReaderBlock; children: ReactNode } & Record<string, unknown>) {
  if (block.type === 'heading') {
    const level = Math.min(6, Math.max(1, block.level ?? 2));
    const Tag = `h${level}` as ElementType;
    return <Tag {...props}>{children}</Tag>;
  }
  if (block.type === 'quote') return <blockquote {...props}>{children}</blockquote>;
  if (block.type === 'code') return <pre {...props}>{children}</pre>;
  if (block.type === 'list-item') return <li {...props}>{children}</li>;
  return <p {...props}>{children}</p>;
}

export function VisualText({
  block,
  enabled,
  anchorLength,
  activeTokenId,
  activeSentenceRange,
  onActivate,
}: Props) {
  const tokens = formatVisualAnchors(block.originalText, { anchorLength });
  const copyOriginal = (event: ClipboardEvent<HTMLElement>) => {
    const selection = window.getSelection();
    if (!selection?.rangeCount) return;
    const fragment = selection.getRangeAt(0).cloneContents();
    fragment.querySelectorAll?.('.sr-only').forEach((node) => node.remove());
    const holder = document.createElement('div');
    holder.append(fragment);
    event.preventDefault();
    event.clipboardData.setData('text/plain', holder.textContent ?? block.originalText);
  };

  const content =
    enabled || activeSentenceRange ? (
      <>
        <span className="sr-only">{block.originalText}</span>
        <span className="visual-text" aria-hidden="true">
          {tokens.map((token) => (
            <span
              className={`visual-word ${activeSentenceRange && token.endOffset > activeSentenceRange.startOffset && token.startOffset < activeSentenceRange.endOffset ? 'tts-active-sentence' : ''} ${activeTokenId === `${block.id}-${token.id}` ? 'tts-active-word' : ''}`}
              data-start={token.startOffset}
              data-end={token.endOffset}
              key={`${token.id}-${token.originalText}`}
            >
              {token.prefix}
              {enabled && token.isTransformable ? <strong>{token.anchor}</strong> : token.anchor}
              {token.remainder}
              {token.suffix}
            </span>
          ))}
        </span>
      </>
    ) : (
      block.originalText
    );

  return (
    <BlockTag
      block={block}
      className="reader-block"
      data-block-id={block.id}
      onClick={onActivate}
      onCopy={copyOriginal}
    >
      {content}
    </BlockTag>
  );
}
