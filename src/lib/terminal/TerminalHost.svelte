<!--
  Mounts every terminal once, for as long as it lives, whether it is shown in
  the panel or in an editor tab. Each TerminalFrame moves its terminal's
  element into the place that shows it, so moving a terminal never restarts
  its shell or loses its scrollback. Terminals with no place on screen stay
  parked in here, out of sight. It also listens for files dropped from Finder
  on a terminal, while there is a terminal and the setting is on.
-->
<script lang="ts">
  import { getCurrentWebview, type DragDropEvent } from "@tauri-apps/api/webview";
  import { platformFromUserAgent } from "$lib/menu/menuSpec";
  import { settings } from "$lib/stores/settings.svelte";
  import { dropPointToCss } from "$lib/views/files/dragDrop";
  import {
    TERMINAL_DRAG_EVENT,
    TERMINAL_DROP_EVENT,
    TERMINAL_KEY_ATTRIBUTE,
    type TerminalDragDetail,
    type TerminalDropDetail,
    terminalKeyAt,
  } from "./dropPaths";
  import TerminalFrame from "./TerminalFrame.svelte";
  import { terminalStore } from "./terminalStore.svelte";

  const PLATFORM = platformFromUserAgent(navigator.userAgent);
  const listening = $derived(terminalStore.terminals.length > 0 && settings.terminalDropPaths);

  function viewOf(terminalKey: number): Element | null {
    return document.querySelector(`[${TERMINAL_KEY_ATTRIBUTE}="${terminalKey}"]`);
  }

  $effect(() => {
    if (!listening) {
      return;
    }
    let unlisten: (() => void) | null = null;
    let disposed = false;
    /** The terminal the files are over now, so only it shows the drop outline. */
    let overKey: number | null = null;

    function setOver(terminalKey: number | null): void {
      if (terminalKey === overKey) {
        return;
      }
      if (overKey !== null) {
        viewOf(overKey)?.dispatchEvent(new CustomEvent<TerminalDragDetail>(TERMINAL_DRAG_EVENT, { detail: { over: false } }));
      }
      overKey = terminalKey;
      if (terminalKey !== null) {
        viewOf(terminalKey)?.dispatchEvent(new CustomEvent<TerminalDragDetail>(TERMINAL_DRAG_EVENT, { detail: { over: true } }));
      }
    }

    // The Files panel listens to the same events; it skips points over a terminal, so a drop is handled once.
    function onFinderDrag(event: DragDropEvent): void {
      if (event.type === "leave") {
        setOver(null);
        return;
      }
      const point = dropPointToCss(event.position, window.devicePixelRatio, PLATFORM);
      const terminalKey = terminalKeyAt(document.elementFromPoint(point.x, point.y));
      if (event.type !== "drop") {
        setOver(terminalKey);
        return;
      }
      setOver(null);
      if (terminalKey !== null && event.paths.length > 0) {
        viewOf(terminalKey)?.dispatchEvent(
          new CustomEvent<TerminalDropDetail>(TERMINAL_DROP_EVENT, { detail: { filePaths: event.paths } }),
        );
      }
    }

    try {
      void getCurrentWebview()
        .onDragDropEvent((event) => onFinderDrag(event.payload))
        .then((off) => {
          if (disposed) {
            off();
          } else {
            unlisten = off;
          }
        })
        .catch(() => undefined);
    } catch {
      // Not inside Tauri (the screenshot bridge): there are no Finder drops to take.
    }
    return () => {
      disposed = true;
      setOver(null);
      unlisten?.();
    };
  });
</script>

<div class="terminal-host" aria-hidden="true">
  {#each terminalStore.terminals as terminal (terminal.key)}
    <TerminalFrame {terminal} />
  {/each}
</div>

<style>
  .terminal-host {
    display: none;
  }
</style>
