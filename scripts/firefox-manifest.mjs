// Turns the built Chrome manifest into Firefox's: a background script instead of a service worker,
// the sidebar instead of the side panel (Alt+Shift+F toggles it), and the add-on's ID, minimum
// version and data-collection declaration that addons.mozilla.org requires. The code is the same.
//
//   node scripts/firefox-manifest.mjs <build folder>/manifest.json
import { readFileSync, writeFileSync } from 'node:fs';

const [file] = process.argv.slice(2);
if (!file) { console.error('usage: firefox-manifest.mjs <manifest.json>'); process.exit(2); }
const chrome = JSON.parse(readFileSync(file, 'utf8'));
const { side_panel: sidePanel, minimum_chrome_version: _chromeOnly, background, commands = {}, ...rest } = chrome;
const { 'open-panel': openPanel, ...otherCommands } = commands;

const firefox = {
  ...rest,
  permissions: chrome.permissions.filter(permission => permission !== 'sidePanel'),
  background: { scripts: [background.service_worker], ...(background.type ? { type: background.type } : {}) },
  sidebar_action: { default_panel: sidePanel.default_path, default_title: 'DevFiller', default_icon: chrome.icons, open_at_install: false },
  commands: { ...otherCommands, ...(openPanel ? { _execute_sidebar_action: openPanel } : {}) },
  browser_specific_settings: {
    gecko: {
      id: 'devfiller@devfiller.com',
      strict_min_version: '140.0',
      // Nothing is collected; field descriptions go to an AI provider only if the person turns AI
      // on with their own key, after Firefox asks them (src/browser.ts).
      data_collection_permissions: { required: ['none'], optional: ['websiteContent'] },
    },
    // Firefox for Android reads the data-collection declaration from 142.
    gecko_android: { strict_min_version: '142.0' },
  },
};
writeFileSync(file, JSON.stringify(firefox, null, 2) + '\n');
console.log(`Firefox manifest written to ${file}`);
