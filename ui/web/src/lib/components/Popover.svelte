<!-- A panel anchored to its trigger, like the status bar's AI usage and keep-awake panels. It opens above or below,
     aligned to the trigger's start or end edge, and closes on Esc or a click outside. `layer="window"` floats it over
     the window, kept inside it, for a trigger in a scrolling or narrow panel (Commit Options). -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import { windowPlace, type WindowPlace } from "../logic/popoverPlace";
  import { presetVar, type PopoverWidth } from "../logic/presets";
  import { componentTokens } from "../styles/tokens";

  interface Props {
    open?: boolean;
    label: string;
    placement?: "above" | "below";
    align?: "start" | "end";
    width?: PopoverWidth;
    padding?: "menu" | "panel" | "form";
    textSize?: "normal" | "small";
    /** Under the trigger in the page, or floating over the window so a scrolling panel cannot cut it off. */
    layer?: "anchor" | "window";
    /** Its first field takes the focus when it opens, and Esc gives it back to the trigger (a small form). */
    autofocus?: boolean;
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
    layer = "anchor",
    autofocus = false,
    trigger,
    children,
  }: Props = $props();

  let rootEl = $state<HTMLDivElement | null>(null);
  let panelEl = $state<HTMLDivElement | null>(null);
  let place = $state<WindowPlace | null>(null);
  const floating = $derived(layer === "window");

  $effect(() => {
    if (!open || !floating || !panelEl || !rootEl) {
      place = null;
      return;
    }
    const { offset, windowInset } = componentTokens.popover;
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const options = { placement, align, offset, inset: windowInset };
    place = windowPlace(rootEl.getBoundingClientRect(), panelEl.offsetWidth, viewport, options);
  });

  $effect(() => {
    if (open && autofocus && panelEl) {
      panelEl.querySelector<HTMLElement>("input, select, textarea, button")?.focus();
    }
  });

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
      const inside = panelEl?.contains(document.activeElement) ?? false;
      open = false;
      if (autofocus && inside) {
        rootEl?.querySelector<HTMLElement>("button")?.focus();
      }
    }
  }}
/>

<div class="anchor" bind:this={rootEl}>
  {@render trigger({ toggle, open })}
  {#if open}
    <div
      bind:this={panelEl}
      class="popover {placement} {align}"
      class:floating
      class:panel={padding === "panel"}
      class:form={padding === "form"}
      class:small={textSize === "small"}
      role="dialog"
      aria-label={label}
      style:width={width === "auto" ? null : presetVar("popoverWidth", width)}
      style:left={place ? `${place.left}px` : null}
      style:top={place && place.top !== null ? `${place.top}px` : null}
      style:bottom={place && place.bottom !== null ? `${place.bottom}px` : null}
      style:visibility={floating && !place ? "hidden" : null}
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

  /* Over the window; the script sets its place from the trigger's. */
  .floating {
    position: fixed;
    top: auto;
    right: auto;
    bottom: auto;
    left: auto;
  }
</style>
