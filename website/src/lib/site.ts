export const site = {
  name: "DevFiller",
  url: "https://www.devfiller.com",
  description:
    "DevFiller fills the form on the page you're testing with realistic, fictional data in one click. Free Chrome extension for developers and testers.",
  repo: "https://github.com/gouderhaithem/devfiller",
  issues: "https://github.com/gouderhaithem/devfiller/issues",
  author: { name: "Haithem Gouder", url: "https://github.com/gouderhaithem" },
  // The Chrome Web Store listing (approved October 2026): every install button points here.
  chromeStoreUrl: "https://chromewebstore.google.com/detail/devfiller-%E2%80%94-test-data-for/neodjaolegipdhfjgjbdlgfehenmeofj" as string | null,
};

export const installHref = site.chromeStoreUrl ?? "/docs/install/";
export const installLabel = site.chromeStoreUrl ? "Add to Chrome" : "Install DevFiller";
