import { readFile } from "node:fs/promises";
import path from "node:path";

export interface DocPage {
  slug: string;
  title: string;
  description: string;
  /** Markdown file, relative to the repository root, so shared docs keep one source. */
  source: string;
  /** Drop everything from this heading on, when a shared file carries unrelated sections. */
  cutAt?: string;
}

export const DOC_GROUPS: { title: string; pages: DocPage[] }[] = [
  {
    title: "Getting started",
    pages: [
      { slug: "", title: "Introduction", description: "What DevFiller does and how a fill works.", source: "website/content/docs/index.md" },
      { slug: "install", title: "Install", description: "Add DevFiller to Chrome and fill your first form.", source: "website/content/docs/install.md" },
    ],
  },
  {
    title: "Using DevFiller",
    pages: [
      { slug: "side-panel", title: "Side panel", description: "Inspect every field, fix one, and undo a fill.", source: "website/content/docs/side-panel.md" },
      { slug: "generated-data", title: "Generated data", description: "Languages, replacement, unknown fields and passwords.", source: "website/content/docs/generated-data.md" },
      { slug: "field-types", title: "Field types", description: "The 42 field types and the labels DevFiller recognizes.", source: "FIELD_GUIDE.md", cutAt: "## Additional ideas" },
      { slug: "custom-fields", title: "Custom fields", description: "Give a field an exact test value.", source: "website/content/docs/custom-fields.md" },
      { slug: "excluded-fields", title: "Excluded fields", description: "Keep fields untouched, everywhere or on one site.", source: "website/content/docs/excluded-fields.md" },
      { slug: "ai", title: "AI suggestions", description: "Optional Groq or Gemini suggestions for unusual fields.", source: "website/content/docs/ai.md" },
    ],
  },
  {
    title: "Reference",
    pages: [
      { slug: "privacy-permissions", title: "Privacy and permissions", description: "What is stored, what is sent, and why each permission exists.", source: "website/content/docs/privacy-permissions.md" },
      { slug: "limits", title: "Limits and troubleshooting", description: "Where DevFiller can't fill, and what to try.", source: "website/content/docs/limits.md" },
    ],
  },
  {
    title: "Developers",
    pages: [
      { slug: "npm-package", title: "npm package (planned)", description: "The draft plan for devfiller as a dev dependency.", source: "website/content/docs/npm-package.md" },
      { slug: "build-from-source", title: "Build from source", description: "Run, test and package the extension locally.", source: "website/content/docs/build-from-source.md" },
    ],
  },
];

export const DOC_PAGES = DOC_GROUPS.flatMap((group) => group.pages);

export const docHref = (page: DocPage) => (page.slug ? `/docs/${page.slug}/` : "/docs/");

export function findDoc(slug: string) {
  return DOC_PAGES.find((page) => page.slug === slug);
}

const repoRoot = path.join(process.cwd(), "..");

/** Reads a page's Markdown at build time, dropping its own H1 because the layout renders the title. */
export async function loadDoc(page: DocPage) {
  let markdown = await readFile(path.join(repoRoot, page.source), "utf8");
  if (page.cutAt) markdown = markdown.split(page.cutAt)[0];
  return markdown.replace(/^# .*\n+/, "");
}

export function neighbours(page: DocPage) {
  const index = DOC_PAGES.indexOf(page);
  return { previous: DOC_PAGES[index - 1], next: DOC_PAGES[index + 1] };
}
