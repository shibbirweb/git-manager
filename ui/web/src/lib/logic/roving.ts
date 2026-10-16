// Arrow-key movement in a row of choices (Segmented, Tabs, RadioGroup): wraps at the ends, skips disabled ones.

export type RovingKey = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown" | "Home" | "End";

export function isRovingKey(key: string): key is RovingKey {
  return ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(key);
}

/** The index a key moves to from `current` among `count` items; `disabled(i)` items are skipped. */
export function nextIndex(
  current: number,
  count: number,
  key: RovingKey,
  disabled: (index: number) => boolean = () => false,
): number {
  if (count === 0) {
    return -1;
  }
  const enabled = (index: number) => !disabled(index);
  if (key === "Home" || key === "End") {
    const order = [...Array(count).keys()];
    const found = (key === "Home" ? order : order.reverse()).find(enabled);
    return found ?? current;
  }
  const step = key === "ArrowLeft" || key === "ArrowUp" ? -1 : 1;
  let index = current;
  for (let tries = 0; tries < count; tries++) {
    index = (index + step + count) % count;
    if (enabled(index)) {
      return index;
    }
  }
  return current;
}
