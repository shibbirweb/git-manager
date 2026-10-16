<!-- Clone: the repository URL, the parent folder and the new folder's name (from the URL
     until edited). Streams git's progress; when done, opens the clone or adds it to the workspace. -->
<script lang="ts">
  import Button from "@git-manager/ui/components/Button.svelte";
  import Dialog from "@git-manager/ui/components/Dialog.svelte";
  import Field from "@git-manager/ui/components/Field.svelte";
  import Input from "@git-manager/ui/components/Input.svelte";
  import Spinner from "@git-manager/ui/components/Spinner.svelte";
  import Stack from "@git-manager/ui/components/Stack.svelte";
  import Text from "@git-manager/ui/components/Text.svelte";
  import { Channel } from "@tauri-apps/api/core";
  import { homeDir } from "@tauri-apps/api/path";
  import { open } from "@tauri-apps/plugin-dialog";
  import { onMount } from "svelte";
  import { api, errorMessage } from "$lib/api";
  import { repoStore } from "$lib/stores/repo.svelte";
  import { fromNativePath, joinPath, parentOf } from "$lib/stores/workspacePaths";
  import { dialogs } from "$lib/ui/dialog.svelte";
  import { toast } from "$lib/ui/toast.svelte";
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
  const targetPath = $derived(
    parentDir.trim() && folderName.trim() ? joinPath(parentDir.trim().replace(/\/+$/, ""), folderName.trim()) : "",
  );

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
    const chosen = await open({
      directory: true,
      multiple: false,
      title: "Clone Into",
      defaultPath: parentDir || undefined,
    });
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
        {
          value: "open",
          label: "Open in This Window",
          description: hasWorkspace ? "Replaces the open folder" : undefined,
        },
        ...(hasWorkspace
          ? [{ value: "add" as const, label: "Add to Workspace", description: "Keeps the open folders" }]
          : []),
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

<Dialog
  open
  variant="form"
  title="Clone Repository"
  width="medium"
  dismissible={!cloning}
  onclose={close}
  onsubmit={() => void submit()}
>
  <Field label="Repository URL" look="compact" error={urlError && url !== "" ? urlError : null}>
    <Input
      mono
      width="fill"
      bind:value={url}
      oninput={onUrlInput}
      disabled={cloning}
      spellcheck="false"
      autocomplete="off"
      placeholder="https://github.com/owner/repo.git or git@github.com:owner/repo.git"
      autofocus
    />
  </Field>
  <Field label="Clone into folder" look="compact">
    <Stack direction="row" align="center" gap="md">
      <Input
        width="fill"
        bind:value={parentDir}
        disabled={cloning}
        spellcheck="false"
        autocomplete="off"
        aria-label="Clone into folder"
      />
      <Button onclick={() => void browse()} disabled={cloning}>Browse...</Button>
    </Stack>
  </Field>
  <Field label="Folder name" look="compact" error={folderError && folderName !== "" ? folderError : null}>
    <Input
      width="fill"
      bind:value={folderName}
      oninput={() => (folderEdited = folderName.trim() !== "")}
      disabled={cloning}
      spellcheck="false"
      autocomplete="off"
    />
  </Field>
  {#if !(folderError && folderName !== "") && targetPath}
    <Text variant="hint" tone="faint" selectable>{targetPath}</Text>
  {/if}
  {#if cloning}
    <Stack direction="row" align="center" gap="md" role="status">
      <Spinner size="small" label="Cloning" />
      <Text size="small" tone="dim" mono truncate>{progressLine}</Text>
    </Stack>
  {/if}
  {#if cloneNotice}
    <Stack role="status"><Text variant="hint" tone="faint">{cloneNotice}</Text></Stack>
  {/if}
  {#if cloneError}
    <Text size="small" tone="danger" selectable>{cloneError}</Text>
  {/if}

  {#snippet actions()}
    {#if cloning}
      <Button onclick={() => void cancelClone()} disabled={cancelling}>
        {cancelling ? "Cancelling..." : "Cancel"}
      </Button>
    {:else}
      <Button onclick={close}>Cancel</Button>
    {/if}
    <Button variant="primary" disabled={!canClone} onclick={() => void submit()}>
      {cloning ? "Cloning..." : "Clone"}
    </Button>
  {/snippet}
</Dialog>
