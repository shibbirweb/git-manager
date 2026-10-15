<!-- Keep computer awake in the status bar, like Orca's: a coffee cup, the mode and a dot that fills while the computer
     is held awake. Click for the menu: the title and status, then On, Agent and Off with what each does. -->
<script lang="ts">
  import { settings } from "$lib/stores/settings.svelte";
  import type { ComputerAwakeMode } from "$lib/stores/settingsData";
  import Icon from "@git-manager/ui/components/Icon.svelte";
  import { platformName } from "$lib/update/releases";
  import { keepAwake } from "./keepAwakeStore.svelte";
  import { AWAKE_MODES, AWAKE_TITLE, lidNote, modeLabel, statusText } from "./keepAwakeModel";

  let open = $state(false);
  let rootEl = $state<HTMLDivElement | null>(null);

  const mode = $derived(settings.computerAwakeMode);
  const status = $derived(statusText(mode, keepAwake.active));
  const note = lidNote(platformName(navigator.userAgent));
  const tooltip = $derived(
    keepAwake.error ? `${AWAKE_TITLE}: ${keepAwake.error}` : `${AWAKE_TITLE}, ${status}. ${note}`,
  );

  function choose(value: ComputerAwakeMode): void {
    settings.setPreference("computerAwakeMode", value);
    open = false;
  }
</script>

<svelte:window
  onmousedown={(event) => {
    if (open && rootEl && !rootEl.contains(event.target as Node)) {
      open = false;
    }
  }}
  onkeydown={(event) => {
    if (event.key === "Escape" && open) {
      open = false;
    }
  }}
/>

<div class="awake" bind:this={rootEl}>
  <button
    class="awake-button"
    class:active={keepAwake.active}
    title={tooltip}
    aria-label="{AWAKE_TITLE}, {status}"
    aria-haspopup="menu"
    aria-expanded={open}
    onclick={() => (open = !open)}
  >
    <Icon name="coffee" size="compact" />
    <span class="label">{modeLabel(mode)}</span>
    <span class="dot" aria-hidden="true"></span>
  </button>

  {#if open}
    <div class="menu" role="menu" aria-label={AWAKE_TITLE}>
      <div class="menu-head">
        <span>{AWAKE_TITLE}</span>
        <span class="dim">{status}</span>
      </div>
      <div class="separator"></div>
      {#each AWAKE_MODES as choice (choice.value)}
        <button
          class="choice"
          role="menuitemradio"
          aria-checked={mode === choice.value}
          onclick={() => choose(choice.value)}
        >
          <span class="radio" aria-hidden="true">
            {#if mode === choice.value}<span class="radio-dot"></span>{/if}
          </span>
          <span class="choice-text">
            <span>{choice.label}</span>
            <span class="description">{choice.description}</span>
          </span>
        </button>
      {/each}
      {#if keepAwake.error}
        <div class="separator"></div>
        <div class="error">{keepAwake.error}</div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .awake {
    position: relative;
    display: flex;
    align-items: center;
  }

  .awake-button {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    height: 20px;
    padding: 0 6px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--text-dim);
    font-size: 11px;
    font-weight: 500;
    cursor: pointer;
  }

  .awake-button:hover {
    color: var(--text);
    background: var(--hover);
  }

  .awake-button.active {
    color: var(--text);
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: color-mix(in srgb, var(--text-dim) 40%, transparent);
  }

  .active .dot {
    background: var(--text);
  }

  .menu {
    position: absolute;
    right: 0;
    bottom: 26px;
    z-index: 600;
    width: 256px;
    padding: 4px;
    background: var(--panel);
    border: 1px solid var(--border-strong);
    border-radius: 8px;
    box-shadow: var(--shadow);
    color: var(--text);
    font-size: 12px;
  }

  .menu-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 6px 8px;
    font-weight: 600;
  }

  .menu-head .dim {
    font-weight: 400;
  }

  .separator {
    height: 1px;
    margin: 4px -4px;
    background: var(--border);
  }

  .choice {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    padding: 6px 8px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: var(--text);
    text-align: left;
    cursor: pointer;
  }

  .choice:hover,
  .choice:focus-visible {
    background: var(--hover);
    outline: none;
  }

  .radio {
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 14px;
  }

  .radio-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--text);
  }

  .choice-text {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .description {
    font-size: 11px;
    color: var(--text-dim);
  }

  .error {
    padding: 6px 8px;
    color: var(--danger);
    font-size: 11px;
  }
</style>
