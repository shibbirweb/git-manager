<!-- A text button: Default, Primary (the main action), Danger (red text) or Danger primary (a red, filled
     destructive confirm). Small fits toolbars and rows. -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLButtonAttributes } from "svelte/elements";
  import type { IconName } from "../icons";
  import Badge from "./Badge.svelte";
  import Icon from "./Icon.svelte";
  import LayoutIcon from "./LayoutIcon.svelte";

  interface Props extends Omit<HTMLButtonAttributes, "children" | "class" | "style"> {
    variant?: "default" | "primary" | "danger" | "danger-primary" | "ghost" | "accent";
    size?: "normal" | "small" | "tiny" | "mini";
    pressed?: boolean | null;
    /** A count pinned to the top right corner, such as options turned on. */
    badge?: number | null;
    /** A dim count after the words, such as the repository picker's number of repositories. */
    count?: number | null;
    icon?: IconName | null;
    trailingIcon?: IconName | null;
    /** A drawn layout glyph in place of `icon`, such as the Changes tab's file list toggle. */
    layout?: "sidebar-left" | "sidebar-right" | "commit-single" | "commit-per-repo" | null;
    /** Fills the layout glyph, such as while the file list is shown. */
    layoutActive?: boolean;
    /** The icon turns, such as Refresh while it runs. */
    spinning?: boolean;
    /** Its words' width, or the whole width of its parent with the words centered (Sync Changes). */
    width?: "auto" | "fill";
    /** Pressing it leaves the focus where it was, such as in a search field next to it. */
    keepFocus?: boolean;
    element?: HTMLButtonElement | null;
    children?: Snippet;
  }

  let {
    variant = "default",
    size = "normal",
    icon = null,
    trailingIcon = null,
    layout = null,
    layoutActive = false,
    spinning = false,
    pressed = null,
    badge = null,
    count = null,
    width = "auto",
    type = "button",
    keepFocus = false,
    element = $bindable(null),
    children,
    ...rest
  }: Props = $props();
</script>

<button
  bind:this={element}
  {type}
  class="button {variant}"
  class:small={size === "small" || size === "tiny" || size === "mini"}
  class:tiny={size === "tiny"}
  class:mini={size === "mini"}
  class:icon-only={!children && (!!icon || !!layout)}
  class:on={pressed === true}
  class:fill={width === "fill"}
  aria-pressed={pressed ?? undefined}
  {...rest}
  onmousedown={(event) => {
    if (keepFocus) {
      event.preventDefault();
    }
    rest.onmousedown?.(event);
  }}
>
  {#if layout}
    <LayoutIcon kind={layout} active={layoutActive} size={size === "normal" ? "normal" : "compact"} />
  {:else if icon}
    <span class="glyph" class:spinning>
      <Icon name={icon} size={size === "normal" ? "normal" : size === "tiny" ? "medium" : "compact"} />
    </span>
  {/if}
  {#if variant === "ghost"}
    <span class="label">{@render children?.()}</span>
  {:else}
    {@render children?.()}
  {/if}
  {#if count !== null}<span class="count">{count}</span>{/if}
  {#if trailingIcon}
    <Icon name={trailingIcon} size="compact" />
  {/if}
  {#if badge}<Badge count={badge} size="corner" />{/if}
</button>

<style>
  .glyph {
    display: inline-flex;
  }

  .spinning {
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }

  .count {
    color: var(--text-dim);
    font-size: var(--font-size-xsmall);
  }

  .button {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: var(--button-gap);
    height: var(--button-height);
    padding: 0 var(--button-padding-x);
    border: 1px solid var(--border-strong);
    border-radius: var(--button-radius);
    background: var(--panel);
    color: var(--text);
    font: inherit;
    cursor: pointer;
    white-space: nowrap;
  }

  .fill {
    width: 100%;
    justify-content: center;
  }

  .button:hover:not(:disabled) {
    background: var(--hover);
  }

  .button:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .primary {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--accent-text);
  }

  .primary:hover:not(:disabled) {
    background: var(--accent-hover);
  }

  .danger {
    color: var(--danger);
  }

  .danger-primary,
  .danger-primary:hover:not(:disabled) {
    background: var(--danger);
    border-color: var(--danger);
    color: var(--accent-text);
  }

  /* Borderless, like the header's repository and branch pickers. */
  .ghost {
    min-width: 0;
    max-width: var(--button-ghost-max-width);
    padding: 0 var(--button-ghost-padding-x);
    border: none;
    background: transparent;
  }

  .label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .small {
    height: var(--button-height-small);
    padding: 0 var(--button-padding-x-small);
    font-size: var(--button-font-size-small);
  }

  /* An icon alone, such as Commit Options' gear: as narrow as its icon allows. */
  .icon-only {
    padding: 0 var(--button-icon-only-padding-x);
  }

  /* Accent words and border, such as Commit Options while some options are on. */
  .accent {
    border-color: var(--accent);
    color: var(--accent);
  }

  /* A media bar's buttons, a step lower than small. */
  .tiny {
    height: var(--button-height-tiny);
  }

  .tiny.icon-only {
    justify-content: center;
    width: var(--button-icon-only-tiny-width);
    padding: 0;
  }

  /* A group header's button in the Changes panel, such as Stage All. */
  .mini {
    height: var(--button-height-mini);
    padding: 0 var(--button-padding-x-mini);
    font-size: var(--font-size-compact);
  }

  /* A pressed choice, such as Fit or 100% in a zoom bar. */
  .button.on {
    background: var(--selected);
  }
</style>
