<!-- Plain monospace text without an editor: `output` for command output (the Git Console), `command` for the git
     command a dialog will run, `detail` for an error's details. Selectable, scrolls past its height. -->
<script lang="ts">
  import { presetVar, type CodeHeight } from "../logic/presets";

  interface Props {
    text: string;
    variant?: "output" | "command" | "detail" | "preview" | "prompt";
    maxHeight?: CodeHeight;
    label?: string;
  }

  let { text, variant = "output", maxHeight = "none", label }: Props = $props();
</script>

<pre
  class="block {variant}"
  aria-label={label}
  style:max-height={maxHeight === "none" ? null : presetVar("codeHeight", maxHeight)}>{text}</pre>

<style>
  .block {
    box-sizing: border-box;
    margin: 0;
    overflow: auto;
    font-family: var(--font-mono);
    user-select: text;
    -webkit-user-select: text;
  }

  .output {
    padding: var(--code-block-padding-y) var(--code-block-padding-x);
    border-left: var(--border-width-thick) solid var(--border-strong);
    background: var(--panel-alt);
    color: var(--text);
    font-size: var(--font-size-small);
    line-height: var(--code-block-line-height);
    white-space: pre;
  }

  .command {
    padding: var(--code-block-padding-y) var(--code-block-padding-x);
    border: 1px solid var(--border);
    border-radius: var(--code-block-radius);
    background: var(--panel-alt);
    color: var(--text-dim);
    font-size: var(--font-size-compact);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  /* A file's text shown before it is used, such as a gist's content. */
  .preview {
    padding: var(--code-block-preview-padding-y) var(--code-block-preview-padding-x);
    border: 1px solid var(--border);
    border-radius: var(--radius-control);
    background: var(--editor-bg);
    color: var(--text);
    font-size: var(--font-size-compact);
    line-height: var(--line-height-normal);
    white-space: pre;
    tab-size: 4;
  }

  /* What git asks, such as a host key to trust: no border, the text color, scrolling past its height. */
  .prompt {
    max-height: var(--code-block-prompt-max-height);
    padding: var(--code-block-prompt-padding);
    border-radius: var(--radius-control);
    background: var(--panel-alt);
    color: var(--text);
    font-size: var(--font-size-compact);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .detail {
    color: var(--text-dim);
    font-size: var(--font-size-compact);
    white-space: pre-wrap;
    word-break: break-word;
  }
</style>
