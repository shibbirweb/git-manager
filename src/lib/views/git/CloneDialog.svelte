<!-- Clone: the repository URL, the parent folder and the new folder's name (from the URL
     until edited). Streams git's progress; when done, opens the clone or adds it to the workspace. -->
<script lang="ts">
  import { Channel } from "@tauri-apps/api/core";
  import { homeDir } from "@tauri-apps/api/path";
  import { open } from "@tauri-apps/plugin-dialog";
  import { onMount } from "svelte";
  import { api, errorMessage } from "$lib/api";
  import { repoStore } from "$lib/stores/repo.svelte";
  import { fromNativePath, joinPath, parentOf } from "$lib/stores/workspacePaths";
  import { dialogs } from "$lib/ui/dialog.svelte";
  import { toast } from "$lib/ui/toast.svelte";
  import GitDialogFrame from "./GitDialogFrame.svelte";
  import { gitDialogs } from "./gitDialogs.svelte";
  import { CLONE_CANCELLED, cloneFolderName, validateFolderName, validateRemoteUrl } from "./gitOptions";

  let url = $state("");
  let parentDir = $state("");
  let folderName = $state("");
  /** The folder name follows the URL until the user types one. */
  let folderEdited = $state(false);
  let cloning = $state(false);
  let progressLine = $state("");
  let cloneError = $state<string | null>(null);
  /** "Clone cancelled" after Cancel stopped git. */
  let cloneNotice = $state<string | null>(null);
  /** Lets Cancel stop this clone's git process. */
  let cancelId = $state<string | null>(null);
  let cancelling = $state(false);

  const urlError = $derived(validateRemoteUrl(url));
  const folderError = $derived(validateFolderName(folderName));
  const canClone = $derived(!cloning && urlError === null && folderError === null && parentDir.trim() !== "");
  const targetPath = $derived(parentDir.trim() && folderName.trim() ? joinPath(parentDir.trim().replace(/\/+$/, ""), folderName.trim()) : "");

  onMount(() => {
    // Next to the open folder, else in the home folder.
    const workspaceRoot = repoStore.workspace?.root ?? null;
    if (workspaceRoot) {
      parentDir = parentOf(workspaceRoot);
    } else {
      void homeDir()
        .then((home) => {
          if (!parentDir) {
            parentDir = home.replace(/\/+$/, "");
          }
        })
        .catch(() => undefined);
    }
  });

  function onUrlInput(): void {
    if (!folderEdited) {
      folderName = cloneFolderName(url);
    }
  }

  async function browse(): Promise<void> {
    const chosen = await open({ directory: true, multiple: false, title: "Clone Into", defaultPath: parentDir || undefined });
    if (typeof chosen === "string" && chosen) {
      parentDir = fromNativePath(chosen);
    }
  }

  /** Stops git; the clone then fails with "Clone cancelled" and its new folder is removed. */
  async function cancelClone(): Promise<void> {
    if (!cancelId || cancelling) {
      return;
    }
    cancelling = true;
    progressLine = "Cancelling...";
    try {
      await api.cancelGitCommand(cancelId);
    } catch (error) {
      cancelling = false;
      cloneError = errorMessage(error);
    }
  }

  function close(): void {
    if (!cloning) {
      gitDialogs.close();
    }
  }

  async function submit(): Promise<void> {
    if (!canClone) {
      return;
    }
    cloning = true;
    cloneError = null;
    cloneNotice = null;
    cancelling = false;
    const thisClone = `clone-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    cancelId = thisClone;
    progressLine = "Starting...";
    const progress = new Channel<string>();
    progress.onmessage = (line) => {
      progressLine = line;
    };
    let clonedPath: string;
    try {
      clonedPath = await api.cloneRepository(url.trim(), parentDir.trim(), folderName.trim(), progress, thisClone);
    } catch (error) {
      const message = errorMessage(error);
      if (cancelling && message === CLONE_CANCELLED) {
        cloneNotice = message;
      } else {
        cloneError = message;
      }
      cloning = false;
      cancelId = null;
      return;
    }
    cloning = false;
    cancelId = null;
    gitDialogs.close();
    await offerToOpen(clonedPath);
  }

  async function offerToOpen(clonedPath: string): Promise<void> {
    const name = clonedPath.slice(clonedPath.lastIndexOf("/") + 1);
    const hasWorkspace = repoStore.workspace !== null;
    const choice = await dialogs.choose<"open" | "add" | "later">({
      title: `Cloned ${name}`,
      message: clonedPath,
      options: [
        { value: "open", label: "Open in This Window", description: hasWorkspace ? "Replaces the open folder" : undefined },
        ...(hasWorkspace ? [{ value: "add" as const, label: "Add to Workspace", description: "Keeps the open folders" }] : []),
        { value: "later", label: "Not Now" },
      ],
    });
    if (choice === "open") {
      await repoStore.open(clonedPath);
    } else if (choice === "add") {
      await repoStore.addFolder(clonedPath);
    } else {
      toast.success(`Cloned ${name}`, clonedPath);
    }
  }
</script>

<GitDialogFrame title="Clone Repository" width={580} closable={!cloning} onCancel={close} onSubmit={() => void submit()}>
  <label class="field">
    <span>Repository URL</span>
    <input
      class="input mono"
      bind:value={url}
      oninput={onUrlInput}
      disabled={cloning}
      spellcheck="false"
      autocomplete="off"
      placeholder="https://github.com/owner/repo.git or git@github.com:owner/repo.git"
      data-autofocus
    />
  </label>
  {#if urlError && url !== ""}
    <div class="error">{urlError}</div>
  {/if}
  <label class="field">
    <span>Clone into folder</span>
    <div class="row">
      <input
        class="input parent"
        bind:value={parentDir}
        disabled={cloning}
        spellcheck="false"
        autocomplete="off"
        aria-label="Clone into folder"
      />
      <button type="button" class="btn" onclick={() => void browse()} disabled={cloning}>Browse...</button>
    </div>
  </label>
  <label class="field">
    <span>Folder name</span>
    <input
      class="input"
      bind:value={folderName}
      oninput={() => (folderEdited = folderName.trim() !== "")}
      disabled={cloning}
      spellcheck="false"
      autocomplete="off"
    />
  </label>
  {#if folderError && folderName !== ""}
    <div class="error">{folderError}</div>
  {:else if targetPath}
    <div class="hint selectable">{targetPath}</div>
  {/if}
  {#if cloning}
    <div class="progress row" role="status">
      <span class="spinner" aria-hidden="true"></span>
      <span class="truncate mono">{progressLine}</span>
    </div>
  {/if}
  {#if cloneNotice}
    <div class="hint" role="status">{cloneNotice}</div>
  {/if}
  {#if cloneError}
    <div class="error selectable">{cloneError}</div>
  {/if}

  {#snippet footer()}
    {#if cloning}
      <button type="button" class="btn" onclick={() => void cancelClone()} disabled={cancelling}>
        {cancelling ? "Cancelling..." : "Cancel"}
      </button>
    {:else}
      <button type="button" class="btn" onclick={close}>Cancel</button>
    {/if}
    <button type="button" class="btn primary" disabled={!canClone} onclick={() => void submit()}>
      {cloning ? "Cloning..." : "Clone"}
    </button>
  {/snippet}
</GitDialogFrame>

<style>
  .parent {
    flex: 1;
    min-width: 0;
  }

  .progress {
    font-size: 12px;
    color: var(--text-dim);
    min-width: 0;
  }
</style>
