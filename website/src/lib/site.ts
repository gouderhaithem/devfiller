export const site = {
  name: "DevFiller",
  url: "https://www.devfiller.com",
  description:
    "Free browser extension for Chrome, Firefox and Edge that fills any web form with realistic test data in one click: names, emails, addresses, dates and more, in English, French and Arabic. Built for developers and QA testers.",
  repo: "https://github.com/gouderhaithem/devfiller",
  issues: "https://github.com/gouderhaithem/devfiller/issues",
  author: { name: "Haithem Gouder", url: "https://github.com/gouderhaithem" },
  // The Chrome Web Store listing (approved October 2026). Other Chromium browsers install from it too.
  chromeStoreUrl: "https://chromewebstore.google.com/detail/devfiller-%E2%80%94-test-data-for/neodjaolegipdhfjgjbdlgfehenmeofj" as string | null,
  firefoxStoreUrl: "https://addons.mozilla.org/en-US/firefox/addon/devfiller/",
  edgeStoreUrl: "https://microsoftedge.microsoft.com/addons/detail/devfiller-%E2%80%94-test-data-for/gkckfnfhjapogjbnjllcpacobeolibga",
};

export type StoreId = "chrome" | "firefox" | "edge";
export interface Store {
  id: StoreId;
  browser: string;
  name: string;
  label: string;
  url: string;
}

// Where each browser installs DevFiller, Chrome first.
export const STORES: readonly Store[] = [
  { id: "chrome", browser: "Chrome", name: "Chrome Web Store", label: "Add to Chrome", url: site.chromeStoreUrl ?? "/docs/install/" },
  { id: "firefox", browser: "Firefox", name: "Firefox Add-ons", label: "Add to Firefox", url: site.firefoxStoreUrl },
  { id: "edge", browser: "Edge", name: "Microsoft Edge Add-ons", label: "Add to Edge", url: site.edgeStoreUrl },
];

const byId = (id: StoreId) => STORES.find((store) => store.id === id)!;

// The store for the visitor's browser: Firefox and Edge have their own; Chrome, other Chromium
// browsers (Brave, Opera, Vivaldi) and anything else get the Chrome Web Store.
export function storeFor(userAgent: string): Store {
  if (/\bFirefox\//.test(userAgent)) return byId("firefox");
  if (/\bEdg\//.test(userAgent)) return byId("edge");
  return byId("chrome");
}

export const installHref = byId("chrome").url;
export const installLabel = site.chromeStoreUrl ? "Add to Chrome" : "Install DevFiller";
