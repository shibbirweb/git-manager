<!-- "A new version is available": notes for every release since this one, and a download link.
     A manual check can also open it for a version the user skipped, marked as such. -->
<script lang="ts">
  import Icon from "$lib/ui/Icon.svelte";
  import ReleaseNotes from "./ReleaseNotes.svelte";
  import { updates } from "./updates.svelte";

  const newest = $derived(updates.newer[0] ?? null);
  const skipped = $derived(updates.newestSkipped);

  function close(): void {
    updates.dialogOpen = false;
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.key === "Escape" && !event.defaultPrevented) {
      event.preventDefault();
      close();
    }
  }

  function formatDate(value: string | null): string {
    return value ? new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "";
  }
</script>

<svelte:window onkeydown={onKeydown} />

{#if newest}
  <div class="overlay" role="presentation" onmousedown={(event) => event.target === event.currentTarget && close()}>
    <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="update-title">
      <div class="head">
        <div class="badge"><Icon name="arrow-down" size={18} /></div>
        <div>
          <h2 id="update-title">Git Manager {newest.version} is available</h2>
          <p class="dim">
            You have {updates.current}{newest.prerelease ? ". This is a beta release." : "."}
            {#if updates.newer.length > 1}
              {updates.newer.length} releases since yours are listed below.
            {/if}
          </p>
          {#if skipped}
            <p class="skipped">You skipped this version.</p>
          {/if}
        </div>
      </div>

      <div class="releases">
        {#each updates.newer as release (release.tag)}
          <section>
            <div class="release-head">
              <strong>{release.name}</strong>
              {#if release.prerelease}
                <span class="beta">Beta</span>
              {/if}
              <span class="dim date">{formatDate(release.publishedAt)}</span>
            </div>
            <ReleaseNotes markdown={release.notes} />
          </section>
        {/each}
      </div>

      <div class="actions">
        <button class="btn small link" onclick={() => void updates.open(newest.url)}>View on GitHub</button>
        <div class="spacer"></div>
        {#if skipped}
          <button class="btn" onclick={() => updates.unskip()} title="Announce this version again">Stop Skipping</button>
        {:else}
          <button class="btn" onclick={() => updates.skip(newest)} title="Do not announce this version again">Skip This Version</button>
        {/if}
        <button class="btn" onclick={close}>Later</button>
        <button class="btn primary" onclick={() => void updates.download(newest)}>
          <Icon name="arrow-down" size={13} />
          Download
        </button>
      </div>
    </div>
  </div>
{/if}

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
    background: color-mix(in srgb, var(--accent) 14%, transparent);
    color: var(--accent);
  }

  h2 {
    margin: 0 0 3px;
    font-size: 15px;
  }

  p {
    margin: 0;
    font-size: 12.5px;
  }

  .skipped {
    margin-top: 6px;
    color: var(--warning);
    font-weight: 600;
  }

  .releases {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 4px 20px 8px;
  }

  section {
    padding: 12px 0;
    border-top: 1px solid var(--border);
  }

  .release-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .beta {
    padding: 0 6px;
    border-radius: 8px;
    background: color-mix(in srgb, var(--warning) 18%, transparent);
    color: var(--warning);
    font-size: 11px;
    font-weight: 600;
  }

  .date {
    margin-left: auto;
    font-size: 12px;
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
