<!-- A panel anchored to its trigger, like the status bar's AI usage and keep-awake panels. It opens above or below,
     aligned to the trigger's start or end edge, and closes on Esc or a click outside. -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import { presetVar, type PopoverWidth } from "../logic/presets";

  interface Props {
    open?: boolean;
    label: string;
    placement?: "above" | "below";
    align?: "start" | "end";
    width?: PopoverWidth;
    padding?: "menu" | "panel" | "form";
    textSize?: "normal" | "small";
    trigger: Snippet<[{ toggle: () => void; open: boolean }]>;
    children: Snippet;
  }

  let {
    open = $bindable(false),
    label,
    placement = "below",
    align = "start",
    width = "auto",
    padding = "menu",
    textSize = "normal",
    trigger,
    children,
  }: Props = $props();

  let rootEl = $state<HTMLDivElement | null>(null);

  function toggle(): void {
    open = !open;
  }
</script>

<svelte:window
  onmousedown={(event) => {
    if (open && rootEl && !rootEl.contains(event.target as Node)) {
      open = false;
    }
  }}
  onkeydown={(event) => {
    if (open && event.key === "Escape" && !event.defaultPrevented) {
      event.preventDefault();
      open = false;
    }
  }}
/>

<div class="anchor" bind:this={rootEl}>
  {@render trigger({ toggle, open })}
  {#if open}
    <div
      class="popover {placement} {align}"
      class:panel={padding === "panel"}
      class:form={padding === "form"}
      class:small={textSize === "small"}
      role="dialog"
      aria-label={label}
      style:width={width === "auto" ? null : presetVar("popoverWidth", width)}
    >
      {@render children()}
    </div>
  {/if}
</div>

<style>
  .anchor {
    position: relative;
    display: inline-flex;
  }

  .popover {
    position: absolute;
    z-index: 600;
    padding: var(--popover-padding);
    background: var(--panel);
    border: 1px solid var(--border-strong);
    border-radius: var(--popover-radius);
    box-shadow: var(--shadow);
    color: var(--text);
  }

  .panel {
    padding: var(--popover-panel-padding-y) var(--popover-panel-padding-x);
  }

  /* A small form, like Commit Options: its fields in a column. */
  .form {
    display: flex;
    flex-direction: column;
    gap: var(--popover-form-gap);
    padding: var(--popover-form-padding);
  }

  .small {
    font-size: var(--font-size-small);
  }

  .below {
    top: calc(100% + var(--popover-offset));
  }

  .above {
    bottom: calc(100% + var(--popover-offset));
  }

  .start {
    left: 0;
  }

  .end {
    right: 0;
  }
</style>
