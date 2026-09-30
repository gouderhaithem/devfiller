import type { FieldReport, PanelPageState, Control } from '../panel-types';
import type { Classification } from './classify';
import type { CustomField, Values, Exclusions, Identity } from '../data';
import type { FieldSamples } from '../samples';

export type { Control };
export interface UnknownField { signature?:string; id:string; label:string; name:string; placeholder:string; type:string; min:string; max:string; step:string; minLength:number; maxLength:number }
// `index` is the control's position in document.querySelectorAll('input, textarea, select').
export interface ClassifiedField { index:number; type:string; confidence:number }
export interface SuggestedField { signature:string; values:string[] }
export interface FillRequest { aiRequired?:boolean; samples?:FieldSamples; identities?:Identity[]; exclusions?:Exclusions; mode?:'scan'|'inspect'|'classify'; suggestionsExpireAt?:number; suggestions?:Record<string,SuggestedField>; expectedDocument?:string; values: Values; custom: CustomField[]; overwrite: boolean; fillUnknown: boolean; passwords: boolean }
export interface FillResult { classified?:ClassifiedField[]; fields?:FieldReport[]; canUndo?:boolean; unknown?:UnknownField[]; documentId?:string; origin?:string; used?:Record<string,string>; stale?:boolean; filled: number; preserved: number; unmatched: number; invalid: number }

// Everything one fillPage call shares while it walks the page's controls.
export interface FillContext {
  readonly request: FillRequest;
  readonly values: Values;          // the coherent identity and samples chosen for this fill
  readonly controls: readonly Control[];
  readonly exclusions: Exclusions;
  readonly panel?: PanelPageState;
  readonly result: FillResult;
  readonly radioGroups: Set<string>;
  readonly usedText: Set<string>;
  readonly touched: Set<Control>;
  readonly classifications: Map<Control, Classification>;
}

export type Outcome = 'filled' | 'preserved' | 'unmatched' | 'invalid' | 'none';
export interface ControlRun { outcome: Outcome; source: string; aiSkipped?: boolean; reason?: string }

export type PageState = typeof globalThis & { __formlyDocumentId?:string; __formlyPanel?:PanelPageState };
