// Selecting rows like a file list: a click selects one, Cmd or Ctrl adds or removes one, Shift selects the range
// from the anchor (the last row clicked without Shift).

export interface Selection {
  ids: string[];
  anchor: string | null;
}

export interface Modifiers {
  toggle: boolean;
  range: boolean;
}

export function selectRow(order: string[], current: Selection, id: string, modifiers: Modifiers): Selection {
  if (modifiers.range && current.anchor !== null) {
    const from = order.indexOf(current.anchor);
    const to = order.indexOf(id);
    if (from >= 0 && to >= 0) {
      const [low, high] = from < to ? [from, to] : [to, from];
      return { ids: order.slice(low, high + 1), anchor: current.anchor };
    }
  }
  if (modifiers.toggle) {
    const has = current.ids.includes(id);
    return { ids: has ? current.ids.filter((entry) => entry !== id) : [...current.ids, id], anchor: id };
  }
  return { ids: [id], anchor: id };
}

export function modifiersOf(event: MouseEvent): Modifiers {
  return { toggle: event.metaKey || event.ctrlKey, range: event.shiftKey };
}
