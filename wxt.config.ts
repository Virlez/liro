import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  srcDir: 'src',
  manifest: {
    name: 'Liro — Garde le fil',
    short_name: 'Liro',
    description: 'Garde le fil et va au bout des textes du web, à ton rythme.',
    version: '0.1.0',
    icons: {
      16: 'icons/icon-16.png',
      32: 'icons/icon-32.png',
      48: 'icons/icon-48.png',
      128: 'icons/icon-128.png',
    },
    permissions: ['activeTab', 'scripting', 'storage', 'offscreen'],
    action: {
      default_title: 'Garder le fil avec Liro',
      default_icon: {
        16: 'icons/icon-16.png',
        32: 'icons/icon-32.png',
      },
    },
    commands: {
      'open-reader': {
        suggested_key: { default: 'Alt+Shift+L' },
        description: 'Lire la sélection ou l’article principal dans Liro',
      },
      'open-reader-speech': {
        suggested_key: { default: 'Alt+Shift+V' },
        description: 'Ouvrir Liro et démarrer la lecture vocale',
      },
    },
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
    },
    web_accessible_resources: [
      {
        resources: ['fonts/*'],
        matches: ['<all_urls>'],
      },
    ],
    ...(process.env.LIGNECLAIRE_E2E === '1' ? { host_permissions: ['<all_urls>'] } : {}),
  },
});
