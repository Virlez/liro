import { afterEach, describe, expect, it } from 'vitest';
import { selectArea } from './selectArea';

describe('sélecteur OCR au clavier', () => {
  afterEach(() => {
    document.querySelector('#ligneclaire-area-selector')?.remove();
  });

  it('scanne toute la zone visible avec Entrée', async () => {
    const result = selectArea();
    const host = document.querySelector<HTMLDivElement>('#ligneclaire-area-selector')!;
    const mask = host.shadowRoot!.querySelector<HTMLElement>('.mask')!;
    expect(host.shadowRoot!.activeElement).toBe(mask);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    await expect(result).resolves.toEqual({
      x: 0,
      y: 0,
      width: window.innerWidth,
      height: window.innerHeight,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
    });
  });

  it('annule avec Échap et restaure le focus', async () => {
    const source = document.createElement('button');
    document.body.append(source);
    source.focus();
    const result = selectArea();

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    await expect(result).resolves.toBeNull();
    expect(source).toHaveFocus();
    source.remove();
  });
});
