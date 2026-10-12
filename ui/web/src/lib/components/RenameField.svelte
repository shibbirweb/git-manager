<!-- A name being edited in place, such as a terminal's: a small field with an accent border that takes Enter to
     keep the name and Escape to cancel. `invalid` (a name already taken) turns the border red. -->
<script lang="ts">
  interface Props {
    value: string;
    label?: string;
    invalid?: boolean;
    onrename: (name: string | null) => void;
    oninput?: (name: string) => void;
  }

  let { value, label = "New name", invalid = false, onrename, oninput }: Props = $props();

  // Enter, Escape and leaving the field each end the rename; only the first one counts.
  let done = false;

  function finish(name: string | null): void {
    if (!done) {
      done = true;
      onrename(name);
    }
  }

  function focusAndSelect(input: HTMLInputElement): void {
    input.focus();
    input.select();
  }
</script>

<input
  class="rename"
  class:invalid
  {value}
  aria-label={label}
  aria-invalid={invalid}
  spellcheck="false"
  use:focusAndSelect
  oninput={(event) => oninput?.(event.currentTarget.value)}
  onclick={(event) => event.stopPropagation()}
  onkeydown={(event) => {
    event.stopPropagation();
    if (event.key === "Enter") {
      finish(event.currentTarget.value.trim() || null);
    } else if (event.key === "Escape") {
      finish(null);
    }
  }}
  onblur={(event) => finish(event.currentTarget.value.trim() || null)}
/>

<style>
  .rename {
    flex: 1;
    min-width: 0;
    height: var(--rename-field-height);
    padding: 0 var(--rename-field-padding-x);
    border: 1px solid var(--accent);
    border-radius: var(--rename-field-radius);
    outline: none;
    background: var(--editor-bg);
    color: var(--text);
    font: inherit;
  }

  .invalid {
    border-color: var(--danger);
  }
</style>
