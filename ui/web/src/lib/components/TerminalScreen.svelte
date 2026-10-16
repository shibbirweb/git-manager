<!-- The frame of a terminal screen: the element an xterm.js view opens in (handed to `onready`), the starting and
     failed states, the bell flash, the drop outline and overlays such as a find bar or a CornerCard. It makes no
     terminal: TerminalView builds one on it, and an app that owns its terminals opens them in `onready`. -->
<script lang="ts">
  import { untrack, type Snippet } from "svelte";
  import { presetVar, type ViewHeight } from "../logic/presets";
  import { scales } from "../styles/tokens";
  import Button from "./Button.svelte";
  import Icon from "./Icon.svelte";
  import Spinner from "./Spinner.svelte";

  interface Props {
    id?: string;
    height?: ViewHeight;
    hidden?: boolean;
    status?: "starting" | "ready" | "failed";
    message?: string;
    detail?: string;
    ligatures?: boolean;
    dropTarget?: boolean;
    bell?: number;
    element?: HTMLDivElement | null;
    onready?: (host: HTMLDivElement) => void | (() => void);
    onretry?: () => void;
    oncontextmenu?: (event: MouseEvent) => void;
    onfocusin?: (event: FocusEvent) => void;
    children?: Snippet;
  }

  let {
    id,
    height = "fill",
    hidden = false,
    status = "ready",
    message = "",
    detail = "",
    ligatures = false,
    dropTarget = false,
    bell = 0,
    element = $bindable(null),
    onready,
    onretry,
    oncontextmenu,
    onfocusin,
    children,
  }: Props = $props();

  let flashing = $state(false);
  let flashTimer: ReturnType<typeof setTimeout> | undefined;

  function host(node: HTMLDivElement): { destroy: () => void } {
    const cleanup = untrack(() => onready?.(node));
    return {
      destroy() {
        clearTimeout(flashTimer);
        cleanup?.();
      },
    };
  }

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

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  {id}
  class="terminal-view"
  class:hidden
  class:ligatures
  class:drop-over={dropTarget}
  bind:this={element}
  style:height={height === "fill" ? null : presetVar("viewHeight", height)}
  style:flex={height === "fill" ? null : "none"}
  {oncontextmenu}
  {onfocusin}
>
  <div class="xterm-host" use:host></div>
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

  .hidden {
    display: none;
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
