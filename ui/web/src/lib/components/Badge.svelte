<!-- A count in a small pill, like the changes count on the activity bar. Shows "99+" above `max`. -->
<script lang="ts">
  interface Props {
    count: number;
    max?: number;
    tone?: "accent" | "danger" | "warning" | "neutral" | "quiet";
    size?: "small" | "normal" | "large" | "corner";
    label?: string;
  }

  let { count, max = 99, tone = "accent", size = "normal", label }: Props = $props();
</script>

<span class="badge {tone} {size}" aria-label={label ?? String(count)}>{count > max ? `${max}+` : count}</span>

<style>
  .badge {
    display: inline-block;
    min-width: var(--badge-size);
    height: var(--badge-size);
    padding: 0 var(--badge-padding-x);
    border-radius: var(--badge-radius);
    background: var(--accent);
    color: var(--accent-text);
    font-size: var(--font-size-tiny);
    font-weight: var(--font-weight-semibold);
    line-height: var(--badge-size);
    text-align: center;
  }

  .danger {
    background: var(--danger);
  }

  .warning {
    background: var(--warning);
  }

  .neutral {
    background: var(--hover);
    color: var(--text-dim);
  }

  /* A group's count in the Changes panel. */
  .quiet {
    background: var(--selected-inactive);
    color: var(--text-dim);
  }

  /* On a status bar button, such as the notification bell. */
  .small {
    min-width: var(--badge-small-size);
    height: var(--badge-small-size);
    border-radius: var(--badge-small-radius);
    line-height: var(--badge-small-size);
  }

  /* Pinned to a button's top right corner, such as the number of commit options turned on. */
  .corner {
    position: absolute;
    top: calc(var(--badge-corner-offset) * -1);
    right: calc(var(--badge-corner-offset) * -1);
    min-width: var(--badge-small-size);
    height: var(--badge-small-size);
    padding: 0 var(--badge-corner-padding-x);
    border-radius: var(--badge-small-radius);
    font-size: var(--font-size-micro);
    font-weight: var(--font-weight-regular);
    line-height: var(--badge-small-size);
  }

  .large {
    min-width: var(--badge-large-min-width);
    height: var(--badge-large-height);
    padding: 0 var(--badge-large-padding-x);
    border-radius: var(--badge-large-radius);
    font-size: var(--font-size-xsmall);
    line-height: var(--badge-large-height);
  }
</style>
