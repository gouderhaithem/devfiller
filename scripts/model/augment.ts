// Rewordings of training fields, so the model learns patterns rather than the exact wording of the
// training pages. Used on training pages only, never on validation or sealed pages.
import type { FieldInfo } from '../../src/fill/features';
import { ALIAS_ENTRIES } from '../../src/fill/dictionary';
import { SOURCE_GROUP } from '../../src/fill/classify';
import type { Rng } from './rng';

const ALIASES_BY_KEY = new Map<string, string[]>();
for (const entry of ALIAS_ENTRIES) if (!entry.generic) ALIASES_BY_KEY.set(entry.key, [...(ALIASES_BY_KEY.get(entry.key) ?? []), entry.name]);
const PREFIXES = ['user', 'billing', 'customer', 'contact', 'form', 'your', 'applicant', 'field'];

const visible = (source: string) => SOURCE_GROUP[source as keyof typeof SOURCE_GROUP] === 'visible';
const attribute = (source: string) => SOURCE_GROUP[source as keyof typeof SOURCE_GROUP] === 'attribute';

function typo(text: string, rng: Rng): string {
  const tokens = text.split(' ');
  const long = tokens.map((token, i) => [token, i] as const).filter(([token]) => token.length >= 5);
  if (!long.length) return text;
  const [token, i] = long[rng.int(long.length)];
  const k = 1 + rng.int(token.length - 2);
  const edits = [
    () => token.slice(0, k) + token.slice(k + 1),                                // drop a letter
    () => token.slice(0, k - 1) + token[k] + token[k - 1] + token.slice(k + 1),   // swap two
    () => token.slice(0, k) + token[k] + token.slice(k),                          // double one
  ];
  tokens[i] = edits[rng.int(edits.length)]();
  return tokens.join(' ');
}

// One variant of a field: each kind changes one thing, as real forms differ from each other.
const KINDS: Array<(info: FieldInfo, expect: string, rng: Rng) => FieldInfo | undefined> = [
  // Another alias of the same type in place of the visible label.
  (info, expect, rng) => {
    const aliases = ALIASES_BY_KEY.get(expect);
    if (!aliases?.length || !info.signals.some(s => visible(s.source))) return undefined;
    const alias = aliases[rng.int(aliases.length)];
    return { ...info, signals: info.signals.map(s => visible(s.source) ? { ...s, text: alias } : s) };
  },
  // A typo in the label.
  (info, _, rng) => info.signals.some(s => visible(s.source)) ? { ...info, signals: info.signals.map(s => visible(s.source) ? { ...s, text: typo(s.text, rng) } : s) } : undefined,
  // Another naming style: a prefix, glued words, or a generated name that says nothing.
  (info, _, rng) => {
    if (!info.signals.some(s => attribute(s.source))) return undefined;
    const style = rng.int(3);
    if (style === 2) return { ...info, signals: info.signals.filter(s => !attribute(s.source)) };
    return { ...info, signals: info.signals.map(s => !attribute(s.source) ? s : { ...s, text: style === 0 ? `${PREFIXES[rng.int(PREFIXES.length)]} ${s.text}` : s.text.replace(/ /g, '') }) };
  },
  // A missing clue: no label, no name and id, or no section.
  (info, _, rng) => {
    const drop = [visible, attribute, (source: string) => source === 'legend'][rng.int(3)];
    const signals = info.signals.filter(s => !drop(s.source));
    return signals.length && signals.length < info.signals.length ? { ...info, signals } : undefined;
  },
];

// Variants change the words, so the rules' first-pass answers no longer belong to them.
export function augment(info: FieldInfo, expect: string, rng: Rng, count: number): FieldInfo[] {
  const out: FieldInfo[] = [];
  for (let attempt = 0; out.length < count && attempt < count * 3; attempt++) {
    const variant = KINDS[attempt % KINDS.length](info, expect, rng);
    if (variant) out.push({ ...variant, rule: [] });
  }
  return out;
}
