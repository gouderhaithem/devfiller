export const site = {
  name: "DevFiller",
  url: "https://www.devfiller.com",
  description:
    "DevFiller fills the form on the page you're testing with realistic, fictional data in one click. Free Chrome extension for developers and testers.",
  repo: "https://github.com/gouderhaithem/form-filler",
  issues: "https://github.com/gouderhaithem/form-filler/issues",
  // Set this to the listing URL once the Chrome Web Store approves the extension.
  chromeStoreUrl: null as string | null,
};

export const installHref = site.chromeStoreUrl ?? "/docs/install/";
export const installLabel = site.chromeStoreUrl ? "Add to Chrome" : "Install DevFiller";
