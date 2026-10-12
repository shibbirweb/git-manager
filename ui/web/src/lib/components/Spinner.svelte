<!-- A small spinning ring for work in progress. `label` is read by screen readers. -->
<script lang="ts">
  interface Props {
    label?: string;
    size?: "small" | "normal" | "large";
  }

  let { label = "Loading", size = "normal" }: Props = $props();
</script>

<span class="spinner {size}" role="status" aria-label={label}></span>

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

  .small {
    width: var(--spinner-size-small);
    height: var(--spinner-size-small);
  }

  .large {
    width: var(--spinner-size-large);
    height: var(--spinner-size-large);
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
