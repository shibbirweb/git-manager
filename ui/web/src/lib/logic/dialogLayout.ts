// Each Dialog variant's place over the window: its layer (a Git form opens under a confirm it may ask) and how
// far from the top it sits. A view dialog is centered instead.
export type DialogVariant = "message" | "form" | "split" | "panel" | "view";

export const DIALOG_OVERLAY: Record<DialogVariant, { layer: number; top: string }> = {
  message: { layer: 900, top: "14vh" },
  form: { layer: 850, top: "10vh" },
  split: { layer: 850, top: "8vh" },
  panel: { layer: 855, top: "8vh" },
  view: { layer: 840, top: "0" },
};

/** An urgent dialog (a sign-in a running git command waits on) shows over every other dialog. */
export const URGENT_DIALOG_LAYER = 950;
