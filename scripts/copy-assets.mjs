import { cp, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();
const publicDir = resolve(root, 'public');
const copies = [
  [
    'node_modules/@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-ext-400-normal.woff2',
    'fonts/atkinson-400.woff2',
  ],
  [
    'node_modules/@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-ext-700-normal.woff2',
    'fonts/atkinson-700.woff2',
  ],
  [
    'node_modules/@fontsource/lexend/files/lexend-latin-ext-400-normal.woff2',
    'fonts/lexend-400.woff2',
  ],
  [
    'node_modules/@fontsource/lexend/files/lexend-latin-ext-700-normal.woff2',
    'fonts/lexend-700.woff2',
  ],
  [
    'node_modules/@fontsource/opendyslexic/files/opendyslexic-latin-400-normal.woff2',
    'fonts/opendyslexic-400.woff2',
  ],
  [
    'node_modules/@fontsource/opendyslexic/files/opendyslexic-latin-700-normal.woff2',
    'fonts/opendyslexic-700.woff2',
  ],
  ['node_modules/tesseract.js/dist/worker.min.js', 'ocr/worker.min.js'],
  ['node_modules/tesseract.js-core/tesseract-core.wasm.js', 'ocr/tesseract-core.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core.wasm', 'ocr/tesseract-core.wasm'],
  ['node_modules/tesseract.js-core/tesseract-core-simd.wasm.js', 'ocr/tesseract-core-simd.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-simd.wasm', 'ocr/tesseract-core-simd.wasm'],
  ['node_modules/tesseract.js-core/tesseract-core-lstm.wasm.js', 'ocr/tesseract-core-lstm.wasm.js'],
  ['node_modules/tesseract.js-core/tesseract-core-lstm.wasm', 'ocr/tesseract-core-lstm.wasm'],
  [
    'node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm.js',
    'ocr/tesseract-core-simd-lstm.wasm.js',
  ],
  [
    'node_modules/tesseract.js-core/tesseract-core-simd-lstm.wasm',
    'ocr/tesseract-core-simd-lstm.wasm',
  ],
  [
    'node_modules/@tesseract.js-data/fra/4.0.0_best_int/fra.traineddata.gz',
    'tessdata/fra.traineddata.gz',
  ],
  [
    'node_modules/@tesseract.js-data/eng/4.0.0_best_int/eng.traineddata.gz',
    'tessdata/eng.traineddata.gz',
  ],
];

for (const [source, destination] of copies) {
  const target = resolve(publicDir, destination);
  await mkdir(resolve(target, '..'), { recursive: true });
  await cp(resolve(root, source), target);
}
