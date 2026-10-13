<!-- A terminal screen: an xterm.js view in the theme's terminal colors, with the starting and failed states, the
     bell flash and the drop outline. It runs no shell: the app wires one through `onready` (write output),
     `oninput` (keys typed) and `onresize`. Overlays such as the find bar go in `children`. -->
<script lang="ts">
  import type { FitAddon } from "@xterm/addon-fit";
  import type { Terminal } from "@xterm/xterm";
  import { onMount, untrack, type Snippet } from "svelte";
  import { terminalThemeOf, watchTheme } from "../editor/terminalTheme";
  import { presetVar, type ViewHeight } from "../logic/presets";
  import { scales } from "../styles/tokens";
  import Button from "./Button.svelte";
  import Icon from "./Icon.svelte";
  import Spinner from "./Spinner.svelte";

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

  let root = $state<HTMLDivElement | null>(null);
  let host = $state<HTMLDivElement | null>(null);
  let term = $state.raw<Terminal | null>(null);
  let fit: FitAddon | null = null;
  let flashing = $state(false);
  let flashTimer: ReturnType<typeof setTimeout> | undefined;

  onMount(() => {
    let disposed = false;
    let observer: ResizeObserver | null = null;
    let stopTheme: (() => void) | null = null;
    // xterm loads on first use, so a page without a terminal pays nothing for it.
    void Promise.all([import("@xterm/xterm"), import("@xterm/addon-fit"), import("@xterm/xterm/css/xterm.css")]).then(
      ([xterm, fitModule]) => {
        if (disposed || !host || !root) {
          return;
        }
        const style = getComputedStyle(root);
        const created = new xterm.Terminal({
          fontFamily: style.getPropertyValue("--font-family-mono").trim(),
          fontSize: scales.fontSize[textSize],
          theme: terminalThemeOf(root),
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
        stopTheme = watchTheme(() => {
          if (root) {
            created.options.theme = terminalThemeOf(root);
          }
        });
        term = created;
        onready?.(created);
      },
    );
    return () => {
      disposed = true;
      clearTimeout(flashTimer);
      observer?.disconnect();
      stopTheme?.();
      term?.dispose();
      term = null;
      fit = null;
    };
  });

  $effect(() => {
    const size = scales.fontSize[textSize];
    if (term && term.options.fontSize !== size) {
      term.options.fontSize = size;
      fit?.fit();
    }
  });

  // Each new bell count flashes once; bells during a flash are ignored, as binary output can ring thousands of times.
  let lastBell = untrack(() => bell);
  $effect(() => {
    if (bell === lastBell) {
      return;
    }
    lastBell = bell;
    if (flashing) {
      return;
    }
    flashing = true;
    flashTimer = setTimeout(() => (flashing = false), scales.motion.flash);
  });
</script>

<div
  class="terminal-view"
  class:ligatures
  class:drop-over={dropTarget}
  bind:this={root}
  style:height={height === "fill" ? null : presetVar("viewHeight", height)}
  style:flex={height === "fill" ? null : "none"}
>
  <div class="xterm-host" bind:this={host}></div>
  {#if flashing}
    <div class="bell-flash" aria-hidden="true"></div>
  {/if}
  {#if status === "failed"}
    <div class="status failed" role="alert">
      <Icon name="alert" size="large" tone="danger" />
      <span>{message}</span>
      {#if detail}<span class="detail">{detail}</span>{/if}
      {#if onretry}<Button size="small" onclick={onretry}>Retry</Button>{/if}
    </div>
  {:else if status === "starting"}
    <!-- The spinner is the status region and reads the message; the text is for the eye. -->
    <div class="status">
      <Spinner size="small" label={message || "Starting"} />
      <span aria-hidden="true">{message}</span>
    </div>
  {/if}
  {@render children?.()}
</div>

<style>
  .terminal-view {
    position: relative;
    flex: 1;
    align-self: stretch;
    width: 100%;
    height: 100%;
    min-height: 0;
    background: var(--editor-bg);
    overflow: hidden;
  }

  /* Its own stacking context, so xterm's layers (search highlights, the WebGL canvas) stay under overlays. */
  .xterm-host {
    position: absolute;
    inset: 0;
    z-index: 0;
    padding: var(--terminal-view-padding-top) 0 var(--terminal-view-padding-bottom) var(--terminal-view-padding-left);
    overflow: hidden;
  }

  .status {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--space-4);
    color: var(--text-dim);
    font-size: var(--font-size-small);
    pointer-events: none;
  }

  .status.failed {
    flex-direction: column;
    gap: var(--space-3);
    padding: var(--space-8);
    background: var(--editor-bg);
    color: var(--text);
    text-align: center;
    pointer-events: auto;
  }

  .detail {
    max-width: var(--terminal-view-message-max-width);
    color: var(--text-dim);
    overflow-wrap: anywhere;
    user-select: text;
  }

  .drop-over::after {
    content: "";
    position: absolute;
    inset: 0;
    z-index: 1;
    border: var(--terminal-view-drop-border) solid var(--accent);
    background: color-mix(in srgb, var(--accent) 8%, transparent);
    pointer-events: none;
  }

  .bell-flash {
    position: absolute;
    inset: 0;
    z-index: 1;
    background: var(--text);
    opacity: 0;
    pointer-events: none;
    animation: bell var(--motion-flash) ease-out;
  }

  @keyframes bell {
    from {
      opacity: 0.12;
    }
    to {
      opacity: 0;
    }
  }

  .terminal-view :global(.xterm) {
    height: 100%;
  }

  /* xterm 6 leaves the viewport under the last whole row black; give it the terminal background. */
  .terminal-view :global(.xterm .xterm-viewport) {
    background-color: var(--term-background);
  }

  /* WebKit joins ligatures by default, so off is set explicitly. */
  .terminal-view :global(.xterm-rows) {
    font-variant-ligatures: none;
    font-feature-settings:
      "liga" 0,
      "calt" 0;
  }

  .terminal-view.ligatures :global(.xterm-rows) {
    font-variant-ligatures: common-ligatures contextual;
    font-feature-settings:
      "liga" 1,
      "calt" 1;
  }
</style>
