export type Intent = "inhouse" | "delivery" | "consult";
export type Occasion = "geburtstag" | "firmenfeier" | "hochzeit" | "weihnachtsfeier" | "privat" | "sonstiges";
export type PeopleBucket = "2-10" | "11-25" | "26-50" | "51-100" | "100+";
export type DateMode = "fixed" | "flexible" | "open";
export type Format =
  | "a_la_carte"
  | "3_gaenge"
  | "aperitivo_flying_buffet"
  | "exklusivmiete"
  | "fingerfood"
  | "pizza_napoletana"
  | "warme_auflaeufe"
  | "komplett_buffet"
  | "beratung";

export type FunnelState = {
  step: number;
  intent: Intent | null;
  occasion: Occasion | null;
  occasion_other: string;
  people_bucket: PeopleBucket | null;
  date_mode: DateMode | null;
  date_value: string;
  date_range_start: string;
  date_range_end: string;
  format: Format | null;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  notes: string;
  gdpr_consent: boolean;
};

export const initialFunnelState: FunnelState = {
  step: 0,
  intent: null,
  occasion: null,
  occasion_other: "",
  people_bucket: null,
  date_mode: null,
  date_value: "",
  date_range_start: "",
  date_range_end: "",
  format: null,
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  notes: "",
  gdpr_consent: false,
};

export type FunnelAction =
  | { type: "SET"; patch: Partial<FunnelState> }
  | { type: "NEXT" }
  | { type: "BACK" }
  | { type: "GOTO"; step: number }
  | { type: "RESET" };

export function funnelReducer(state: FunnelState, action: FunnelAction): FunnelState {
  switch (action.type) {
    case "SET": return { ...state, ...action.patch };
    case "NEXT": return { ...state, step: state.step + 1 };
    case "BACK": return { ...state, step: Math.max(0, state.step - 1) };
    case "GOTO": return { ...state, step: action.step };
    case "RESET": return { ...initialFunnelState };
    default: return state;
  }
}

export function totalSteps(intent: Intent | null): number {
  // Step 0 (intent) is the entry; visible progress dots cover steps 1..N
  // intent=consult skips Format → 4 visible dots; otherwise 5
  return intent === "consult" ? 4 : 5;
}