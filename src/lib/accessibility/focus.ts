const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'summary',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

interface FocusTrapEvent {
  key: string;
  shiftKey: boolean;
  target: EventTarget | null;
  preventDefault: () => void;
}

function isAvailable(element: HTMLElement): boolean {
  if (element.hasAttribute('disabled') || element.getAttribute('aria-disabled') === 'true')
    return false;
  if (element.closest('[hidden], [aria-hidden="true"]')) return false;
  const style = window.getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    isAvailable,
  );
}

export function trapTabKey(event: FocusTrapEvent, container: HTMLElement | null): boolean {
  if (event.key !== 'Tab' || !container) return false;
  const focusable = getFocusableElements(container);
  if (!focusable.length) {
    event.preventDefault();
    container.focus();
    return true;
  }

  const first = focusable[0]!;
  const last = focusable[focusable.length - 1]!;
  const active = event.target instanceof HTMLElement ? event.target : null;
  const activeIndex = active ? focusable.indexOf(active) : -1;

  if (activeIndex === -1 && active && container.contains(active)) {
    const relation = event.shiftKey
      ? focusable.findLast((element) =>
          Boolean(element.compareDocumentPosition(active) & Node.DOCUMENT_POSITION_FOLLOWING),
        )
      : focusable.find((element) =>
          Boolean(active.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING),
        );
    event.preventDefault();
    (relation ?? (event.shiftKey ? last : first)).focus();
    return true;
  }

  if (event.shiftKey && (activeIndex <= 0 || active === container)) {
    event.preventDefault();
    last.focus();
    return true;
  }
  if (!event.shiftKey && (activeIndex === -1 || activeIndex === focusable.length - 1)) {
    event.preventDefault();
    first.focus();
    return true;
  }
  return false;
}

export function focusWithoutScroll(element: HTMLElement | null | undefined): void {
  element?.focus({ preventScroll: true });
}
