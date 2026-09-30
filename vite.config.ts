import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { build } from 'esbuild';

// The fill engine is injected with chrome.scripting `files:`, so it must be one classic script
// with no imports. esbuild bundles it on its own after Vite writes the rest of the extension.
function fillEngine(): Plugin {
  return {
    name: 'devfiller-fill-engine',
    apply: 'build',
    async closeBundle() {
      await build({ entryPoints: ['src/fill/bundle.ts'], outfile: 'dist/fill-engine.js', bundle: true, format: 'iife', target: 'chrome118', legalComments: 'none', logLevel: 'warning' });
    },
  };
}

export default defineConfig({
  plugins: [react(), fillEngine()],
  base: './',
  build: {
    modulePreload: false,
    rollupOptions: {
      input: { index: 'index.html', welcome: 'welcome.html', sidepanel: 'sidepanel.html', demo: 'demo.html', background: 'src/background.ts' },
      output: { entryFileNames: chunk => chunk.name === 'background' ? 'background.js' : 'assets/[name]-[hash].js' },
    },
  },
});
