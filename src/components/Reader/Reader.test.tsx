import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReaderDocument } from '../../models';
import { DEFAULT_SETTINGS } from '../../features/settings/settings';
import { Reader } from './Reader';

class MockUtterance {
  text: string;
  lang = '';
  rate = 1;
  voice: SpeechSynthesisVoice | null = null;
  onboundary: ((event: SpeechSynthesisEvent) => void) | null = null;
  onend: ((event: SpeechSynthesisEvent) => void) | null = null;
  onerror: ((event: SpeechSynthesisErrorEvent) => void) | null = null;

  constructor(text: string) {
    this.text = text;
  }
}

const documentFixture: ReaderDocument = {
  id: 'speech-flow',
  sourceType: 'selection',
  language: 'fr-FR',
  createdAt: 1,
  blocks: [
    { id: 'first', type: 'paragraph', originalText: 'Première phrase. Deuxième phrase.' },
    { id: 'second', type: 'paragraph', originalText: 'Le paragraphe suivant est lu.' },
  ],
};

const longDocumentFixture: ReaderDocument = {
  id: 'long-speech-flow',
  sourceType: 'selection',
  language: 'fr-FR',
  createdAt: 1,
  blocks: Array.from({ length: 20 }, (_, index) => ({
    id: `paragraph-${index + 1}`,
    type: 'paragraph' as const,
    originalText: `Passage numéro ${index + 1} du texte long.`,
  })),
};

describe('Reader — lecture vocale continue', () => {
  const utterances: MockUtterance[] = [];
  const pause = vi.fn();
  const resume = vi.fn();
  const cancel = vi.fn();

  beforeEach(() => {
    vi.useFakeTimers();
    utterances.length = 0;
    pause.mockClear();
    resume.mockClear();
    cancel.mockClear();
    Object.defineProperty(globalThis, 'SpeechSynthesisUtterance', {
      configurable: true,
      value: MockUtterance,
    });
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: {
        cancel,
        pause,
        resume,
        speak: (utterance: MockUtterance) => utterances.push(utterance),
        getVoices: () => [],
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      },
    });
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({ matches: false }),
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('enchaîne automatiquement le paragraphe suivant après une courte respiration', () => {
    render(
      <Reader
        document={documentFixture}
        initialSettings={{
          ...DEFAULT_SETTINGS,
          calibrationCompleted: true,
          progressEnabled: false,
        }}
        onClose={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Écouter la suite' }));
    expect(utterances).toHaveLength(1);
    expect(utterances[0]?.text).toContain('Première phrase');

    act(() => utterances[0]?.onend?.({} as SpeechSynthesisEvent));
    expect(screen.getAllByText(/Étape 2 sur 2/).length).toBeGreaterThan(0);

    act(() => {
      vi.advanceTimersByTime(140);
    });
    expect(utterances).toHaveLength(2);
    expect(utterances[1]?.text).toBe('Le paragraphe suivant est lu.');
  });

  it('conserve pause et reprise pendant la lecture continue', () => {
    render(
      <Reader
        document={documentFixture}
        initialSettings={{
          ...DEFAULT_SETTINGS,
          calibrationCompleted: true,
          progressEnabled: false,
        }}
        onClose={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Écouter la suite' }));
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    expect(pause).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole('button', { name: 'Reprendre' }));
    expect(resume).toHaveBeenCalledOnce();
  });

  it('démarre automatiquement la voix quand le popup le demande', () => {
    render(
      <Reader
        document={documentFixture}
        initialSettings={{
          ...DEFAULT_SETTINGS,
          calibrationCompleted: true,
          progressEnabled: false,
        }}
        autoPlay
        onClose={() => undefined}
      />,
    );

    act(() => {
      vi.runOnlyPendingTimers();
    });
    expect(utterances).toHaveLength(1);
    expect(utterances[0]?.text).toContain('Première phrase');
    expect(screen.getByRole('button', { name: 'Pause' })).toBeVisible();
  });

  it('encourage au quart du texte sans interrompre la lecture vocale', () => {
    render(
      <Reader
        document={longDocumentFixture}
        initialSettings={{
          ...DEFAULT_SETTINGS,
          calibrationCompleted: true,
          progressEnabled: false,
          encouragementsEnabled: true,
        }}
        onClose={() => undefined}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Écouter la suite' }));
    for (let index = 0; index < 5; index += 1) {
      act(() => utterances[index]?.onend?.({} as SpeechSynthesisEvent));
      act(() => {
        vi.advanceTimersByTime(140);
      });
    }

    expect(screen.getByRole('status')).toHaveTextContent('un quart du texte');
    expect(cancel).toHaveBeenCalledOnce();
    expect(pause).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(4_000);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('n’affiche rien quand les encouragements sont désactivés', () => {
    render(
      <Reader
        document={longDocumentFixture}
        initialSettings={{
          ...DEFAULT_SETTINGS,
          calibrationCompleted: true,
          progressEnabled: false,
          encouragementsEnabled: false,
        }}
        onClose={() => undefined}
      />,
    );

    for (let index = 0; index < 5; index += 1)
      fireEvent.click(screen.getByRole('button', { name: 'Continuer' }));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('déplace le focus avec les flèches et les touches Page depuis le passage', () => {
    render(
      <Reader
        document={documentFixture}
        initialSettings={{
          ...DEFAULT_SETTINGS,
          calibrationCompleted: true,
          progressEnabled: false,
        }}
        onClose={() => undefined}
      />,
    );

    act(() => {
      vi.runOnlyPendingTimers();
    });
    const first = screen.getByRole('article', { name: 'Étape 1' });
    expect(first).toHaveFocus();
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    act(() => {
      vi.runOnlyPendingTimers();
    });
    const second = screen.getByRole('article', { name: 'Étape 2' });
    expect(second).toHaveFocus();

    fireEvent.keyDown(second, { key: 'PageUp' });
    act(() => {
      vi.runOnlyPendingTimers();
    });
    expect(screen.getByRole('article', { name: 'Étape 1' })).toHaveFocus();
  });

  it('ne déclenche pas la voix quand Espace est utilisé sur un bouton', () => {
    render(
      <Reader
        document={documentFixture}
        initialSettings={{
          ...DEFAULT_SETTINGS,
          calibrationCompleted: true,
          progressEnabled: false,
        }}
        onClose={() => undefined}
      />,
    );

    fireEvent.keyDown(screen.getByRole('button', { name: 'Continuer' }), { key: ' ' });
    expect(utterances).toHaveLength(0);
  });

  it('piège le focus dans l’aide et le restaure à son déclencheur', () => {
    render(
      <Reader
        document={documentFixture}
        initialSettings={{
          ...DEFAULT_SETTINGS,
          calibrationCompleted: true,
          progressEnabled: false,
        }}
        onClose={() => undefined}
      />,
    );

    const trigger = screen.getByRole('button', { name: 'Raccourcis clavier' });
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Raccourcis clavier' });
    expect(screen.getByRole('heading', { name: 'Raccourcis clavier' })).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(screen.getByRole('button', { name: 'Fermer l’aide' })).toHaveFocus();

    fireEvent.keyDown(dialog, { key: 'Escape' });
    act(() => {
      vi.runOnlyPendingTimers();
    });
    expect(screen.queryByRole('dialog', { name: 'Raccourcis clavier' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });
});
