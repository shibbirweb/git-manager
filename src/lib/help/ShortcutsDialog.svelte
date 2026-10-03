<!-- Help > Keyboard Shortcuts: every shortcut, from the menu bar's own definition plus the ones no
     menu shows (shortcuts.ts). Lazy-loaded by App.svelte and mounted only while open. -->
<script lang="ts">
  import { onMount } from "svelte";
  import { platformFromUserAgent } from "$lib/menu/menuSpec";
  import { settings } from "$lib/stores/settings.svelte";
  import { dialogs } from "$lib/ui/dialog.svelte";
  import Icon from "$lib/ui/Icon.svelte";
  import { SHORTCUTS_URL } from "$lib/update/releases";
  import { updates } from "$lib/update/updates.svelte";
  import { helpDialogs } from "./helpDialogs.svelte";
  import { filterShortcuts, shortcutSections } from "./shortcuts";

  let filter = $state("");
  let filterEl = $state<HTMLInputElement | null>(null);

  const sections = shortcutSections(platformFromUserAgent(navigator.userAgent), settings.keybindings);
  const shown = $derived(filterShortcuts(sections, filter));
  const total = sections.reduce((sum, section) => sum + section.rows.length, 0);
  const count = $derived(shown.reduce((sum, section) => sum + section.rows.length, 0));

  onMount(() => {
    filterEl?.focus();
  });

  function close(): void {
    helpDialogs.shortcutsOpen = false;
  }

  function changeShortcuts(): void {
    close();
    settings.openDialog("keyboard");
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape" && !dialogs.active && !event.defaultPrevented) {
      event.preventDefault();
      if (filter) {
        filter = "";
      } else {
        close();
      }
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="overlay" role="presentation" onmousedown={(event) => event.target === event.currentTarget && close()}>
  <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="shortcuts-title">
    <div class="head">
      <h2 id="shortcuts-title">Keyboard Shortcuts</h2>
      <button class="icon-btn" onclick={close} aria-label="Close"><Icon name="x" size={15} /></button>
    </div>
    <div class="toolbar">
      <input
        class="input filter"
        placeholder="Filter by action or key, for example: terminal, commit, F7"
        bind:value={filter}
        bind:this={filterEl}
        aria-label="Filter shortcuts"
        spellcheck="false"
      />
      <span class="count dim">{filter.trim() ? `${count} of ${total}` : `${total} shortcuts`}</span>
    </div>
    <div class="body">
      {#each shown as section (section.title)}
        <section>
          <h3>{section.title}</h3>
          {#each section.rows as row (`${row.label}-${row.keys.join(",")}`)}
            <div class="row">
              <div class="label">
                <span>{row.label}</span>
                {#if row.context}
                  <span class="context dim">{row.context}</span>
                {/if}
              </div>
              <div class="keys">
                {#each row.keys as combo, index (combo)}
                  {#if index > 0}
                    <span class="or dim">or</span>
                  {/if}
                  <kbd class="selectable">{combo}</kbd>
                {/each}
              </div>
            </div>
          {/each}
        </section>
      {:else}
        <p class="dim empty">No shortcut matches the filter.</p>
      {/each}
    </div>
    <div class="foot">
      <span class="dim">The Edit, Code and View items with keys work where the menu shows them enabled.</span>
      <div class="foot-actions">
        <button class="btn small" onclick={changeShortcuts}>Change Shortcuts</button>
        <button class="btn small" onclick={() => void updates.open(SHORTCUTS_URL)}>Open Online Version</button>
      </div>
    </div>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 855;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 7vh;
    background: var(--overlay);
  }

  .dialog {
    width: min(720px, calc(100vw - 32px));
    max-height: 84vh;
    display: flex;
    flex-direction: column;
    background: var(--panel);
    border: 1px solid var(--border-strong);
    border-radius: 12px;
    box-shadow: var(--shadow);
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px 16px 6px 20px;
  }

  h2 {
    margin: 0;
    font-size: 15px;
  }

  .toolbar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px 20px 10px;
    border-bottom: 1px solid var(--border-strong);
  }

  .filter {
    flex: 1;
    min-width: 0;
  }

  .count {
    flex: none;
    font-size: 12px;
  }

  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 4px 20px 12px;
  }

  section {
    padding-top: 12px;
  }

  h3 {
    margin: 0 0 4px;
    padding-bottom: 4px;
    border-bottom: 1px solid var(--border);
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--text-dim);
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    min-height: 30px;
    padding: 3px 0;
    border-bottom: 1px solid color-mix(in srgb, var(--border) 50%, transparent);
  }

  .label {
    display: flex;
    flex-direction: column;
    min-width: 0;
    font-size: 13px;
  }

  .context {
    font-size: 11.5px;
  }

  .keys {
    flex: none;
    display: flex;
    align-items: center;
    gap: 6px;
  }

  kbd {
    min-width: 24px;
    padding: 2px 7px;
    border: 1px solid var(--border-strong);
    border-bottom-width: 2px;
    border-radius: 5px;
    background: var(--panel-alt);
    color: var(--text);
    font-family: var(--font-ui);
    font-size: 12px;
    text-align: center;
    white-space: nowrap;
  }

  .or {
    font-size: 11px;
  }

  .empty {
    padding: 20px 0;
    text-align: center;
  }

  .foot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 20px;
    border-top: 1px solid var(--border-strong);
    font-size: 12px;
  }

  .foot-actions {
    display: flex;
    flex-shrink: 0;
    gap: 6px;
  }
</style>
