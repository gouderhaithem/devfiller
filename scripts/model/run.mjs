// Runs a TypeScript script of this folder: node scripts/model/run.mjs <dataset|train|evaluate|compare> [args]
import { build } from 'esbuild';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const [name, ...args] = process.argv.slice(2);
if (!['dataset', 'train', 'evaluate', 'compare'].includes(name)) { console.error('usage: run.mjs <dataset|train|evaluate|compare>'); process.exit(2); }
const outfile = resolve('node_modules/.cache/devfiller-model', `${name}.mjs`);
await build({ entryPoints: [resolve('scripts/model', `${name}.ts`)], bundle: true, platform: 'node', format: 'esm', outfile, external: ['playwright', 'esbuild'], logLevel: 'warning', loader: { '.json': 'json' } });
process.argv = [process.argv[0], outfile, ...args];
await import(pathToFileURL(outfile).href);
