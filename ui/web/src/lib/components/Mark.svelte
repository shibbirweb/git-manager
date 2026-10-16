<!-- A tiny box with one to three letters that names a tool, such as an AI agent ("CC" for Claude Code) before its
     row or its usage. `small` is the status bar's size. -->
<script lang="ts">
  interface Props {
    text: string;
    size?: "normal" | "small";
    title?: string;
  }

  let { text, size = "normal", title }: Props = $props();
</script>

<span class="mark {size}" {title}>{text}</span>

<style>
  .mark {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: var(--font-size-nano);
    font-weight: var(--font-weight-bold);
    color: var(--text-dim);
    background: var(--hover);
  }

  .normal {
    width: var(--mark-width);
    height: var(--mark-height);
    border-radius: var(--radius-small);
  }

  .small {
    padding: 0 var(--mark-small-padding-x);
    border-radius: var(--mark-small-radius);
    line-height: var(--mark-small-line-height);
    color: inherit;
  }
</style>
