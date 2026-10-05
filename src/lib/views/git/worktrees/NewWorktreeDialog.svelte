<!-- New Worktree: an existing branch, or a new branch from a base; the folder (next to the
     repository by default, following the branch until edited); then open it here or add
     it to the workspace. -->
<script lang="ts">
  import { open } from "@tauri-apps/plugin-dialog";
  import { onMount, untrack } from "svelte";
  import { api, errorMessage } from "$lib/api";
  import { repoStore } from "$lib/stores/repo.svelte";
  import { baseName, fromNativePath, joinPath } from "$lib/stores/workspacePaths";
  import type { Refs, WorktreeBranch, WorktreeInfo } from "$lib/types";
  import { toast } from "$lib/ui/toast.svelte";
  import { repoTarget, validateBranchName } from "../../sidebar/actions";
  import GitDialogFrame from "../GitDialogFrame.svelte";
  import { gitDialogs } from "../gitDialogs.svelte";
  import { availableBranches, defaultWorktreePath, mainWorktreeRoot, validateWorktreePath } from "./worktreeModel";
  import { worktreeStore } from "./worktreeStore.svelte";

  interface Props {
    repoRoot: string;
  }

  let { repoRoot }: Props = $props();

  let refs = $state.raw<Refs | null>(untrack(() => (repoRoot === repoStore.repo?.root ? repoStore.refs : null)));
  let worktrees = $state.raw<WorktreeInfo[]>([]);
  let mode = $state<"existing" | "new">("new");
  let existingBranch = $state("");
  let newBranch = $state("");
  let baseRef = $state(untrack(() => repoStore.statuses[repoRoot]?.head.branch ?? "HEAD"));
  let folder = $state("");
  /** The folder follows the branch until the user edits it. */
  let folderEdited = $state(false);
  let afterCreate = $state<"open" | "add" | "none">("none");
  let creating = $state(false);
  let createError = $state<string | null>(null);

  const mainRoot = $derived(mainWorktreeRoot(worktrees, repoRoot));
  const localNames = $derived((refs?.local ?? []).map((branch) => branch.name));
  const checkoutable = $derived(availableBranches(localNames, worktrees));
  const baseChoices = $derived(["HEAD", ...localNames, ...(refs?.remote ?? []).map((branch) => branch.name)]);
  const branchName = $derived(mode === "existing" ? existingBranch : newBranch.trim());
  const branchError = $derived(
    mode === "existing"
      ? existingBranch === ""
        ? "Choose a branch"
        : null
      : newBranch.trim() === ""
        ? "Enter a branch name"
        : validateBranchName(newBranch.trim(), null, repoTarget(repoRoot, refs)),
  );
  const folderError = $derived(validateWorktreePath(folder, worktrees));
  const canCreate = $derived(!creating && branchError === null && folderError === null && repoStore.busy === null);

  onMount(() => {
    void Promise.all([
      refs ? Promise.resolve(refs) : api.getRefs(repoRoot).catch(() => null),
      worktreeStore.listFor(repoRoot),
    ]).then(([loadedRefs, loadedWorktrees]) => {
      refs = loadedRefs;
      worktrees = loadedWorktrees;
      if (existingBranch === "") {
        existingBranch = availableBranches(
          (loadedRefs?.local ?? []).map((branch) => branch.name),
          loadedWorktrees,
        )[0] ?? "";
      }
      if (!folderEdited) {
        folder = defaultWorktreePath(mainWorktreeRoot(loadedWorktrees, repoRoot), branchName);
      }
    });
  });

  // The default folder follows the branch.
  $effect(() => {
    const next = defaultWorktreePath(mainRoot, branchName);
    untrack(() => {
      if (!folderEdited) {
        folder = next;
      }
    });
  });

  async function browse(): Promise<void> {
    const chosen = await open({ directory: true, multiple: false, title: "Worktree Location", defaultPath: mainRoot });
    if (typeof chosen === "string" && chosen) {
      // The picked folder holds the new worktree folder.
      folder = joinPath(fromNativePath(chosen).replace(/\/+$/, ""), baseName(defaultWorktreePath(mainRoot, branchName)));
      folderEdited = true;
    }
  }

  function close(): void {
    if (!creating) {
      gitDialogs.close();
    }
  }

  function branchSpec(): WorktreeBranch {
    return mode === "existing"
      ? { kind: "existing", branchName: existingBranch }
      : { kind: "new", branchName: newBranch.trim(), baseRef };
  }

  async function submit(): Promise<void> {
    if (!canCreate) {
      return;
    }
    creating = true;
    createError = null;
    let created: string;
    try {
      created = await api.addWorktree(repoRoot, folder.trim().replace(/\/+$/, ""), branchSpec());
    } catch (error) {
      createError = errorMessage(error);
      creating = false;
      return;
    }
    creating = false;
    gitDialogs.close();
    await repoStore.refreshRepo(repoRoot, true);
    await worktreeStore.load(repoStore.repo?.root ?? null);
    if (afterCreate === "open") {
      await repoStore.open(created);
    } else if (afterCreate === "add") {
      await repoStore.addFolder(created);
    } else {
      toast.success(`Created worktree ${baseName(created)}`, created);
    }
  }
