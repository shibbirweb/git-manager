<!-- How much of something is used: a label and its value on one line, a bar under them. `memory` is a thin bar on
     a quiet track (memory details), `usage` a taller one that turns warning and danger as it fills (AI usage), and
     `mini` is a short bar alone for a status bar item. `fraction` is 0 to 1. -->
<script lang="ts">
  interface Props {
    fraction: number;
    label?: string;
    value?: string;
    detail?: string;
    variant?: "memory" | "usage" | "mini";
    tone?: "accent" | "warning" | "danger";
  }

  let { fraction, label = "", value = "", detail = "", variant = "memory", tone = "accent" }: Props = $props();

  // The app never draws an empty bar: a sliver shows the meter is there.
  const MINIMUM = { memory: 0, usage: 0.02, mini: 0.04 };
  const width = $derived(`${Math.max(MINIMUM[variant], Math.min(1, Math.max(0, fraction))) * 100}%`);
</script>

<div class="meter {variant} {tone}">
  {#if variant !== "mini" && (label || value)}
    <div class="row">
      <span>{label}</span>
      <span class="value">{value}</span>
    </div>
  {/if}
  <div
    class="bar"
    role="meter"
    aria-label={label || value}
    aria-valuemin={0}
    aria-valuemax={1}
    aria-valuenow={fraction}
  >
    <div class="fill" style:width></div>
  </div>
  {#if detail}<div class="detail">{detail}</div>{/if}
</div>

<style>
  .meter {
    min-width: 0;
  }

  .row {
    display: flex;
    justify-content: space-between;
    font-size: var(--font-size-small);
  }

  .memory .value {
    font-family: var(--font-family-mono);
  }

  .usage .value {
    font-weight: var(--font-weight-bold);
  }

  .bar {
    height: var(--progress-height);
    margin-top: var(--meter-gap);
    border-radius: var(--progress-radius);
    background: var(--hover);
    overflow: hidden;
  }

  .usage .bar {
    height: var(--meter-usage-height);
    border-radius: var(--meter-usage-radius);
    background: var(--border);
  }

  .mini {
    flex: none;
    width: var(--meter-mini-width);
  }

  .mini .bar {
    margin-top: 0;
    background: var(--border);
  }

  .fill {
    height: 100%;
    border-radius: inherit;
    background: var(--accent);
  }

  .warning .fill {
    background: var(--warning);
  }

  .danger .fill {
    background: var(--danger);
  }

  .usage.warning .value {
    color: var(--warning);
  }

  .usage.danger .value {
    color: var(--danger);
  }

  .detail {
    margin-top: var(--space-1);
    color: var(--text-dim);
    font-size: var(--font-size-xsmall);
  }
</style>
