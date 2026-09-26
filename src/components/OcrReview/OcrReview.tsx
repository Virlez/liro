import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { trapTabKey } from '../../lib/accessibility/focus';

interface Props {
  initialText: string;
  onCancel: () => void;
  onRetry: () => void;
  onOpen: (text: string) => void;
}

export function OcrReview({ initialText, onCancel, onRetry, onOpen }: Props) {
  const [text, setText] = useState(initialText);
  const [copied, setCopied] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textRef.current?.focus({ preventScroll: true });
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (trapTabKey(event, dialogRef.current)) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
    }
  };
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
  };
  return (
    <div
      ref={dialogRef}
      className="ocr-review-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ocr-title"
      tabIndex={-1}
      onKeyDown={onKeyDown}
    >
      <section className="ocr-review">
        <h1 id="ocr-title">Vérifier le texte numérisé</h1>
        <p>Corrigez les éventuelles erreurs avant d’ouvrir le texte.</p>
        <label htmlFor="ocr-text">Texte reconnu</label>
        <textarea
          ref={textRef}
          id="ocr-text"
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
        <div className="ocr-actions">
          <button type="button" onClick={onCancel}>
            Annuler
          </button>
          <button type="button" onClick={onRetry}>
            Relancer l’OCR
          </button>
          <button type="button" onClick={() => void copy()}>
            {copied ? 'Copié' : 'Copier'}
          </button>
          <button
            type="button"
            className="primary"
            disabled={!text.trim()}
            onClick={() => onOpen(text)}
          >
            Ouvrir dans Liro
          </button>
        </div>
      </section>
    </div>
  );
}
