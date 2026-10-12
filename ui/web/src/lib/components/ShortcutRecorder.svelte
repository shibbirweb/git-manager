<!-- A command's keys that can be changed: shows the keys (or None); click to record, then the next key press is
     handed to `onrecord` and the field shows what was pressed. Esc cancels. The app turns the press into keys and
     checks them; the field only draws and listens. -->
<script lang="ts">
  interface Props {
    keys: string;
    recording?: boolean;
    pending?: string | null;
    label: string;
    onrecord: (event: KeyboardEvent) => void;
    oncancel?: () => void;
  }

  let { keys, recording = $bindable(false), pending = null, label, onrecord, oncancel }: Props = $props();

  function focusRecorder(element: HTMLElement): void {
    element.focus();
  }

  function keydown(event: KeyboardEvent): void {
    event.preventDefault();
    event.stopPropagation();
    if (event.key === "Escape") {
      recording = false;
      oncancel?.();
      return;
    }
    onrecord(event);
  }
</script>

{#if recording}
  <div
    class="recorder"
    tabindex="0"
    role="textbox"
    aria-label="Press the new keys for {label}"
    use:focusRecorder
    onkeydown={keydown}
  >
    {pending ?? "Press keys"}
  </div>
{:else}
  <button
    class="keys"
    type="button"
    title="Change the keys"
    aria-label="Change the keys of {label}"
    onclick={() => (recording = true)}
  >
    {#if keys}
      <kbd>{keys}</kbd>
    {:else}
      <span class="none">None</span>
    {/if}
  </button>
{/if}

<style>
  .keys,
  .recorder {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    justify-content: flex-end;
    width: var(--shortcut-recorder-width);
    min-height: var(--shortcut-recorder-min-height);
    padding: 0 var(--shortcut-recorder-padding-x);
    border: 1px solid transparent;
    border-radius: var(--radius-control);
    background: none;
    color: var(--text);
    font: inherit;
    cursor: pointer;
  }

  .keys:hover {
    border-color: var(--border-strong);
  }

  .recorder {
    justify-content: center;
    border-color: var(--accent);
    background: var(--panel);
    cursor: text;
    outline: none;
  }

  kbd {
    padding: 1px var(--space-3);
    border: 1px solid var(--border-strong);
    border-bottom-width: var(--border-width-thick);
    border-radius: var(--kbd-radius);
    background: var(--panel-alt);
    color: var(--text);
    font-family: var(--font-ui);
    font-size: var(--font-size-small);
    white-space: nowrap;
  }

  .none {
    color: var(--text-dim);
  }
</style>