</script>

<GitDialogFrame title="New Worktree" width={560} closable={!creating} onCancel={close} onSubmit={() => void submit()}>
  <fieldset class="modes">
    <label class="check">
      <input type="radio" name="worktree-branch" value="new" bind:group={mode} disabled={creating} />
      New branch
    </label>
    <label class="check">
      <input type="radio" name="worktree-branch" value="existing" bind:group={mode} disabled={creating || checkoutable.length === 0} />
      Existing branch
    </label>
  </fieldset>

  {#if mode === "new"}
    <div class="row">
      <label class="field grow">
        <span>Branch name</span>
        <input
          class="input mono"
          bind:value={newBranch}
          disabled={creating}
          spellcheck="false"
          autocomplete="off"
          placeholder="feature/my-change"
          data-autofocus
        />
      </label>
      <label class="field base">
        <span>From</span>
        <select class="input" bind:value={baseRef} disabled={creating}>
          {#each baseChoices as choice (choice)}
            <option value={choice}>{choice}</option>
          {/each}
        </select>
      </label>
    </div>
  {:else}
    <label class="field">
      <span>Branch</span>
      <select class="input" bind:value={existingBranch} disabled={creating}>
        {#each checkoutable as choice (choice)}
          <option value={choice}>{choice}</option>
        {/each}
      </select>
    </label>
    <div class="hint">Branches checked out in another worktree are not listed.</div>
  {/if}
  {#if branchError && (mode === "existing" || newBranch !== "")}
    <div class="error">{branchError}</div>
  {/if}

  <label class="field">
    <span>Folder</span>
    <div class="row">
      <input
        class="input grow mono"
        bind:value={folder}
        oninput={() => (folderEdited = true)}
        disabled={creating}
        spellcheck="false"
        autocomplete="off"
        aria-label="Folder"
      />
      <button type="button" class="btn" onclick={() => void browse()} disabled={creating}>Browse...</button>
    </div>
  </label>
  {#if folderError && folder !== ""}
    <div class="error">{folderError}</div>
  {/if}

  <label class="check">
    <input
      type="checkbox"
      checked={afterCreate === "open"}
      onchange={(event) => (afterCreate = event.currentTarget.checked ? "open" : "none")}
      disabled={creating}
    />
    Open in this window
  </label>
  <label class="check">
    <input
      type="checkbox"
      checked={afterCreate === "add"}
      onchange={(event) => (afterCreate = event.currentTarget.checked ? "add" : "none")}
      disabled={creating || repoStore.workspace === null}
    />
    Add to workspace
  </label>

  {#if creating}
    <div class="row hint" role="status"><span class="spinner" aria-hidden="true"></span>Creating the worktree...</div>
  {/if}
  {#if createError}
    <div class="error selectable">{createError}</div>
  {/if}

  {#snippet footer()}
    <button type="button" class="btn" onclick={close} disabled={creating}>Cancel</button>
    <button type="button" class="btn primary" disabled={!canCreate} onclick={() => void submit()}>
      {creating ? "Creating..." : "Create"}
    </button>
  {/snippet}
</GitDialogFrame>

<style>
  .modes {
    display: flex;
    gap: 16px;
    margin: 0;
    padding: 0;
    border: none;
  }

  .grow {
    flex: 1;
    min-width: 0;
  }

  .base {
    width: 190px;
  }
</style>
