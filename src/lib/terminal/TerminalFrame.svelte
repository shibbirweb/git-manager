<!--
  One terminal's frame. Svelte keeps the outer element in TerminalHost; the
  inner frame (with the TerminalView inside) is moved with appendChild into the
  panel or the terminal's editor tab, and back here while neither shows it.
  Only the frame moves, so Svelte's own bookkeeping of the list stays intact.
-->
<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { repoStore } from "$lib/stores/repo.svelte";
  import { changesSelection } from "$lib/views/changes/selection.svelte";
  import { terminalStore, type TerminalEntry } from "./terminalStore.svelte";
  import { terminalPlacement, terminalTabPath } from "./terminalTabs";
  import TerminalView from "./TerminalView.svelte";

  let { terminal }: { terminal: TerminalEntry } = $props();

  let parking = $state<HTMLDivElement | null>(null);
  let frame = $state<HTMLDivElement | null>(null);

  const slot = $derived(terminalStore.slotFor(terminal));
  const placement = $derived(terminalPlacement(terminal.location, slot !== null));
  /** Its editor tab is the one on screen. */
  const tabShown = $derived(
    placement === "editor" && changesSelection.shownView === "file" && repoStore.openFilePath === terminalTabPath(terminal.key),
  );
  const visible = $derived(
    placement === "panel"
      ? terminalStore.panelOpen && terminalStore.panelTab === "terminal" && terminalStore.paneSlots[terminal.key] !== undefined
      : placement === "run"
        ? terminalStore.panelOpen && terminalStore.panelTab === "run" && terminalStore.runActiveKey === terminal.key
        : tabShown,
  );

  // Puts the frame where the terminal is shown, or parks it here.
  $effect(() => {
    const target = slot ?? parking;
    if (frame && target && frame.parentElement !== target) {
      target.appendChild(frame);
    }
  });

  // Switching to its editor tab focuses it, like any editor.
  $effect(() => {
    if (tabShown) {
      untrack(() => terminalStore.requestFocus(terminal.key));
    }
  });

  // The frame may sit outside this component's own element, so Svelte would not remove it.
  onMount(() => {
    const element = frame;
    return () => element?.remove();
  });
</script>

<div class="parking" bind:this={parking}>
  <!-- Hidden frames must not cover the pane that shows another terminal. -->
  <div class="frame" class:hidden={!visible} bind:this={frame}>
    <TerminalView {terminal} {visible} {placement} />
  </div>
</div>

<style>
  .frame {
    position: absolute;
    inset: 0;
  }

  .frame.hidden {
    display: none;
  }
</style>
