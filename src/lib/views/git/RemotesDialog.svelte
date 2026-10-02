<!-- JetBrains' Git Remotes: each remote with its fetch and push URLs; add, edit (name and
     URLs) and remove, with the names checked like git does. -->
<script lang="ts">
  import { onMount } from "svelte";
  import { api, errorMessage } from "$lib/api";
  import { repoStore } from "$lib/stores/repo.svelte";
  import type { RemoteInfo } from "$lib/types";
  import { dialogs } from "$lib/ui/dialog.svelte";
  import GitDialogFrame from "./GitDialogFrame.svelte";
  import { gitDialogs } from "./gitDialogs.svelte";
  import { validateRemoteName, validateRemoteUrl } from "./gitOptions";

  interface Props {
    repoRoot: string;
  }

  let { repoRoot }: Props = $props();

  let remotes = $state.raw<RemoteInfo[]>([]);
  let loadError = $state<string | null>(null);
  /** The remote being added (original null) or edited. */
  let editing = $state<{ original: string | null; name: string; fetchUrl: string; pushUrl: string } | null>(null);
  let working = $state(false);
  let nameEl = $state<HTMLInputElement | null>(null);

  const names = $derived(remotes.map((remote) => remote.name));
  const nameError = $derived(editing ? validateRemoteName(editing.name, names, editing.original) : null);
  const fetchError = $derived(editing ? validateRemoteUrl(editing.fetchUrl) : null);
  const pushError = $derived(editing ? validateRemoteUrl(editing.pushUrl, true) : null);
  const canSave = $derived(editing !== null && !nameError && !fetchError && !pushError && !working);

  onMount(() => {
    void load();
  });

  async function load(): Promise<void> {
    try {
      remotes = await api.listRemotes(repoRoot);
      loadError = null;
    } catch (error) {
      loadError = errorMessage(error);
    }
  }

  async function startEdit(remote: RemoteInfo | null): Promise<void> {
    const fetchUrl = remote?.fetchUrl ?? "";
    const pushUrl = remote && remote.pushUrl && remote.pushUrl !== fetchUrl ? remote.pushUrl : "";
    editing = { original: remote?.name ?? null, name: remote?.name ?? (names.includes("origin") ? "" : "origin"), fetchUrl, pushUrl };
    // The form replaces the list; put the caret in its first field.
    await Promise.resolve();
    nameEl?.focus();
    nameEl?.select();
  }

  async function save(): Promise<void> {
    const form = editing;
    if (!form || !canSave) {
      return;
    }
    working = true;
    const name = form.name.trim();
    const fetchUrl = form.fetchUrl.trim();
    const pushUrl = form.pushUrl.trim() === "" ? null : form.pushUrl.trim();
    const original = form.original;
    const done = await repoStore.run(
      original ? "Edit remote" : "Add remote",
      async (repoPath) => {
        if (original) {
          await api.editRemote(repoPath, original, name, fetchUrl, pushUrl);
        } else {
          await api.addRemote(repoPath, name, fetchUrl, pushUrl);
        }
        return true;
      },
      { repoPath: repoRoot, success: original ? `Saved ${name}` : `Added ${name}` },
    );
    working = false;
    if (done) {
      editing = null;
    }
    await load();
  }

  async function remove(remote: RemoteInfo): Promise<void> {
    const confirmed = await dialogs.confirm({
      title: "Remove Remote",
      message: `Remove the remote '${remote.name}'? Its remote-tracking branches go too; the repository on the server is not touched.`,
      confirmLabel: "Remove",
      danger: true,
    });
    if (!confirmed) {
      return;
    }
    await repoStore.run("Remove remote", (repoPath) => api.removeRemote(repoPath, remote.name), {
      repoPath: repoRoot,
      success: `Removed ${remote.name}`,
    });
    await load();
  }

  function close(): void {
    if (editing) {
      editing = null;
      return;
    }
    gitDialogs.close();
  }
</script>

<GitDialogFrame title="Git Remotes" width={620} onCancel={close} onSubmit={editing ? () => void save() : undefined}>
  {#if editing}
    <label class="field">
      <span>Name</span>
      <input class="input" bind:this={nameEl} bind:value={editing.name} spellcheck="false" autocomplete="off" placeholder="origin" />
    </label>
    {#if nameError && editing.name !== ""}
      <div class="error">{nameError}</div>
    {/if}
    <label class="field">
      <span>URL</span>
      <input class="input mono" bind:value={editing.fetchUrl} spellcheck="false" autocomplete="off" placeholder="git@github.com:owner/repo.git" />
    </label>
    {#if fetchError && editing.fetchUrl !== ""}
      <div class="error">{fetchError}</div>
    {/if}
    <label class="field">
      <span>Push URL (optional: empty pushes to the URL above)</span>
      <input class="input mono" bind:value={editing.pushUrl} spellcheck="false" autocomplete="off" />
    </label>
    {#if pushError}
      <div class="error">{pushError}</div>
    {/if}
  {:else if loadError}
    <div class="error">{loadError}</div>
  {:else if remotes.length === 0}
    <p class="dim">This repository has no remotes.</p>
  {:else}
    <div class="remotes" role="list">
      {#each remotes as remote (remote.name)}
        <div class="remote" role="listitem">
          <div class="info">
            <div class="name">{remote.name}</div>
            <div class="url mono selectable truncate" title={remote.fetchUrl ?? ""}>{remote.fetchUrl ?? "(no URL)"}</div>
            {#if remote.pushUrl && remote.pushUrl !== remote.fetchUrl}
              <div class="url mono selectable truncate" title={remote.pushUrl}><span class="hint">push</span> {remote.pushUrl}</div>
            {/if}
          </div>
          <button type="button" class="btn small" onclick={() => void startEdit(remote)}>Edit</button>
          <button type="button" class="btn small danger" onclick={() => void remove(remote)}>Remove</button>
        </div>
      {/each}
    </div>
  {/if}

  {#snippet footer()}
    {#if editing}
      <span class="spacer"></span>
      <button type="button" class="btn" onclick={() => (editing = null)}>Back</button>
      <button type="button" class="btn primary" disabled={!canSave} onclick={() => void save()}>
        {editing.original ? "Save" : "Add"}
      </button>
    {:else}
      <button type="button" class="btn" onclick={() => void startEdit(null)} data-autofocus>Add Remote...</button>
      <span class="spacer"></span>
      <button type="button" class="btn primary" onclick={close}>Done</button>
    {/if}
  {/snippet}
</GitDialogFrame>

<style>
  .remotes {
    display: flex;
    flex-direction: column;
    border: 1px solid var(--border-strong);
    border-radius: var(--radius);
    background: var(--editor-bg);
  }

  .remote {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    border-bottom: 1px solid var(--border);
  }

  .remote:last-child {
    border-bottom: none;
  }

  .info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .name {
    font-weight: 600;
  }

  .url {
    font-size: 11.5px;
    color: var(--text-dim);
  }
</style>
