<!-- A 1px line between groups: horizontal by default, vertical in toolbars. -->
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
    height: 16px;
    align-self: center;
  }
</style>
