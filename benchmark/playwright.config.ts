import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: '.', testMatch: 'run.bench.ts', outputDir: 'results/playwright', timeout: 600_000, workers: 1, reporter: [['list']], use: { headless: true } });
