// Opens one xterm.js terminal in its host: the display options and theme, the addons (fit, web links, search, WebGL,
// Unicode 11), the app's keys, the bell, an agent's title, the shell's folder (OSC 7), copy on selection and the
// screen snapshot that survives Clear Cache. TerminalController calls it once the xterm module has loaded.
import { openUrl } from "@tauri-apps/plugin-opener";
import type { FitAddon } from "@xterm/addon-fit";
import type { Terminal } from "@xterm/xterm";
import { errorMessage } from "$lib/api";
import { toast } from "$lib/ui/toast.svelte";
import type { TerminalAddons } from "./addons";
import type { FindResults } from "./find";
import { parseOsc7 } from "./fileLinks";
import { gpuRenderers } from "./gpuRenderers.svelte";
import type { TerminalDisplayOptions } from "./options";
import { CopyOnSelect } from "./terminalActions";
import { terminalStore } from "./terminalStore.svelte";
import { currentTerminalTheme, watchTheme } from "./theme";

export interface TerminalHooks {
  terminalKey: number;
  isMac: boolean;
  options: TerminalDisplayOptions;
  onFindResults: (results: FindResults) => void;
  onKey: (instance: Terminal, event: KeyboardEvent) => boolean;
  onBell: () => void;
  onTitle: (title: string) => void;
  onFolder: (folder: string) => void;
  onData: (data: string) => void;
}

export interface OpenedTerminal {
  instance: Terminal;
  fit: FitAddon;
  addons: TerminalAddons;
  /** Stops the theme watch, the snapshot and copy on selection; the caller disposes the terminal and addons. */
  stop: () => void;
}

export function openTerminal(
  xterm: typeof import("./xterm"),
  host: HTMLDivElement,
  hooks: TerminalHooks,
): OpenedTerminal {
  const instance = new xterm.Terminal({
    ...hooks.options,
    theme: currentTerminalTheme(),
    // Keeps colored output readable in both themes.
    minimumContrastRatio: 4.5,
    // Unicode versions and the search highlights are xterm's proposed API.
    allowProposedApi: true,
  });
  const drawingKey = hooks.terminalKey;
  gpuRenderers.set(drawingKey, "normal");
  const addons = new xterm.TerminalAddons(instance, hooks.onFindResults, (drawing) =>
    gpuRenderers.set(drawingKey, drawing),
  );
  const fit = new xterm.FitAddon();
  instance.loadAddon(fit);
  // Cmd+click (Ctrl+click elsewhere) opens a link.
  instance.loadAddon(
    new xterm.WebLinksAddon((event, uri) => {
      if (hooks.isMac ? event.metaKey : event.ctrlKey) {
        void openUrl(uri).catch((error) => toast.error("Could not open the link", errorMessage(error)));
      }
    }),
  );
  instance.attachCustomKeyEventHandler((event) => hooks.onKey(instance, event));
  instance.onBell(() => hooks.onBell());
  // An agent shows what it does in the title.
  instance.onTitleChange((title) => hooks.onTitle(title));
  // Shells with integration report their folder after each cd (OSC 7); file links resolve against it.
  instance.parser.registerOscHandler(7, (data) => {
    const folder = parseOsc7(data);
    if (folder) {
      hooks.onFolder(folder);
    }
    return true;
  });
  instance.onData((data) => hooks.onData(data));
  const copier = new CopyOnSelect(instance);
  // Keyboard and double-click selections copy now; a drag copies on mouseup.
  instance.onSelectionChange(() => copier.selectionChanged());
  instance.open(host);
  const stopSnapshot = terminalStore.registerSnapshot(hooks.terminalKey, async () => {
    const { SerializeAddon } = await import("@xterm/addon-serialize");
    const serializer = new SerializeAddon();
    instance.loadAddon(serializer);
    try {
      return serializer.serialize();
    } finally {
      serializer.dispose();
    }
  });
  const stopTheme = watchTheme(() => {
    instance.options.theme = currentTerminalTheme();
  });
  const stopCopy = copier.attach(host);
  return {
    instance,
    fit,
    addons,
    stop: () => {
      stopSnapshot();
      stopTheme();
      stopCopy();
    },
  };
}
