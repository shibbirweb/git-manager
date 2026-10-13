// The SVG an icon renders as (like Icon.svelte), so reference markup can hold the app's real icons.
import { icons, type IconName } from "../lib/icons";

export function iconSvg(name: IconName, size = 16, strokeWidth = 2): string {
  const paths = icons[name].map((path) => `<path d="${path}"></path>`).join("");
  return (
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
    `stroke-width="${name === "more" ? 3 : strokeWidth}" stroke-linecap="round" stroke-linejoin="round" ` +
    `aria-hidden="true" class="gm-child" style="flex: none; display: block">${paths}</svg>`
  );
}
