// File type icons in the file lists (Settings > Appearance > File icons, View > File Icons).
// Each icon set lives in static/file-icons/<set>/ and is fetched only while it is chosen:
// - No icons: nothing is fetched; lists show the plain file icon.
// - Minimal: its type map and minimal.css (glyph masks colored by theme tokens).
// - Material Icons: its type map; rows are <img>s, so the web view loads only the SVGs on screen.
// Switching drops the other set: its map is no longer referenced and its stylesheet is removed.
import type { FileIconMode } from "$lib/stores/settingsData";
import { type IconMap, iconFor, normalizeIconMap } from "./iconMatch";

/** A row's icon: classes for the Minimal mask stylesheet, or the URL of a Material SVG. */
export type FileIconView = { kind: "mask"; className: string } | { kind: "image"; src: string };

type IconSet = Exclude<FileIconMode, "off">;

const BASE = "/file-icons";
const STYLE_ID = "gm-file-icons-minimal";
const SAFE_NAME = /^[a-z0-9_.-]+$/i;

class FileIconsStore {
  /** Looks up a file name's icon; null while icons are off or a set is still loading. */
  resolve = $state.raw<((fileName: string) => FileIconView) | null>(null);
}

export const fileIcons = new FileIconsStore();

// The one set in memory, kept so a theme change does not fetch its map again.
let loaded: { set: IconSet; map: IconMap } | null = null;
// Bumped on every call, so a slow fetch never applies a mode the user already left.
let generation = 0;

async function fetchMap(set: IconSet): Promise<IconMap> {
  // no-store: the map is held only by the resolver, not also by the HTTP memory cache.
  const response = await fetch(`${BASE}/${set}/map.json`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`${set} file icons: HTTP ${response.status}`);
  }
  return normalizeIconMap(await response.json());
}

function setStylesheet(href: string | null): void {
  const current = document.getElementById(STYLE_ID);
  if (!href) {
    current?.remove();
    return;
  }
  if (current) {
    return;
  }
  const link = document.createElement("link");
  link.id = STYLE_ID;
  link.rel = "stylesheet";
  link.href = href;
  document.head.append(link);
}

function resolver(set: IconSet, map: IconMap, light: boolean): (fileName: string) => FileIconView {
  if (set === "minimal") {
    return (fileName) => {
      const [glyph, tone] = iconFor(map, fileName, light).split(" ");
      const safe = SAFE_NAME.test(glyph ?? "") && SAFE_NAME.test(tone ?? "");
      return { kind: "mask", className: safe ? `fi-g-${glyph} fi-t-${tone}` : "fi-g-file fi-t-gray" };
    };
  }
  return (fileName) => {
    const icon = iconFor(map, fileName, light);
    return { kind: "image", src: `${BASE}/material/${SAFE_NAME.test(icon) ? icon : "file"}.svg` };
  };
}

export async function setFileIcons(mode: FileIconMode, light: boolean): Promise<void> {
  const current = ++generation;
  if (mode === "off") {
    loaded = null;
    setStylesheet(null);
    fileIcons.resolve = null;
    return;
  }
  // Leave the other set first, so two sets are never in memory together.
  if (loaded?.set !== mode) {
    loaded = null;
    fileIcons.resolve = null;
  }
  setStylesheet(mode === "minimal" ? `${BASE}/minimal/minimal.css` : null);
  try {
    const map = loaded?.map ?? (await fetchMap(mode));
    if (current !== generation) {
      return;
    }
    loaded = { set: mode, map };
    fileIcons.resolve = resolver(mode, map, light);
  } catch (error) {
    // Lists keep the plain icon; nothing else depends on the icon sets.
    console.warn("file icons could not load", error);
  }
}
