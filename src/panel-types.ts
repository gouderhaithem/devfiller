export type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
// What the engine recognized a field as, and why. Shown in the side panel.
export interface Detection {
  type: string;          // a field type, "unknown", or "skip:card" and similar
  label: string;         // "Phone", "Card details", "Unknown"
  confidence: number;    // 0..1
  evidence: string[];    // "autocomplete=tel", "label “Téléphone”"
  alternatives: string[];// "Fax 41%"
}
export interface FieldReport {
  id: string;
  label: string;
  status: 'ready' | 'filled' | 'skipped' | 'incompatible';
  reason: string;
  value?: string;
  editable: boolean;
  detected?: Detection;
}
export interface ControlSnapshot { value: string; checked?: boolean; selected?: boolean[] }
export interface UndoEntry { element: Control; before: ControlSnapshot; after: ControlSnapshot }
export interface PanelPageState {
  elements: Map<string, Control>;
  ids: WeakMap<Control, string>;
  reports: Map<Control, FieldReport>;
  undo: UndoEntry[];
}
export interface PanelReply {
  ok: boolean;
  error?: string;
  tabId?: number;
  documentId?: string;
  origin?: string;
  fields?: FieldReport[];
  canUndo?: boolean;
  restored?: number;
  kept?: number;
  overlay?: boolean;
  forms?: Array<{ index: number; type: string; confidence: number; fields: number }>;
  fixture?: { html: string; filename: string };
}
