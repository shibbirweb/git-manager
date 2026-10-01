<!-- What's New: the changelog built into this version, so it works offline. -->
<script lang="ts">
  import changelogText from "../../../CHANGELOG.md?raw";
  import Icon from "$lib/ui/Icon.svelte";
  import { entryFor, releasedEntries } from "./changelog";
  import ReleaseNotes from "./ReleaseNotes.svelte";
  import { updates } from "./updates.svelte";

  const isBetaBuild = $derived((updates.current ?? "").includes("-"));
  // A beta ships the Unreleased notes; a stable build has its own dated section.
  const current = $derived(
    updates.current ? (isBetaBuild ? entryFor(changelogText, "Unreleased") : entryFor(changelogText, updates.current)) : null,
  );
  const older = $derived(releasedEntries(changelogText).filter((entry) => entry.version !== updates.current).slice(0, 10));
  let showOlder = $state(false);

  function close(): void {
    updates.whatsNewOpen = false;
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape" && !event.defaultPrevented) {
      event.preventDefault();
      close();
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="overlay" role="presentation" onmousedown={(event) => event.target === event.currentTarget && close()}>
  <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="whats-new-title">
    <div class="head">
      <div class="badge"><Icon name="wand" size={18} /></div>
      <div>
        <h2 id="whats-new-title">What's New in Git Manager {updates.current ?? ""}</h2>
        <p class="dim">{isBetaBuild ? "A beta build: these changes are still being tested." : "Here is what changed in this version."}</p>
      </div>
    </div>

    <div class="body">
      {#if current?.body}
        <ReleaseNotes markdown={current.body} />
      {:else}
        <p class="dim">No notes were written for this version.</p>
      {/if}

      {#if older.length > 0}
        <button class="older-toggle" onclick={() => (showOlder = !showOlder)}>
          <Icon name={showOlder ? "chevron-down" : "chevron-right"} size={12} />
          Earlier versions
        </button>
        {#if showOlder}
          {#each older as entry (entry.version)}
            <section>
              <div class="release-head">
                <strong>{entry.version}</strong>
                <span class="dim">{entry.date ?? ""}</span>
              </div>
              <ReleaseNotes markdown={entry.body} />
            </section>
          {/each}
        {/if}
      {/if}
    </div>

    <div class="actions">
      <button class="btn small link" onclick={() => void updates.openReleasesPage()}>All releases on GitHub</button>
      <div class="spacer"></div>
      <button class="btn primary" onclick={close}>Got It</button>
    </div>
  </div>
</div>

<style>
  .overlay {
    position: fixed;
    inset: 0;
    z-index: 860;
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 9vh;
    background: var(--overlay);
  }

  .dialog {
    width: min(620px, calc(100vw - 32px));
    max-height: 80vh;
    display: flex;
    flex-direction: column;
    background: var(--panel);
    border: 1px solid var(--border-strong);
    border-radius: 12px;
    box-shadow: var(--shadow);
  }

  .head {
    display: flex;
    gap: 14px;
    padding: 18px 20px 12px;
  }

  .badge {
    flex: none;
    width: 38px;
    height: 38px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 10px;
    background: color-mix(in srgb, var(--success) 16%, transparent);
    color: var(--success);
  }

  h2 {
    margin: 0 0 3px;
    font-size: 15px;
  }

  p {
    margin: 0;
    font-size: 12.5px;
  }

  .body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 8px 20px 12px;
  }

  .older-toggle {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: 14px;
    padding: 4px 0;
    border: none;
    background: transparent;
    color: var(--text-dim);
    cursor: pointer;
  }

  section {
    padding: 12px 0;
    border-top: 1px solid var(--border);
  }

  .release-head {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 20px 16px;
    border-top: 1px solid var(--border-strong);
  }

  .spacer {
    flex: 1;
  }

  .btn.link {
    border-color: transparent;
    background: transparent;
    color: var(--accent);
  }
</style>
