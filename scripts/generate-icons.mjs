import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const outputDirectory = resolve('public/icons');
await mkdir(outputDirectory, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const source = pathToFileURL(resolve('public/brand/icon.svg')).href;

for (const size of [16, 32, 48, 128]) {
  await page.setViewportSize({ width: size, height: size });
  await page.goto(source);
  await page.screenshot({
    path: resolve(outputDirectory, `icon-${size}.png`),
    omitBackground: true,
  });
}

await browser.close();
