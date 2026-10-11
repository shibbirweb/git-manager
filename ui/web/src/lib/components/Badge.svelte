<!-- A count in a small pill, like the changes count on the activity bar. Shows "99+" above `max`. -->
<script lang="ts">
  interface Props {
    count: number;
    max?: number;
    tone?: "accent" | "danger" | "neutral";
    label?: string;
  }

  let { count, max = 99, tone = "accent", label }: Props = $props();
</script>

<span class="badge {tone}" aria-label={label ?? String(count)}>{count > max ? `${max}+` : count}</span>

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

  .neutral {
    background: var(--hover);
    color: var(--text-dim);
  }
</style>
