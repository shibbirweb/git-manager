<!-- JetBrains' Commit Options behind a gear next to the Commit button: sign-off, author,
     GPG signing and skipping hooks. Sign-off and GPG are settings; the author and Skip hooks
     stay with the repository until the app quits. -->
<script lang="ts">
  import { tick } from "svelte";
  import type { GpgSign } from "$lib/types";
  import Icon from "$lib/ui/Icon.svelte";
  import { changedOptionCount, commitOptionsTooltip, GPG_SIGN_CHOICES, validateAuthor } from "./commitOptions";
  import { commitOptions } from "./commitOptions.svelte";

  interface Props {
    repoRoot: string;
    disabled?: boolean;
  }

  let { repoRoot, disabled = false }: Props = $props();

  let open = $state(false);
  let rootEl = $state<HTMLDivElement | null>(null);
  let panelEl = $state<HTMLDivElement | null>(null);
  let buttonEl = $state<HTMLButtonElement | null>(null);
  /** Fixed position above the gear, kept inside the window (the sidebar may be narrow). */
  let place = $state({ left: 0, bottom: 0 });

  const PANEL_WIDTH = 280;

  const options = $derived(commitOptions.for(repoRoot));
  const authorError = $derived(validateAuthor(options.author ?? ""));
  const changed = $derived(changedOptionCount({ ...options, author: authorError ? null : options.author }));

  async function toggle(): Promise<void> {
    open = !open;
    if (open && buttonEl) {
      const rect = buttonEl.getBoundingClientRect();
      place = {
        left: Math.max(8, Math.min(rect.right - PANEL_WIDTH, window.innerWidth - PANEL_WIDTH - 8)),
        bottom: window.innerHeight - rect.top + 6,
      };
    }
    if (open) {
      await tick();
      panelEl?.querySelector<HTMLElement>("input")?.focus();
    }
  }

  function close(restoreFocus: boolean): void {
    open = false;
    if (restoreFocus) {
      buttonEl?.focus();
    }
  }

  function onWindowPointer(event: PointerEvent): void {
    if (open && rootEl && !rootEl.contains(event.target as Node)) {
      close(false);
    }
  }

  function onPanelKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    }
  }
</script>

<svelte:window onpointerdown={onWindowPointer} />

<div class="commit-options" bind:this={rootEl}>
  <button
    bind:this={buttonEl}
    class="btn gear"
    class:active={changed > 0}
    onclick={() => void toggle()}
    {disabled}
    title={commitOptionsTooltip({ ...options, author: authorError ? null : options.author })}
    aria-label="Commit Options"
    aria-haspopup="dialog"
    aria-expanded={open}
  >
    <Icon name="settings" size={13} />
    {#if changed > 0}<span class="badge">{changed}</span>{/if}
  </button>
  {#if open}
    <div
      class="panel"
      bind:this={panelEl}
      role="dialog"
      aria-label="Commit Options"
      tabindex="-1"
      style="left: {place.left}px; bottom: {place.bottom}px; width: {PANEL_WIDTH}px"
      onkeydown={onPanelKeydown}
    >
      <div class="heading">Commit Options</div>
      <label class="check">
        <input
          type="checkbox"
          checked={options.signOff}
          onchange={(event) => commitOptions.setSignOff(event.currentTarget.checked)}
        />
        Sign-off (--signoff)
      </label>
      <label class="field">
        <span>Author (--author)</span>
        <input
          class="input mono"
          value={options.author ?? ""}
          oninput={(event) => commitOptions.setAuthor(repoRoot, event.currentTarget.value)}
          placeholder="Name <email>"
          spellcheck="false"
          autocomplete="off"
        />
      </label>
      {#if authorError}
        <div class="error">{authorError}</div>
      {/if}
      <fieldset class="gpg">
        <legend>GPG sign</legend>
        <div class="segments" role="radiogroup" aria-label="GPG sign">
          {#each GPG_SIGN_CHOICES as choice (choice.value)}
            <label class="segment" class:selected={options.gpgSign === choice.value} title={choice.description}>
              <input
                type="radio"
                name="gpg-sign-{repoRoot}"
                value={choice.value}
                checked={options.gpgSign === choice.value}
                onchange={() => commitOptions.setGpgSign(choice.value as GpgSign)}
              />
              {choice.label}
            </label>
          {/each}
        </div>
      </fieldset>
      <label class="check">
        <input
          type="checkbox"
          checked={options.noVerify}
          onchange={(event) => commitOptions.setNoVerify(repoRoot, event.currentTarget.checked)}
        />
        Skip hooks (--no-verify)
      </label>
      <div class="hint">Sign-off and GPG apply to every commit. Author and Skip hooks apply to this repository until you quit.</div>
    </div>
  {/if}
</div>

<style>
  .commit-options {
    position: relative;
    flex: none;
    display: inline-flex;
  }

  .gear {
    position: relative;
    padding: 0 6px;
  }

  .gear.active {
    color: var(--accent);
    border-color: var(--accent);
  }

  .badge {
    position: absolute;
    top: -5px;
    right: -5px;
    min-width: 14px;
    height: 14px;
    padding: 0 3px;
    border-radius: 7px;
    background: var(--accent);
    color: var(--accent-text);
    font-size: 9.5px;
    line-height: 14px;
    text-align: center;
  }

  .panel {
    position: fixed;
    z-index: 800;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    background: var(--panel);
    border: 1px solid var(--border-strong);
    border-radius: 8px;
    box-shadow: var(--shadow);
    outline: none;
  }

  .heading {
    font-weight: 600;
  }

  .check {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .field > span,
  legend {
    color: var(--text-dim);
    font-size: 12px;
  }

  .gpg {
    margin: 0;
    padding: 0;
    border: none;
  }

  legend {
    padding: 0;
    margin-bottom: 4px;
  }

  .segments {
    display: flex;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius);
    overflow: hidden;
  }

  .segment {
    flex: 1;
    text-align: center;
    padding: 3px 4px;
    font-size: 12px;
    cursor: pointer;
  }

  .segment + .segment {
    border-left: 1px solid var(--border-strong);
  }

  .segment.selected {
    background: var(--selected);
    font-weight: 600;
  }

  .segment input {
    position: absolute;
    opacity: 0;
    pointer-events: none;
  }

  .segment:focus-within {
    outline: 1px solid var(--accent);
    outline-offset: -1px;
  }

  .error {
    color: var(--danger);
    font-size: 12px;
  }

  .hint {
    color: var(--text-faint);
    font-size: 11.5px;
  }
</style>
