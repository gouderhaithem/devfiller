export const site = {
  name: "DevFiller",
  url: "https://www.devfiller.com",
  description:
    "Free Chrome extension that fills any web form with realistic test data in one click: names, emails, addresses, dates and more, in English, French and Arabic. Built for developers and QA testers.",
  repo: "https://github.com/gouderhaithem/devfiller",
  issues: "https://github.com/gouderhaithem/devfiller/issues",
  author: { name: "Haithem Gouder", url: "https://github.com/gouderhaithem" },
  // The Chrome Web Store listing (approved October 2026): every install button points here.
  chromeStoreUrl: "https://chromewebstore.google.com/detail/devfiller-%E2%80%94-test-data-for/neodjaolegipdhfjgjbdlgfehenmeofj" as string | null,
};

export const installHref = site.chromeStoreUrl ?? "/docs/install/";
export const installLabel = site.chromeStoreUrl ? "Add to Chrome" : "Install DevFiller";
