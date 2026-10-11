<!-- A small spinning ring for work in progress. `label` is read by screen readers. -->
<script lang="ts">
  interface Props {
    label?: string;
    size?: "normal" | "large";
  }

  let { label = "Loading", size = "normal" }: Props = $props();
</script>

<span class="spinner" class:large={size === "large"} role="status" aria-label={label}></span>

<style>
  .spinner {
    flex: none;
    display: inline-block;
    width: var(--spinner-size);
    height: var(--spinner-size);
    border: var(--spinner-border) solid var(--border-strong);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
  }

  .large {
    width: calc(var(--spinner-size) * 2);
    height: calc(var(--spinner-size) * 2);
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
