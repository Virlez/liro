import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { ReaderSettings } from '../../models';

interface Props {
  settings: ReaderSettings;
  onChange: (settings: ReaderSettings) => void;
  onDone: (settings: ReaderSettings) => void;
}

interface Choice {
  label: string;
  description: string;
  patch: Partial<ReaderSettings>;
  sampleClass?: string;
}

const STEPS: { title: string; prompt: string; choices: [Choice, Choice] }[] = [
  {
    title: 'Quantité d’air',
    prompt: 'Quel texte te demande le moins d’effort ?',
    choices: [
      {
        label: 'Confortable',
        description: 'Un rythme compact, sans être serré.',
        patch: { densityPreference: 'comfortable', fontSize: 20, lineHeight: 1.65 },
        sampleClass: 'sample-comfortable',
      },
      {
        label: 'Plus aéré',
        description: 'Des lignes plus espacées et plus grandes.',
        patch: { densityPreference: 'airy', fontSize: 22, lineHeight: 1.8 },
        sampleClass: 'sample-airy',
      },
    ],
  },
  {
    title: 'Longueur des lignes',
    prompt: 'Quelle largeur est plus simple à suivre ?',
    choices: [
      {
        label: 'Lignes courtes',
        description: 'Moins de distance à parcourir du regard.',
        patch: { lineWidthPreference: 'compact', columnWidth: 620 },
        sampleClass: 'sample-compact',
      },
      {
        label: 'Lignes larges',
        description: 'Davantage de texte sur chaque ligne.',
        patch: { lineWidthPreference: 'wide', columnWidth: 820 },
        sampleClass: 'sample-wide',
      },
    ],
  },
  {
    title: 'Espacement des mots',
    prompt: 'Dans quelle version les mots se distinguent-ils mieux ?',
    choices: [
      {
        label: 'Naturel',
        description: 'L’espacement habituel du texte.',
        patch: { spacingPreference: 'natural', letterSpacing: 0, wordSpacing: 0 },
        sampleClass: 'sample-natural',
      },
      {
        label: 'Dégagé',
        description: 'Lettres et mots espacés ensemble.',
        patch: { spacingPreference: 'expanded', letterSpacing: 0.04, wordSpacing: 0.16 },
        sampleClass: 'sample-expanded',
      },
    ],
  },
  {
    title: 'Repère visuel',
    prompt: 'Quel repère t’aiderait le mieux à revenir au texte ?',
    choices: [
      {
        label: 'Le paragraphe',
        description: 'Le passage courant reste au premier plan.',
        patch: { guideMode: 'paragraph' },
        sampleClass: 'sample-paragraph-guide',
      },
      {
        label: 'Une ligne',
        description: 'Une règle suit précisément la ligne.',
        patch: { guideMode: 'line' },
        sampleClass: 'sample-line-guide',
      },
    ],
  },
];

export function Calibration({ settings, onChange, onDone }: Props) {
  const [step, setStep] = useState(0);
  const current = STEPS[step]!;
  const titleRef = useRef<HTMLHeadingElement>(null);
  const choiceRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
  }, [step]);

  const choose = (choice: Choice) => {
    const next = { ...settings, ...choice.patch };
    onChange(next);
    if (step === STEPS.length - 1) onDone({ ...next, calibrationCompleted: true });
    else setStep((value) => value + 1);
  };

  const navigateChoices = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
    event.preventDefault();
    const delta = event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 1;
    const next = (index + delta + current.choices.length) % current.choices.length;
    choiceRefs.current[next]?.focus();
  };

  return (
    <main className="calibration-shell" aria-labelledby="calibration-title">
      <div className="calibration-progress" aria-label={`Étape ${step + 1} sur ${STEPS.length}`}>
        <span>Adapter</span>
        <progress value={step + 1} max={STEPS.length} />
        <span>
          {step + 1}/{STEPS.length}
        </span>
      </div>
      <p className="eyebrow">Réglage visuel · environ 30 secondes</p>
      <h1 ref={titleRef} id="calibration-title" tabIndex={-1}>
        {current.title}
      </h1>
      <p className="calibration-prompt">{current.prompt}</p>
      <div className="calibration-choices">
        {current.choices.map((choice, index) => (
          <button
            ref={(element) => {
              choiceRefs.current[index] = element;
            }}
            type="button"
            key={choice.label}
            onKeyDown={(event) => navigateChoices(event, index)}
            onClick={() => choose(choice)}
          >
            <span className={`calibration-sample ${choice.sampleClass ?? ''}`} aria-hidden="true">
              Lire devient plus simple quand chaque idée trouve sa place.
            </span>
            <strong>{choice.label}</strong>
            <small>{choice.description}</small>
          </button>
        ))}
      </div>
      <button
        type="button"
        className="text-button"
        onClick={() => onDone({ ...settings, calibrationCompleted: true })}
      >
        Garder les réglages actuels
      </button>
      <p className="calibration-note">
        Il n’y a pas de bonne réponse universelle. Tout reste modifiable.
      </p>
    </main>
  );
}
