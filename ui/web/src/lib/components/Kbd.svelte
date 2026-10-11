<!-- A keyboard shortcut as a key cap. Pass the text from commandKeys(id) or localKeys(...), never typed by hand,
     so Windows shows Ctrl and custom keys show up. -->
<script lang="ts">
  interface Props {
    keys: string;
  }

  let { keys }: Props = $props();
</script>

<kbd>{keys}</kbd>

<style>
  kbd {
    display: inline-block;
    min-width: var(--kbd-min-width);
    padding: var(--kbd-padding-y) var(--kbd-padding-x);
    border: 1px solid var(--border-strong);
    border-bottom-width: 2px;
    border-radius: var(--kbd-radius);
    background: var(--panel-alt);
    color: var(--text);
    font-family: var(--font-ui);
    font-size: var(--font-size-small);
    text-align: center;
    white-space: nowrap;
  }
</style>
