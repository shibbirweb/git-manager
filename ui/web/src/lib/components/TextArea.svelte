<!-- A multi-line text field, like the commit message box. `tools` puts small buttons in its top right corner (Message
     History, Templates) and the text keeps clear of them. -->
<script lang="ts">
  import type { Snippet } from "svelte";
  import type { HTMLTextareaAttributes } from "svelte/elements";
  import { type TextRows } from "../logic/presets";
  import { scales } from "../styles/tokens";

  interface Props extends Omit<HTMLTextareaAttributes, "class" | "style" | "rows"> {
    value?: string;
    rows?: TextRows;
    /** Its height from `rows`, or a set height: short 56 px, tall 96 px (the commit message). */
    height?: "rows" | "short" | "tall";
    resize?: "none" | "vertical";
    invalid?: boolean;
    mono?: boolean;
    element?: HTMLTextAreaElement | null;
    tools?: Snippet;
  }

  let {
    value = $bindable(""),
    rows = "normal",
    height = "rows",
    resize = "none",
    invalid = false,
    mono = false,
    element = $bindable(null),
    tools,
    ...rest
  }: Props = $props();

  let toolsWidth = $state(0);
</script>

{#snippet field()}
  <textarea
    bind:this={element}
    bind:value
    rows={scales.textRows[rows]}
    class="input"
    class:invalid
    class:mono
    class:short={height === "short"}
    class:tall={height === "tall"}
    style:resize
    style:padding-right={tools ? `calc(${toolsWidth}px + var(--text-area-tools-room))` : null}
    aria-invalid={invalid || undefined}
    {...rest}></textarea>
{/snippet}

{#if tools}
  <span class="wrap">
    {@render field()}
    <span class="tools" bind:clientWidth={toolsWidth}>{@render tools()}</span>
  </span>
{:else}
  {@render field()}
{/if}

<style>
  .input {
    height: auto;
    padding: var(--input-padding-y) var(--input-padding-x);
    border: 1px solid var(--border-strong);
    border-radius: var(--input-radius);
    background: var(--panel);
    color: var(--text);
    font: inherit;
    font-family: var(--font-ui);
    outline: none;
  }

  .input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 var(--input-focus-ring) color-mix(in srgb, var(--accent) 25%, transparent);
  }

  .invalid,
  .invalid:focus {
    border-color: var(--danger);
  }

  /* Code-like text, such as a commit message template: 12px mono. */
  .mono {
    font-size: var(--font-size-small);
    line-height: var(--line-height-normal);
    font-family: var(--font-mono);
  }

  .short,
  .tall {
    display: block;
    width: 100%;
    line-height: var(--line-height-normal);
  }

  .short {
    height: var(--text-area-short-height);
  }

  .tall {
    height: var(--text-area-tall-height);
  }

  .wrap {
    position: relative;
    display: block;
  }

  .tools {
    position: absolute;
    top: var(--text-area-tools-inset);
    right: var(--text-area-tools-inset);
    display: flex;
    gap: var(--text-area-tools-gap);
  }
</style>
