import { useEffect, useRef, type KeyboardEvent } from 'react';
import { trapTabKey } from '../../lib/accessibility/focus';

interface Props {
  progress: number;
  status: string;
  onCancel: () => void;
}

export function OcrProgress({ progress, status, onCancel }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (trapTabKey(event, dialogRef.current)) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      onCancel();
    }
  };

  return (
    <div
      ref={dialogRef}
      className="ocr-review-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="progress-title"
      tabIndex={-1}
      onKeyDown={onKeyDown}
    >
      <section className="ocr-progress">
        <h1 ref={titleRef} id="progress-title" tabIndex={-1}>
          Reconnaissance du texte
        </h1>
        <progress max="100" value={Math.round(progress * 100)} />
        <p aria-live="polite">
          {status} — {Math.round(progress * 100)} %
        </p>
        <button type="button" onClick={onCancel}>
          Annuler
        </button>
      </section>
    </div>
  );
}
