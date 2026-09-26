import { useEffect, useRef, type KeyboardEvent } from 'react';
import type { FlowDocument, ReaderDocument, ReadingNeed } from '../../models';

interface Props {
  document: ReaderDocument;
  flow: FlowDocument;
  needs: ReadingNeed[];
  resumeIndex?: number;
  onToggleNeed: (need: ReadingNeed) => void;
  onStart: (index: number) => void;
}

const NEEDS: { id: ReadingNeed; title: string; description: string }[] = [
  { id: 'start', title: 'Commencer', description: 'Me donner une première étape courte.' },
  { id: 'focus', title: 'Garder le fil', description: 'Réduire le bruit autour du passage.' },
  { id: 'decode', title: 'Décoder', description: 'Aérer et renforcer les repères du texte.' },
  { id: 'resume', title: 'Reprendre', description: 'Retrouver exactement ma dernière étape.' },
];

export function FlowMap({ document, flow, needs, resumeIndex, onToggleNeed, onStart }: Props) {
  const titleRef = useRef<HTMLHeadingElement>(null);
  const sectionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
  }, []);

  const navigateSections = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next = index;
    if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next += 1;
    else if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') next -= 1;
    else if (event.key === 'Home') next = 0;
    else if (event.key === 'End') next = flow.sections.length - 1;
    else return;
    event.preventDefault();
    const bounded = Math.max(0, Math.min(flow.sections.length - 1, next));
    sectionRefs.current[bounded]?.focus();
  };

  return (
    <main className="flow-map" aria-labelledby="flow-map-title">
      <p className="eyebrow">Comprendre avant de se lancer</p>
      <h1 ref={titleRef} id="flow-map-title" tabIndex={-1}>
        {document.title || 'Ton texte, étape par étape'}
      </h1>
      <p className="map-meta">
        Environ {flow.estimatedMinutes} min · {flow.sections.length} section
        {flow.sections.length > 1 ? 's' : ''} · {flow.chunks.length} étape
        {flow.chunks.length > 1 ? 's' : ''}
      </p>

      <section className="needs-panel" aria-labelledby="needs-title">
        <div>
          <p className="eyebrow">Adapter maintenant</p>
          <h2 id="needs-title">Qu’est-ce qui te bloque ?</h2>
          <p>Choisis une ou plusieurs aides. Aucun diagnostic n’est nécessaire.</p>
        </div>
        <div className="need-grid">
          {NEEDS.map((need) => {
            const unavailable = need.id === 'resume' && resumeIndex === undefined;
            return (
              <button
                type="button"
                key={need.id}
                aria-pressed={needs.includes(need.id)}
                disabled={unavailable}
                onClick={() => onToggleNeed(need.id)}
              >
                <strong>{need.title}</strong>
                <small>{unavailable ? 'Aucune reprise pour ce texte.' : need.description}</small>
              </button>
            );
          })}
        </div>
      </section>

      {resumeIndex !== undefined && (
        <section className="resume-card" aria-label="Reprendre la lecture">
          <div>
            <span className="resume-icon" aria-hidden="true">
              ↗
            </span>
            <div>
              <strong>Reprendre là où tu étais</strong>
              <p>
                Étape {resumeIndex + 1} sur {flow.chunks.length}, avec le contexte autour.
              </p>
            </div>
          </div>
          <button type="button" className="primary" onClick={() => onStart(resumeIndex)}>
            Reprendre
          </button>
        </section>
      )}

      <section className="document-map" aria-labelledby="document-map-title">
        <div className="map-heading">
          <h2 id="document-map-title">Carte du texte</h2>
          <button type="button" className="primary" onClick={() => onStart(0)}>
            Commencer
          </button>
        </div>
        <ol>
          {flow.sections.map((section, index) => (
            <li key={section.id}>
              <button
                ref={(element) => {
                  sectionRefs.current[index] = element;
                }}
                type="button"
                onKeyDown={(event) => navigateSections(event, index)}
                onClick={() => onStart(section.chunkIndexes[0] ?? 0)}
              >
                <span>{String(index + 1).padStart(2, '0')}</span>
                <strong>{section.title}</strong>
                <small>
                  {section.chunkIndexes.length} étape{section.chunkIndexes.length > 1 ? 's' : ''}
                </small>
              </button>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}
