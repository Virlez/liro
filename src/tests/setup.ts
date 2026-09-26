import '@testing-library/jest-dom/vitest';
import { webcrypto } from 'node:crypto';
import { beforeEach } from 'vitest';

if (!globalThis.crypto?.subtle) {
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: webcrypto });
}

const memory = new Map<string, unknown>();

Object.defineProperty(globalThis, 'chrome', {
  configurable: true,
  value: {
    storage: {
      local: {
        get: (key: string) => Promise.resolve({ [key]: memory.get(key) }),
        set: (value: Record<string, unknown>) => {
          for (const [key, item] of Object.entries(value)) memory.set(key, item);
          return Promise.resolve();
        },
        remove: (key: string) => {
          memory.delete(key);
          return Promise.resolve();
        },
        clear: () => {
          memory.clear();
          return Promise.resolve();
        },
      },
    },
  },
});

beforeEach(async () => {
  await chrome.storage.local.clear();
});
