<!-- A terminal screen: an xterm.js view in the theme's terminal colors, with the starting and failed states, the
     bell flash and the drop outline (TerminalScreen). It runs no shell: the app wires one through `onready` (write
     output), `oninput` (keys typed) and `onresize`. Overlays such as the find bar go in `children`. -->
<script lang="ts">
  import type { FitAddon } from "@xterm/addon-fit";
  import type { Terminal } from "@xterm/xterm";
  import type { Snippet } from "svelte";
  import { terminalThemeOf, watchTheme } from "../editor/terminalTheme";
  import type { ViewHeight } from "../logic/presets";
  import { scales } from "../styles/tokens";
  import TerminalScreen from "./TerminalScreen.svelte";

  interface Props {
    label: string;
    height?: ViewHeight;
    status?: "starting" | "ready" | "failed";
    message?: string;
    detail?: string;
    textSize?: "code" | "codeSmall";
    ligatures?: boolean;
    dropTarget?: boolean;
    bell?: number;
    onready?: (terminal: Terminal) => void;
    oninput?: (data: string) => void;
    onresize?: (size: { cols: number; rows: number }) => void;
    onretry?: () => void;
    children?: Snippet;
  }

  let {
    label,
    height = "fill",
    status = "ready",
    message = "",
    detail = "",
    textSize = "code",
    ligatures = false,
    dropTarget = false,
    bell = 0,
    onready,
    oninput,
    onresize,
    onretry,
    children,
  }: Props = $props();

  let term = $state.raw<Terminal | null>(null);
  let fit: FitAddon | null = null;

  function open(host: HTMLDivElement): () => void {
    let disposed = false;
    let observer: ResizeObserver | null = null;
    let stopTheme: (() => void) | null = null;
    // xterm loads on first use, so a page without a terminal pays nothing for it.
    void Promise.all([import("@xterm/xterm"), import("@xterm/addon-fit"), import("@xterm/xterm/css/xterm.css")]).then(
      ([xterm, fitModule]) => {
        if (disposed) {
          return;
        }
        const style = getComputedStyle(host);
        const created = new xterm.Terminal({
          fontFamily: style.getPropertyValue("--font-family-mono").trim(),
          fontSize: scales.fontSize[textSize],
          theme: terminalThemeOf(host),
          allowProposedApi: true,
        });
        fit = new fitModule.FitAddon();
        created.loadAddon(fit);
        created.open(host);
        created.textarea?.setAttribute("aria-label", label);
        created.onData((data) => oninput?.(data));
        created.onResize((size) => onresize?.(size));
        fit.fit();
        observer = new ResizeObserver(() => fit?.fit());
        observer.observe(host);
        stopTheme = watchTheme(() => (created.options.theme = terminalThemeOf(host)));
        term = created;
        onready?.(created);
      },
    );
    return () => {
      disposed = true;
      observer?.disconnect();
      stopTheme?.();
      term?.dispose();
      term = null;
      fit = null;
    };
  }

  $effect(() => {
    const size = scales.fontSize[textSize];
    if (term && term.options.fontSize !== size) {
      term.options.fontSize = size;
      fit?.fit();
    }
  });
</script>

<TerminalScreen {height} {status} {message} {detail} {ligatures} {dropTarget} {bell} {onretry} onready={open}>
  {@render children?.()}
</TerminalScreen>
