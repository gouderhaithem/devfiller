// Copies images owned by the extension into public/generated so the site never keeps its own copies.
import { cp, mkdir, rm } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../..');
const out = resolve(import.meta.dirname, '../public/generated');
const files = {
  'icon-256.png': 'public/icons/icon-256.png',
  'icon-32.png': 'public/icons/icon-32.png',
  'side-panel.jpg': 'docs/store/1-fill-with-side-panel.jpg',
  'generator.jpg': 'docs/store/2-generator.jpg',
  'ai.jpg': 'docs/store/3-ai-suggestions.jpg',
  'exclusions.jpg': 'docs/store/4-excluded-fields.jpg',
};

await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
for (const [name, source] of Object.entries(files)) await cp(resolve(root, source), resolve(out, name));
// Next.js reads the favicon from the app directory.
await cp(resolve(root, 'public/icons/icon-256.png'), resolve(import.meta.dirname, '../src/app/icon.png'));
console.log(`synced ${Object.keys(files).length} assets`);
