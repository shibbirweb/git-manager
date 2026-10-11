<!-- A thin bar for a share of a whole, like each process's memory in the status bar details. -->
<script lang="ts">
  interface Props {
    value: number;
    label: string;
    tone?: "accent" | "danger" | "warning" | "success";
    minimum?: number;
  }

  let { value, label, tone = "accent", minimum = 0.02 }: Props = $props();

  const shown = $derived(Math.min(1, Math.max(minimum, Number.isFinite(value) ? value : 0)));
</script>

<div
  class="bar"
  role="progressbar"
  aria-label={label}
  aria-valuemin={0}
  aria-valuemax={100}
  aria-valuenow={Math.round(shown * 100)}
>
  <div class="fill {tone}" style:width="{shown * 100}%"></div>
</div>

<style>
  .bar {
    height: var(--progress-height);
    border-radius: var(--progress-radius);
    background: var(--hover);
    overflow: hidden;
  }

  .fill {
    height: 100%;
    border-radius: var(--progress-radius);
    background: var(--accent);
  }

  .danger {
    background: var(--danger);
  }

  .warning {
    background: var(--warning);
  }

  .success {
    background: var(--success);
  }
</style>
