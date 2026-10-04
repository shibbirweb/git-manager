<!-- Settings > Git > Commit identity: user.name and user.email in the global config and in one
     repository's own config, which wins over the global one. "Use Global" removes the
     repository's values. Every write is `git config`; empty values are unset, never written. -->
<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { api, errorMessage } from "$lib/api";
  import { repoStore } from "$lib/stores/repo.svelte";
  import type { Identity, IdentityScope } from "$lib/types";
  import { dialogs } from "$lib/ui/dialog.svelte";
  import { toast } from "$lib/ui/toast.svelte";
  import { identityLabel, validateIdentityEmail, validateIdentityName } from "../changes/identity";

  let globalIdentity = $state<Identity | null>(null);
  let repoIdentity = $state<Identity | null>(null);
  let repoRoot = $state<string | null>(untrack(() => repoStore.repo?.root ?? repoStore.repos[0]?.root ?? null));
  let globalName = $state("");
  let globalEmail = $state("");
  let localName = $state("");
  let localEmail = $state("");
  let loadError = $state<string | null>(null);
  let saving = $state<IdentityScope | null>(null);
  let repoToken = 0;

  const repos = $derived(repoStore.repos);
  const globalNameError = $derived(validateIdentityName(globalName, false));
  const globalEmailError = $derived(validateIdentityEmail(globalEmail, false));
  const localNameError = $derived(validateIdentityName(localName, false));
  const localEmailError = $derived(validateIdentityEmail(localEmail, false));
  const globalChanged = $derived(
    globalIdentity !== null &&
      (globalName.trim() !== (globalIdentity.global.name ?? "") || globalEmail.trim() !== (globalIdentity.global.email ?? "")),
  );
  const localChanged = $derived(
    repoIdentity !== null &&
      (localName.trim() !== (repoIdentity.local.name ?? "") || localEmail.trim() !== (repoIdentity.local.email ?? "")),
  );
  const hasLocal = $derived(repoIdentity !== null && (repoIdentity.local.name !== null || repoIdentity.local.email !== null));
  const effective = $derived.by(() => {
    if (!repoIdentity) {
      return null;
    }
    return identityLabel(
      repoIdentity.local.name ?? repoIdentity.global.name,
      repoIdentity.local.email ?? repoIdentity.global.email,
    );
  });

  onMount(() => {
    void loadGlobal();
  });

  $effect(() => {
    const root = repoRoot;
    if (root === null) {
      repoIdentity = null;
      return;
    }
    void loadRepo(root);
  });

  function showGlobal(identity: Identity): void {
    globalIdentity = identity;
    globalName = identity.global.name ?? "";
    globalEmail = identity.global.email ?? "";
  }

  function showRepo(identity: Identity): void {
    repoIdentity = identity;
    localName = identity.local.name ?? "";
    localEmail = identity.local.email ?? "";
  }

  async function loadGlobal(): Promise<void> {
    try {
      showGlobal(await api.getIdentity(null));
      loadError = null;
    } catch (error) {
      loadError = errorMessage(error);
    }
  }

  async function loadRepo(root: string): Promise<void> {
    const token = ++repoToken;
    try {
      const identity = await api.getIdentity(root);
      if (token === repoToken) {
        showRepo(identity);
      }
    } catch (error) {
      if (token === repoToken) {
        repoIdentity = null;
        loadError = errorMessage(error);
      }
    }
  }

  async function write(scope: IdentityScope, name: string, email: string, success: string): Promise<void> {
    saving = scope;
    try {
      const identity = await api.setIdentity(scope === "local" ? repoRoot : null, scope, name, email);
      if (scope === "global") {
        showGlobal(identity);
        if (repoRoot !== null) {
          await loadRepo(repoRoot);
        }
      } else {
        showRepo(identity);
        // Keep any unsaved global edits in their fields.
        globalIdentity = identity;
      }
      toast.success(success);
    } catch (error) {
      toast.error("Could not save the identity", errorMessage(error));
    } finally {
      saving = null;
    }
  }

  async function saveGlobal(): Promise<void> {
    if (!globalIdentity || globalNameError || globalEmailError) {
      return;
    }
    const removes =
      (globalName.trim() === "" && globalIdentity.global.name !== null) ||
      (globalEmail.trim() === "" && globalIdentity.global.email !== null);
    if (removes) {
      const confirmed = await dialogs.confirm({
        title: "Remove Global Identity",
        message: "Remove the global name or email? Repositories without their own then cannot commit until one is set.",
        confirmLabel: "Remove",
        danger: true,
      });
      if (!confirmed) {
        return;
      }
    }
    await write("global", globalName, globalEmail, "Saved the global identity");
  }

  async function saveLocal(): Promise<void> {
    if (localNameError || localEmailError) {
      return;
    }
    await write("local", localName, localEmail, "Saved the identity for this repository");
  }

  async function useGlobal(): Promise<void> {
    const confirmed = await dialogs.confirm({
      title: "Use Global Identity",
      message: "Remove this repository's own name and email? Its commits then use the global ones.",
      confirmLabel: "Use Global",
      danger: true,
    });
    if (confirmed) {
      await write("local", "", "", "This repository now uses the global identity");
    }
  }

  function repoName(root: string): string {
    return repos.find((repo) => repo.root === root)?.name ?? root;
  }
