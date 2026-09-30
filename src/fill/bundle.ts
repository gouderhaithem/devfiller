// Entry point of dist/fill-engine.js, a classic script injected with chrome.scripting `files:`.
// It runs in the extension's isolated world, so the page itself can't reach the engine.
import { fillPage, panelPageAction } from './index';
import { exportFixture } from './export';
import type { EngineGlobal } from './inject';

(globalThis as EngineGlobal).__devfiller = { fillPage, panelPageAction, exportFixture };
