<!-- An on/off switch for a setting that applies at once. `label` names it for screen readers. -->
<script lang="ts">
  interface Props {
    checked?: boolean;
    label: string;
    disabled?: boolean;
    onchange?: (checked: boolean) => void;
  }

  let { checked = $bindable(false), label, disabled = false, onchange }: Props = $props();
</script>

<input
  class="switch"
  type="checkbox"
  role="switch"
  aria-label={label}
  bind:checked
  {disabled}
  onchange={() => onchange?.(checked)}
/>

<style>
  .switch {
    flex: none;
    appearance: none;
    position: relative;
    width: var(--switch-width);
    height: var(--switch-height);
    margin: 0;
    border-radius: var(--switch-radius);
    background: var(--border-strong);
    cursor: pointer;
    transition: background var(--motion-normal);
  }

  .switch::after {
    content: "";
    position: absolute;
    top: var(--switch-inset);
    left: var(--switch-inset);
    width: var(--switch-knob);
    height: var(--switch-knob);
    border-radius: 50%;
    background: #fff;
    box-shadow: var(--shadow-knob);
    transition: transform var(--motion-normal);
  }

  .switch:checked {
    background: var(--accent);
  }

  .switch:checked::after {
    transform: translateX(calc(var(--switch-width) - var(--switch-knob) - 2 * var(--switch-inset)));
  }

  .switch:disabled {
    opacity: 0.5;
    cursor: default;
  }

  .switch:focus-visible {
    outline: 2px solid color-mix(in srgb, var(--accent) 45%, transparent);
    outline-offset: 2px;
  }
</style>
