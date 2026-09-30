// Builds docs/store/listing.html from docs/store/LISTING.md: every field of the Chrome Web Store
// dashboard with a copy button, and a preview of every image to upload.
//
//   npm run store-listing
//
// LISTING.md stays the source; this page only lays it out for copying. It shows this machine's
// file paths, so it is not committed.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..');
const STORE = join(ROOT, 'docs/store');
const markdown = readFileSync(join(STORE, 'LISTING.md'), 'utf8');
const version = JSON.parse(readFileSync(join(ROOT, 'public/manifest.json'), 'utf8')).version;

const escape = text => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const inline = text => escape(text)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
const IMAGE = /\.(png|jpe?g)$/i;

// Paths in LISTING.md are relative to the repository, or to docs/store for bare file names.
function imagePath(path) {
  const inRepo = join(ROOT, path);
  return existsSync(inRepo) ? inRepo : join(STORE, path);
}

let copyId = 0;
function copyField(label, value, note = '') {
  const id = `copy-${++copyId}`;
  const count = value.length > 60 ? `<span class="count">${value.length.toLocaleString('en')} characters</span>` : '';
  const multiline = value.includes('\n') || value.length > 90;
  return `<div class="field">
  <div class="field-head"><span class="label">${inline(label)}</span>${note ? `<span class="note">${inline(note)}</span>` : ''}${count}<button type="button" data-copy="${id}">Copy</button></div>
  ${multiline ? `<pre id="${id}">${escape(value)}</pre>` : `<div class="value" id="${id}">${escape(value)}</div>`}
</div>`;
}

function imageCard(label, path) {
  const file = imagePath(path);
  const src = relative(STORE, file);
  const id = `copy-${++copyId}`;
  return `<figure class="image">
  <img src="${escape(src)}" alt="${escape(label)}" loading="lazy">
  <figcaption><span class="label">${inline(label)}</span><span class="path" id="${id}">${escape(file)}</span><button type="button" data-copy="${id}">Copy path</button></figcaption>
</figure>`;
}

