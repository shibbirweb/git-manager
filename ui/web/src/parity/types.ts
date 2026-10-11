// A parity case: the app's markup (styled by the app's own CSS) next to the library component, and the element
// pairs whose computed styles must be equal in light and dark.

export type ParityState = "hover" | "focus";

export interface ParityPair {
  name: string;
  /** Selector inside the reference column. */
  ref: string;
  /** Selector inside the library column. */
  lib: string;
  pseudo?: "::before" | "::after";
  states?: ParityState[];
  /** Properties left out for this pair, each with the reason, e.g. `display: inline-flex holds the icon`. */
  ignore?: Record<string, string>;
  /**
   * Known differences where the app is wrong and the library is right, keyed `state:property` (such as
   * `hover:background-color`), each with the reason. They are reported, not failed, until the app is fixed.
   */
  appBugs?: Record<string, string>;
}

export interface ParityCase {
  id: string;
  /** App .svelte files whose <style> styles the reference markup (src/app.css always applies). */
  sources: string[];
  /** The app's markup, as the app renders it. */
  html: string;
  pairs: ParityPair[];
}

/** Computed properties compared for every pair; margins and positions belong to the parent's layout. */
export const PROPERTIES = [
  "width",
  "height",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "border-top-width",
  "border-right-width",
  "border-bottom-width",
  "border-left-width",
  "border-top-style",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "border-top-left-radius",
  "border-top-right-radius",
  "border-bottom-left-radius",
  "border-bottom-right-radius",
  "background-color",
  "color",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "line-height",
  "letter-spacing",
  "text-transform",
  "box-shadow",
  "opacity",
  "column-gap",
  "cursor",
  "white-space",
  "content",
] as const;
