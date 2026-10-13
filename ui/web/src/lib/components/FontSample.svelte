<!-- A few lines of sample text drawn in a chosen font, like Settings' editor and terminal previews. The font,
     size, weight and spacing are data from the user's settings, so they stay numbers here; `dim` lines are
     drawn dim (a prompt's path). A line made of `parts` can mix dim and bold words, bold in `boldWeight` (the
     terminal's bold weight setting, on a commit hash). -->
<script lang="ts">
  interface SamplePart {
    text: string;
    dim?: boolean;
    bold?: boolean;
  }

  interface SampleLine {
    text?: string;
    dim?: boolean;
    parts?: SamplePart[];
  }

  interface Props {
    lines: SampleLine[];
    label: string;
    variant?: "editor" | "terminal";
    fontFamily?: string;
    fontSize?: number | null;
    fontWeight?: number | null;
    boldWeight?: number | null;
    letterSpacing?: number | null;
    lineHeight?: number | null;
    ligatures?: boolean;
  }

  let {
    lines,
    label,
    variant = "editor",
    fontFamily,
    fontSize = null,
    fontWeight = null,
    boldWeight = null,
    letterSpacing = null,
    lineHeight = null,
    ligatures = true,
  }: Props = $props();
</script>

<pre
  class="sample {variant}"
  class:no-ligatures={!ligatures}
  aria-label={label}
  style:font-family={fontFamily}
  style:font-size={fontSize === null ? null : `${fontSize}px`}
  style:font-weight={fontWeight}
  style:letter-spacing={letterSpacing === null ? null : `${letterSpacing}px`}
  style:--sample-line-height={lineHeight}
  style:--sample-bold-weight={boldWeight}
  >{#each lines as line, index (index)}<div class:dim={line.dim}
      >{#each line.parts ?? [] as part, partIndex (partIndex)}<span class:dim={part.dim} class:bold={part.bold}
          >{part.text}</span
        >{/each}{line.text || (line.parts?.length ? "" : " ")}</div
    >{/each}</pre>

<style>
  .sample {
    margin: 0;
    padding: var(--font-sample-padding-y) var(--font-sample-padding-x);
    overflow-x: auto;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius-control);
    background: var(--editor-bg);
    line-height: var(--line-height-sample);
    white-space: pre;
  }

  .terminal {
    line-height: normal;
  }

  .terminal > div {
    line-height: calc(var(--sample-line-height, 1) * 1lh);
  }

  .no-ligatures,
  .no-ligatures > div {
    font-variant-ligatures: none;
    font-feature-settings: "liga" 0, "calt" 0;
  }

  .dim {
    color: var(--text-dim);
  }

  .bold {
    font-weight: var(--sample-bold-weight, var(--font-weight-bold));
  }
</style>