// Turns one "## " section of LISTING.md into fields, images and notes, in order.
function render(section) {
  const lines = section.split('\n');
  const out = [];
  let pendingLabel = null, images = [];
  const flushImages = () => { if (images.length) out.push(`<div class="images">${images.join('\n')}</div>`); images = []; };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    if (line.startsWith('```')) {
      const body = [];
      while (++i < lines.length && !lines[i].startsWith('```')) body.push(lines[i]);
      flushImages();
      out.push(copyField(pendingLabel?.label ?? 'Text', body.join('\n').trim(), pendingLabel?.note));
      pendingLabel = null;
      continue;
    }
    // "**Label**", "**Label** (note)" or "**Label**, more words:" introduces what follows.
    const heading = line.match(/^\*\*([^*:]+)\*\*(.*)$/);
    if (heading) {
      flushImages();
      pendingLabel = { label: heading[1], note: heading[2].replace(/^[\s,]+|[\s:]+$/g, '').replace(/^\((.*)\)$/, '$1') };
      continue;
    }
    const pair = line.match(/^\*\*([^*]+?):\*\*\s*(.+)$/);
    if (pair) {
      const [, label, rawValue] = pair;
      const code = rawValue.match(/^`([^`]+)`$/)?.[1];
      if (code && IMAGE.test(code)) { images.push(imageCard(label, code)); continue; }
      flushImages();
      const value = code ?? rawValue;
      // Plain values (a category, "No") are copied; explanations are shown as notes.
      if (code || /^(https?:\/\/\S+|[\w &-]{1,30})$/.test(value)) out.push(copyField(label, value));
      else out.push(`<p class="hint"><strong>${escape(label)}:</strong> ${inline(value)}</p>`);
      continue;
    }
    const listed = line.match(/^\d+\.\s+`([^`]+)`/);
    if (listed && IMAGE.test(listed[1])) {
      if (pendingLabel) { out.push(`<h3>${inline(pendingLabel.label)}</h3>${pendingLabel.note ? `<p class="hint">${inline(pendingLabel.note)}</p>` : ''}`); pendingLabel = null; }
      images.push(imageCard(`Screenshot ${images.length + 1}`, listed[1]));
      continue;
    }
    if (line.startsWith('|')) {
      const cells = line.split('|').slice(1, -1).map(cell => cell.trim());
      if (cells.every(cell => /^-+$/.test(cell)) || cells[0] === 'Permission') continue;
      flushImages();
      if (pendingLabel) { out.push(`<h3>${inline(pendingLabel.label)}</h3>`); pendingLabel = null; }
      out.push(copyField(cells[0].replace(/`/g, ''), cells[1]));
      continue;
    }
    flushImages();
    // A bold label followed by prose or a list, not a block to copy: show it as a heading.
    if (pendingLabel) { out.push(`<h3>${inline(pendingLabel.label)}</h3>`); pendingLabel = null; }
    out.push(line.startsWith('- ') ? `<p class="bullet">${inline(line.slice(2).replace(/^\[ \]\s*/, '☐ '))}</p>` : `<p class="hint">${inline(line)}</p>`);
  }
  flushImages();
  return out.join('\n');
}

const sections = markdown.split(/^## /m).slice(1).map(part => {
  const [title, ...rest] = part.split('\n');
  return { title: title.trim(), body: rest.join('\n') };
});
const zip = `release/devfiller-${version}.zip`;
const nav = sections.map((s, i) => `<a href="#s${i}">${escape(s.title)}</a>`).join('');
const body = sections.map((s, i) => `<section id="s${i}"><h2>${escape(s.title)}</h2>
${s.title === 'Package' ? copyField('Upload file', join(ROOT, zip), existsSync(join(ROOT, zip)) ? `version ${version}` : `not built yet: run npm run package`) : ''}
${render(s.body)}</section>`).join('\n');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>DevFiller store listing</title>
<style>
:root{--ink:#1f2a5c;--soft:#4d5781;--brand:#5370ce;--line:#e1e6f5;--bg:#f5f7fd;--card:#fff;--code:#f0f3fb;--ok:#2f8a5c}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--ink:#e6e9f8;--soft:#a9b1d6;--brand:#8ea4f0;--line:#2b3357;--bg:#111629;--card:#181f38;--code:#20294a;--ok:#6ce4b0}}
:root[data-theme="dark"]{--ink:#e6e9f8;--soft:#a9b1d6;--brand:#8ea4f0;--line:#2b3357;--bg:#111629;--card:#181f38;--code:#20294a;--ok:#6ce4b0}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}
header{position:sticky;top:0;z-index:2;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(8px);border-bottom:1px solid var(--line)}
.bar{max-width:980px;margin:auto;padding:14px 16px;display:flex;flex-wrap:wrap;align-items:center;gap:8px 20px}
.brand{font-weight:800;font-size:20px;letter-spacing:-.03em}.brand span{color:var(--brand)}
nav{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:14px}nav a{color:var(--soft);text-decoration:none}nav a:hover{color:var(--brand)}
main{max-width:980px;margin:auto;padding:8px 16px 60px}
h2{font-size:22px;letter-spacing:-.02em;margin:34px 0 14px}
h3{font-size:15px;margin:22px 0 8px}
a{color:var(--brand)}
code{background:var(--code);padding:1px 5px;border-radius:4px;font-size:.9em;overflow-wrap:anywhere}
.field{background:var(--card);border:1px solid var(--line);border-radius:10px;margin:10px 0;overflow:hidden}
.field-head{display:flex;flex-wrap:wrap;align-items:center;gap:6px 12px;padding:10px 12px;border-bottom:1px solid var(--line)}
.label{font-weight:650}.note,.count{font-size:13px;color:var(--soft)}
.field-head button,figcaption button{margin-left:auto}
button{font:inherit;font-size:13px;font-weight:600;border:1px solid var(--brand);background:var(--brand);color:#fff;border-radius:7px;padding:5px 12px;cursor:pointer;white-space:nowrap}
button.done{background:var(--ok);border-color:var(--ok)}
.value,pre{margin:0;padding:12px;font:14px/1.6 ui-monospace,SFMono-Regular,Menlo,monospace;white-space:pre-wrap;overflow-wrap:anywhere}
pre{max-height:420px;overflow:auto}
.images{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;margin:12px 0}
.image{margin:0;background:var(--card);border:1px solid var(--line);border-radius:10px;overflow:hidden}
.image img{display:block;width:auto;max-width:100%;height:auto;margin:0 auto;background:var(--code)}
figcaption{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;padding:10px 12px}
.path{flex-basis:100%;order:3;font:12px/1.5 ui-monospace,Menlo,monospace;color:var(--soft);overflow-wrap:anywhere}
.hint{color:var(--soft);margin:8px 0}.bullet{margin:6px 0 6px 4px}
</style>
</head>
<body>
<header><div class="bar"><div class="brand">Dev<span>Filler</span> store listing</div><nav>${nav}</nav></div></header>
<main>
<p class="hint">Generated from <code>docs/store/LISTING.md</code> by <code>npm run store-listing</code>. Copy each field into the <a href="https://chrome.google.com/webstore/devconsole">Chrome Web Store dashboard</a>. For images, click <strong>Copy path</strong> and paste the path into the upload dialog.</p>
${body}
</main>
<script>
document.addEventListener('click', async event => {
  const button = event.target.closest('button[data-copy]');
  if (!button) return;
  const text = document.getElementById(button.dataset.copy).textContent;
  try { await navigator.clipboard.writeText(text); }
  catch {
    const area = Object.assign(document.createElement('textarea'), { value: text });
    document.body.append(area); area.select(); document.execCommand('copy'); area.remove();
  }
  const label = button.textContent;
  button.textContent = 'Copied'; button.classList.add('done');
  setTimeout(() => { button.textContent = label; button.classList.remove('done'); }, 1400);
});
</script>
</body>
</html>
`;
writeFileSync(join(STORE, 'listing.html'), html);
console.log(`Wrote docs/store/listing.html (${copyId} copyable fields).`);
