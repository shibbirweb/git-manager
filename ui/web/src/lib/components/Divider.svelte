<!-- A 1px line between groups: horizontal by default, vertical in toolbars, where it takes the toolbar's length
     and spacing. -->
<script lang="ts">
  interface Props {
    direction?: "horizontal" | "vertical";
    strong?: boolean;
  }

  let { direction = "horizontal", strong = true }: Props = $props();
</script>

<div class="divider {direction}" class:strong role="separator" aria-orientation={direction}></div>

<style>
  .divider {
    flex: none;
    background: var(--border);
  }

  .strong {
    background: var(--border-strong);
  }

  .horizontal {
    height: 1px;
    align-self: stretch;
  }

  .vertical {
    width: 1px;
    height: var(--divider-length, var(--toolbar-divider-length));
    margin: 0 var(--divider-space, 0);
    align-self: center;
  }
</style>