</script>

<div class="identity">
  {#if loadError}
    <div class="error">{loadError}</div>
  {/if}

  <div class="block">
    <div class="block-head">
      <span class="block-title">Global</span>
      {#if globalIdentity?.globalFile}
        <span class="file mono truncate" title={globalIdentity.globalFile}>{globalIdentity.globalFile}</span>
      {/if}
    </div>
    <div class="fields">
      <input class="input" bind:value={globalName} placeholder="Name" aria-label="Global name" autocomplete="off" spellcheck="false" />
      <input class="input" bind:value={globalEmail} placeholder="Email" aria-label="Global email" autocomplete="off" spellcheck="false" />
      <button class="btn small" onclick={() => void saveGlobal()} disabled={!globalChanged || saving !== null || !!globalNameError || !!globalEmailError}>
        Save
      </button>
    </div>
    {#if globalNameError || globalEmailError}
      <div class="error">{globalNameError ?? globalEmailError}</div>
    {/if}
  </div>

  {#if repoRoot !== null}
    <div class="block">
      <div class="block-head">
        <span class="block-title">Repository</span>
        {#if repos.length > 1}
          <select class="input repo-select" bind:value={repoRoot} aria-label="Repository">
            {#each repos as repo (repo.root)}
              <option value={repo.root}>{repo.name}</option>
            {/each}
          </select>
        {:else}
          <span class="repo-name truncate" title={repoRoot}>{repoName(repoRoot)}</span>
        {/if}
      </div>
      <div class="fields">
        <input
          class="input"
          bind:value={localName}
          placeholder={repoIdentity?.global.name ? `${repoIdentity.global.name} (global)` : "Name"}
          aria-label="Repository name"
          autocomplete="off"
          spellcheck="false"
        />
        <input
          class="input"
          bind:value={localEmail}
          placeholder={repoIdentity?.global.email ? `${repoIdentity.global.email} (global)` : "Email"}
          aria-label="Repository email"
          autocomplete="off"
          spellcheck="false"
        />
        <button class="btn small" onclick={() => void saveLocal()} disabled={!localChanged || saving !== null || !!localNameError || !!localEmailError}>
          Save
        </button>
      </div>
      {#if localNameError || localEmailError}
        <div class="error">{localNameError ?? localEmailError}</div>
      {/if}
      <div class="status">
        {#if repoIdentity && !repoIdentity.complete}
          <span class="warning">git has no name and email here yet</span>
        {:else if effective}
          <span class="hint truncate">Commits use {effective}</span>
        {/if}
        <span class="spacer"></span>
        {#if hasLocal}
          <button class="btn small" onclick={() => void useGlobal()} disabled={saving !== null}>Use Global</button>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .identity {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .block {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .block-head {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .block-title {
    flex: none;
    font-size: 12px;
    font-weight: 600;
  }

  .file,
  .repo-name {
    min-width: 0;
    font-size: 11.5px;
    color: var(--text-faint);
  }

  .repo-select {
    height: 24px;
    max-width: 240px;
    padding: 0 4px;
  }

  .fields {
    display: flex;
    gap: 6px;
  }

  .fields .input {
    flex: 1;
    min-width: 0;
  }

  .fields .btn {
    flex: none;
    height: 28px;
  }

  .status {
    display: flex;
    align-items: center;
    gap: 8px;
    min-height: 24px;
    min-width: 0;
  }

  .spacer {
    flex: 1;
  }

  .hint {
    min-width: 0;
    font-size: 12px;
    color: var(--text-dim);
  }

  .warning {
    font-size: 12px;
    color: var(--warning);
  }

  .error {
    font-size: 12px;
    color: var(--danger);
  }
</style>
