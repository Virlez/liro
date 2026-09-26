import type { TextSelectionRect } from '../../models';

export function selectArea(): Promise<TextSelectionRect | null> {
  return new Promise((resolve) => {
    const originFocus = document.activeElement as HTMLElement | null;
    const host = document.createElement('div');
    host.id = 'ligneclaire-area-selector';
    const shadow = host.attachShadow({ mode: 'open' });
    const style = document.createElement('style');
    style.textContent = `:host{all:initial}.mask{position:fixed;inset:0;z-index:2147483647;background:rgba(6,12,22,.42);cursor:crosshair}.box{position:fixed;border:3px solid #fff;background:rgba(31,111,235,.15);box-shadow:0 0 0 1px #0b57d0;pointer-events:none}.hint{position:fixed;top:16px;left:50%;transform:translateX(-50%);padding:10px 14px;border-radius:8px;background:#fff;color:#172033;font:600 16px system-ui;box-shadow:0 5px 20px rgba(0,0,0,.25)}`;
    const mask = document.createElement('div');
    mask.className = 'mask';
    mask.setAttribute('role', 'dialog');
    mask.setAttribute('aria-modal', 'true');
    mask.setAttribute('aria-label', 'Sélectionner une zone à numériser');
    mask.setAttribute('aria-describedby', 'liro-ocr-selector-instructions');
    mask.tabIndex = 0;
    mask.innerHTML =
      '<div class="hint" id="liro-ocr-selector-instructions">Dessinez un rectangle · Entrée pour scanner l’écran visible · Échap pour annuler</div>';
    const box = document.createElement('div');
    box.className = 'box';
    mask.append(box);
    shadow.append(style, mask);
    document.documentElement.append(host);
    let startX = 0;
    let startY = 0;
    let active = false;
    const finish = (value: TextSelectionRect | null) => {
      window.removeEventListener('keydown', keydown, true);
      host.remove();
      if (!value) originFocus?.focus({ preventScroll: true });
      resolve(value);
    };
    const keydown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        finish(null);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        finish({
          x: 0,
          y: 0,
          width: window.innerWidth,
          height: window.innerHeight,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          devicePixelRatio: window.devicePixelRatio,
        });
      } else if (event.key === 'Tab') {
        event.preventDefault();
        mask.focus({ preventScroll: true });
      }
    };
    window.addEventListener('keydown', keydown, true);
    mask.focus({ preventScroll: true });
    mask.addEventListener('pointerdown', (event) => {
      active = true;
      startX = event.clientX;
      startY = event.clientY;
      mask.setPointerCapture(event.pointerId);
    });
    mask.addEventListener('pointermove', (event) => {
      if (!active) return;
      const x = Math.min(startX, event.clientX);
      const y = Math.min(startY, event.clientY);
      box.style.left = `${x}px`;
      box.style.top = `${y}px`;
      box.style.width = `${Math.abs(event.clientX - startX)}px`;
      box.style.height = `${Math.abs(event.clientY - startY)}px`;
    });
    mask.addEventListener('pointerup', (event) => {
      if (!active) return;
      active = false;
      const x = Math.min(startX, event.clientX);
      const y = Math.min(startY, event.clientY);
      const width = Math.abs(event.clientX - startX);
      const height = Math.abs(event.clientY - startY);
      if (width < 24 || height < 24) {
        finish(null);
        return;
      }
      finish({
        x,
        y,
        width,
        height,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio,
      });
    });
  });
}
