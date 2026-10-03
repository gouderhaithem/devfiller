import type { FieldReport, PanelPageState, Control } from '../panel-types';
import type { Classification } from './classify';
import type { CardSetting, FieldKey, TypeRule } from '../data';
import type { Random } from '../rng';
import type { CustomField, Values, Exclusions, Identity, Locale, LocalizedValues } from '../data';
import type { FieldSamples } from '../samples';

export type { Control };
export interface UnknownField { signature?:string; id:string; label:string; name:string; placeholder:string; type:string; min:string; max:string; step:string; minLength:number; maxLength:number }
// `index` is the control's position in document.querySelectorAll('input, textarea, select'), then
// in the open shadow roots, in document order.
export interface ClassifiedField { index:number; type:string; confidence:number }
export interface SuggestedField { signature:string; values:string[] }
// Values in another language, for fields written in it: an Arabic label on an English setup.
export type LocalizedData = Pick<LocalizedValues, 'values'> & Partial<LocalizedValues>;
export interface FillRequest { /** Learned second opinion; off unless asked for. The extension asks by default ("Learned guesses", on since 3 October 2026). */ modelGuesses?:boolean; cards?:CardSetting; localized?:Partial<Record<Locale,LocalizedData>>; typeRules?:TypeRule[]; seed?:string; phones?:Partial<Record<'us'|'fr'|'dz',string>>; aiRequired?:boolean; samples?:FieldSamples; identities?:Identity[]; exclusions?:Exclusions; mode?:'scan'|'inspect'|'classify'; suggestionsExpireAt?:number; suggestions?:Record<string,SuggestedField>; expectedDocument?:string; values: Values; custom: CustomField[]; overwrite: boolean; fillUnknown: boolean; passwords: boolean }
// `index` is the form's position in document.forms.
export interface FormInsight { index:number; type:string; confidence:number; fields:number }
export interface FillResult { widgets?:ClassifiedField[]; forms?:FormInsight[]; classified?:ClassifiedField[]; fields?:FieldReport[]; canUndo?:boolean; unknown?:UnknownField[]; documentId?:string; origin?:string; used?:Record<string,string>; stale?:boolean; filled: number; preserved: number; unmatched: number; invalid: number }

// Everything one fillPage call shares while it walks the page's controls.
export interface FillContext {
  readonly request: FillRequest;
  readonly values: Values;          // the coherent identity and samples chosen for this fill
  readonly localized: Partial<Record<Locale, Values>>; // the same, per other language, for fields written in it
  readonly controls: readonly Control[];
  readonly exclusions: Exclusions;
  readonly panel?: PanelPageState;
  readonly result: FillResult;
  readonly radioGroups: Set<string>;
  readonly usedText: Set<string>;
  readonly touched: Set<Control>;
  readonly classifications: Map<Control, Classification>;
  readonly visible: ReadonlyMap<Control, boolean>; // measured once, before any value is written
  readonly random: (el?: Control) => Random;         // per field, and repeatable with a seed
  readonly fresh: boolean;                           // change each value on every fill (overwrite without a seed)
  readonly filled: Map<Control, FieldKey>;           // recognized values written, for the phone pass
  readonly inForms: boolean;                         // whether the page's fields live in <form> elements
  readonly traps: ReadonlySet<Control>;              // honeypots, measured once, before any value is written
  readonly other: Values;                            // someone else's details: an emergency contact, a manager
  readonly others: Set<Control>;                     // fields filled with them, so phones stay distinct
}

export type Outcome = 'filled' | 'preserved' | 'unmatched' | 'invalid' | 'none';
export interface ControlRun { outcome: Outcome; source: string; aiSkipped?: boolean; reason?: string }

export type PageState = typeof globalThis & { __devfillerDocumentId?:string; __devfillerPanel?:PanelPageState };
