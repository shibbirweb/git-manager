<!-- Add Submodule: the repository URL, the path inside this repository (from the URL until
     edited) and an optional branch to follow. Runs `git submodule add`. -->
<script lang="ts">
  import { onMount } from "svelte";
  import { api, errorMessage } from "$lib/api";
  import { repoStore } from "$lib/stores/repo.svelte";
  import { toast } from "$lib/ui/toast.svelte";
  import GitDialogFrame from "../GitDialogFrame.svelte";
  import { gitDialogs } from "../gitDialogs.svelte";
  import { validateRemoteUrl } from "../gitOptions";
  import { defaultSubmodulePath, validateSubmodulePath } from "./submoduleModel";

  interface Props {
    repoRoot: string;
  }

  let { repoRoot }: Props = $props();

  let url = $state("");
  let submodulePath = $state("");
  let pathEdited = $state(false);
  let branchName = $state("");
  let existingPaths = $state.raw<string[]>([]);
  let adding = $state(false);
  let addError = $state<string | null>(null);

  const repoName = $derived(repoStore.repos.find((repo) => repo.root === repoRoot)?.name ?? "repository");
  const urlError = $derived(validateRemoteUrl(url));
  const pathError = $derived(validateSubmodulePath(submodulePath, existingPaths));
  const branchError = $derived(branchName.trim().startsWith("-") ? "Not a valid branch name" : null);
  const canAdd = $derived(!adding && urlError === null && pathError === null && branchError === null && repoStore.busy === null);

  onMount(() => {
    void api
      .listSubmodules(repoRoot)
      .then((list) => {
        existingPaths = list.map((submodule) => submodule.path);
      })
      .catch(() => undefined);
  });

  function onUrlInput(): void {
    if (!pathEdited) {
      submodulePath = defaultSubmodulePath(url);
    }
  }

  function close(): void {
    if (!adding) {
      gitDialogs.close();
    }
  }

  async function submit(): Promise<void> {
    if (!canAdd) {
      return;
    }
    adding = true;
    addError = null;
    const path = submodulePath.trim().replace(/\/+$/, "");
    try {
      await api.addSubmodule(repoRoot, url.trim(), path, branchName.trim() || null);
    } catch (error) {
      addError = errorMessage(error);
      adding = false;
      return;
    }
    adding = false;
    gitDialogs.close();
    toast.success(`Added submodule ${path}`, "Commit .gitmodules and the submodule to record it.");
    await repoStore.rediscover();
  }
</script>

<GitDialogFrame title="Add Submodule to {repoName}" width={560} closable={!adding} onCancel={close} onSubmit={() => void submit()}>
  <label class="field">
    <span>Repository URL</span>
    <input
      class="input mono"
      bind:value={url}
      oninput={onUrlInput}
      disabled={adding}
      spellcheck="false"
      autocomplete="off"
      placeholder="https://github.com/owner/library.git"
      data-autofocus
    />
  </label>
  {#if urlError && url !== ""}
    <div class="error">{urlError}</div>
  {/if}
  <label class="field">
    <span>Path in this repository</span>
    <input
      class="input mono"
      bind:value={submodulePath}
      oninput={() => (pathEdited = submodulePath.trim() !== "")}
      disabled={adding}
      spellcheck="false"
      autocomplete="off"
      placeholder="libs/library"
    />
  </label>
  {#if pathError && submodulePath !== ""}
    <div class="error">{pathError}</div>
  {/if}
  <label class="field">
    <span>Branch to follow (optional)</span>
    <input class="input mono" bind:value={branchName} disabled={adding} spellcheck="false" autocomplete="off" placeholder="main" />
  </label>
  {#if branchError}
    <div class="error">{branchError}</div>
  {/if}
  {#if adding}
    <div class="row hint" role="status"><span class="spinner" aria-hidden="true"></span>Cloning the submodule...</div>
  {/if}
  {#if addError}
    <div class="error selectable">{addError}</div>
  {/if}

  {#snippet footer()}
    <button type="button" class="btn" onclick={close} disabled={adding}>Cancel</button>
    <button type="button" class="btn primary" disabled={!canAdd} onclick={() => void submit()}>
      {adding ? "Adding..." : "Add"}
    </button>
  {/snippet}
</GitDialogFrame>
