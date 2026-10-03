// What differs between Chrome (and Edge) and Firefox. One code base serves both; the Firefox build
// only swaps the manifest (scripts/firefox-manifest.mjs).

interface FirefoxApi { sidebarAction?: { open(): Promise<void> } }
type Request = { origins?: string[]; data_collection?: string[] };
interface Permissions { request(p: Request): Promise<boolean>; contains(p: Request): Promise<boolean> }

const firefoxApi = () => (globalThis as { browser?: FirefoxApi }).browser;

export const isFirefox = () => typeof navigator !== 'undefined' && /\bFirefox\//.test(navigator.userAgent);

// Chrome has a side panel; Firefox has a sidebar instead. Call it straight from the click or
// shortcut: both browsers open their panel only in response to a user's action.
export function openPanel(windowId: number): void {
  if (chrome.sidePanel) void chrome.sidePanel.open({ windowId }).catch(() => {});
  else void firefoxApi()?.sidebarAction?.open().catch(() => {});
}

// Firefox asks people before an add-on sends website content anywhere: AI suggestions send field
// descriptions (labels, names, placeholders) to the provider, so Firefox's consent comes first.
// Chrome declares this in its store listing instead, and never asks.
const AI_DATA: Request = { data_collection: ['websiteContent'] };
const permissions = () => chrome.permissions as unknown as Permissions;

// What turning AI on needs: in Firefox, consent and any website access in one request, because a
// second request after the first prompt is no longer part of the click and Firefox refuses it.
export function requestAiAccess(origins?: string[]): Promise<boolean> {
  if (isFirefox()) return permissions().request({ ...(origins ? { origins } : {}), ...AI_DATA });
  return origins ? permissions().request({ origins }) : Promise.resolve(true);
}

export async function hasAiConsent(): Promise<boolean> {
  return isFirefox() ? permissions().contains(AI_DATA) : true;
}
