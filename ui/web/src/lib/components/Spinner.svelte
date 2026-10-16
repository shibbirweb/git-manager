<!-- A small spinning ring for work in progress. `label` is read by screen readers. `delayed` shows it only after a
     moment, so quick work does not flash a spinner. -->
<script lang="ts">
  interface Props {
    label?: string;
    size?: "small" | "normal" | "large";
    delayed?: boolean;
  }

  let { label = "Loading", size = "normal", delayed = false }: Props = $props();
</script>

<span class="spinner {size}" class:delayed role="status" aria-label={label}></span>

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

  .delayed {
    animation:
      appear var(--motion-appear) ease var(--motion-appear-delay) both,
      spin 0.8s linear infinite;
  }

  .small {
    width: var(--spinner-size-small);
    height: var(--spinner-size-small);
  }

  .large {
    width: var(--spinner-size-large);
    height: var(--spinner-size-large);
  }

  @keyframes appear {
    from {
      opacity: 0;
    }
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
