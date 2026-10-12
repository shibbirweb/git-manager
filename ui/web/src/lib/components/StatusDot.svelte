<!-- A small round dot that tells a state at a glance: a command's result, a server being on, a run going on (it
     pulses), or new activity. `label` is read by screen readers and shown as a tooltip. -->
<script lang="ts">
  interface Props {
    tone?: "neutral" | "success" | "danger" | "warning" | "accent";
    pulse?: boolean;
    size?: "normal" | "small";
    label?: string;
  }

  let { tone = "neutral", pulse = false, size = "normal", label }: Props = $props();
</script>

<span
  class="dot {tone} {size}"
  class:pulse
  role={label ? "img" : undefined}
  aria-label={label}
  aria-hidden={label ? undefined : true}
  title={label}
></span>

<style>
  .dot {
    flex: none;
    display: inline-block;
    width: var(--status-dot-size);
    height: var(--status-dot-size);
    border-radius: 50%;
    background: var(--text-faint);
  }

  .small {
    width: var(--status-dot-small-size);
    height: var(--status-dot-small-size);
  }

  .neutral.small {
    background: color-mix(in srgb, var(--text-dim) 40%, transparent);
  }

  .success {
    background: var(--success);
  }

  .danger {
    background: var(--danger);
  }

  .warning {
    background: var(--warning);
  }

  .accent {
    background: var(--accent);
  }

  .pulse {
    animation: pulse 1s ease-in-out infinite;
  }

  @keyframes pulse {
    50% {
      opacity: 0.3;
    }
  }
</style>
