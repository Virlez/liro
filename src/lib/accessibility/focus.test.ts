import { describe, expect, it, vi } from 'vitest';
import { getFocusableElements, trapTabKey } from './focus';

describe('gestion du focus', () => {
  it('ignore les contrôles masqués et désactivés', () => {
    document.body.innerHTML = `
      <section id="dialog">
        <button id="first">Premier</button>
        <button disabled>Inactif</button>
        <div hidden><button>Masqué</button></div>
        <button id="last">Dernier</button>
      </section>
    `;
    const dialog = document.querySelector<HTMLElement>('#dialog')!;
    expect(getFocusableElements(dialog).map((element) => element.id)).toEqual(['first', 'last']);
  });

  it('boucle Tab et Maj+Tab dans la fenêtre active', () => {
    document.body.innerHTML = `
      <section id="dialog">
        <button id="first">Premier</button>
        <button id="last">Dernier</button>
      </section>
    `;
    const dialog = document.querySelector<HTMLElement>('#dialog')!;
    const first = document.querySelector<HTMLButtonElement>('#first')!;
    const last = document.querySelector<HTMLButtonElement>('#last')!;
    const preventDefault = vi.fn();

    expect(trapTabKey({ key: 'Tab', shiftKey: false, target: last, preventDefault }, dialog)).toBe(
      true,
    );
    expect(first).toHaveFocus();

    expect(trapTabKey({ key: 'Tab', shiftKey: true, target: first, preventDefault }, dialog)).toBe(
      true,
    );
    expect(last).toHaveFocus();
    expect(preventDefault).toHaveBeenCalledTimes(2);
  });

  it('part d’un titre focalisé vers le contrôle suivant dans l’ordre du document', () => {
    document.body.innerHTML = `
      <section id="dialog">
        <button id="before">Avant</button>
        <h2 id="title" tabindex="-1">Titre</h2>
        <button id="after">Après</button>
      </section>
    `;
    const dialog = document.querySelector<HTMLElement>('#dialog')!;
    const title = document.querySelector<HTMLElement>('#title')!;

    trapTabKey({ key: 'Tab', shiftKey: false, target: title, preventDefault: vi.fn() }, dialog);
    expect(document.querySelector('#after')).toHaveFocus();
  });
});
