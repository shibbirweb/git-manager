// Where a popover that floats over the window goes: above or below its trigger, lined up with the trigger's start
// or end edge, and moved back inside the window when the trigger is near an edge (a narrow sidebar).

export interface TriggerRect {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface WindowPlace {
  left: number;
  /** Distance from the window's top, for a popover below its trigger. */
  top: number | null;
  /** Distance from the window's bottom, for a popover above its trigger. */
  bottom: number | null;
}

export function windowPlace(
  trigger: TriggerRect,
  panelWidth: number,
  viewport: { width: number; height: number },
  options: { placement: "above" | "below"; align: "start" | "end"; offset: number; inset: number },
): WindowPlace {
  const preferred = options.align === "end" ? trigger.right - panelWidth : trigger.left;
  const furthest = viewport.width - panelWidth - options.inset;
  const left = Math.max(options.inset, Math.min(preferred, furthest));
  if (options.placement === "above") {
    return { left, top: null, bottom: viewport.height - trigger.top + options.offset };
  }
  return { left, top: trigger.bottom + options.offset, bottom: null };
}
