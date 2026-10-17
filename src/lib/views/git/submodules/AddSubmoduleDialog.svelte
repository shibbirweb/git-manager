<!-- Add Submodule: the repository URL, the path inside this repository (from the URL until
     edited) and an optional branch to follow. Runs `git submodule add`. -->
<script lang="ts">
  import Button from "@nibtree/ui/components/Button.svelte";
  import Dialog from "@nibtree/ui/components/Dialog.svelte";
  import Field from "@nibtree/ui/components/Field.svelte";
  import Input from "@nibtree/ui/components/Input.svelte";
  import Spinner from "@nibtree/ui/components/Spinner.svelte";
  import Stack from "@nibtree/ui/components/Stack.svelte";
  import Text from "@nibtree/ui/components/Text.svelte";
  import { onMount } from "svelte";
  import { api, errorMessage } from "$lib/api";
  import { repoStore } from "$lib/stores/repo.svelte";
  import { toast } from "$lib/ui/toast.svelte";
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
  const canAdd = $derived(
    !adding && urlError === null && pathError === null && branchError === null && repoStore.busy === null,
  );

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

<Dialog
  open
  variant="form"
  title="Add Submodule to {repoName}"
  width="medium"
  dismissible={!adding}
  onclose={close}
  onsubmit={() => void submit()}
>
  <Field label="Repository URL" look="compact" error={urlError && url !== "" ? urlError : null}>
    <Input
      mono
      width="fill"
      bind:value={url}
      oninput={onUrlInput}
      disabled={adding}
      spellcheck="false"
      autocomplete="off"
      placeholder="https://github.com/owner/library.git"
      autofocus
    />
  </Field>
  <Field label="Path in this repository" look="compact" error={pathError && submodulePath !== "" ? pathError : null}>
    <Input
      mono
      width="fill"
      bind:value={submodulePath}
      oninput={() => (pathEdited = submodulePath.trim() !== "")}
      disabled={adding}
      spellcheck="false"
      autocomplete="off"
      placeholder="libs/library"
    />
  </Field>
  <Field label="Branch to follow (optional)" look="compact" error={branchError || null}>
    <Input
      mono
      width="fill"
      bind:value={branchName}
      disabled={adding}
      spellcheck="false"
      autocomplete="off"
      placeholder="main"
    />
  </Field>
  {#if adding}
    <Stack direction="row" align="center" gap="md" role="status">
      <Spinner size="small" label="Cloning" />
      <Text variant="hint" tone="faint">Cloning the submodule...</Text>
    </Stack>
  {/if}
  {#if addError}
    <Text size="small" tone="danger" selectable>{addError}</Text>
  {/if}

  {#snippet actions()}
    <Button onclick={close} disabled={adding}>Cancel</Button>
    <Button variant="primary" disabled={!canAdd} onclick={() => void submit()}>
      {adding ? "Adding..." : "Add"}
    </Button>
  {/snippet}
</Dialog>
