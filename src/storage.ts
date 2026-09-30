import { defaults, validateSettings, type Settings } from './data';
export const isExtension = () => typeof chrome !== 'undefined' && !!chrome.runtime?.id;
export async function readSettings(): Promise<Settings> {
  if (isExtension()) return validateSettings((await chrome.storage.local.get('settings')).settings);
  // The key was 'formly-settings' before the rename; read it once so preview settings carry over.
  const value = localStorage.getItem('devfiller-settings') ?? localStorage.getItem('formly-settings');
  return value ? validateSettings(JSON.parse(value)) : defaults;
}
export async function saveSettings(settings: Settings) {
  if (isExtension()) await chrome.storage.local.set({ settings });
  else localStorage.setItem('devfiller-settings', JSON.stringify(settings));
}
