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
  import Button from "@git-manager/ui/components/Button.svelte";
  import Input from "@git-manager/ui/components/Input.svelte";
  import Select from "@git-manager/ui/components/Select.svelte";
  import Spacer from "@git-manager/ui/components/Spacer.svelte";
  import Stack from "@git-manager/ui/components/Stack.svelte";
  import Text from "@git-manager/ui/components/Text.svelte";
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
      (globalName.trim() !== (globalIdentity.global.name ?? "") ||
        globalEmail.trim() !== (globalIdentity.global.email ?? "")),
  );
  const localChanged = $derived(
    repoIdentity !== null &&
      (localName.trim() !== (repoIdentity.local.name ?? "") || localEmail.trim() !== (repoIdentity.local.email ?? "")),
  );
  const hasLocal = $derived(
    repoIdentity !== null && (repoIdentity.local.name !== null || repoIdentity.local.email !== null),
  );
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

{#snippet field(label: string, placeholder: string, value: string, onvalue: (next: string) => void)}
  <Stack grow>
    <Input
      width="fill"
      {value}
      {placeholder}
      aria-label={label}
      autocomplete="off"
      spellcheck="false"
      oninput={(event) => onvalue(event.currentTarget.value)}
    />
  </Stack>
{/snippet}

<Stack gap="lg">
  {#if loadError}
    <Text size="small" tone="danger">{loadError}</Text>
  {/if}

  <Stack gap="sm" label="Global identity">
    <Stack direction="row" align="center" gap="md">
      <Text size="small" weight="semibold">Global</Text>
      {#if globalIdentity?.globalFile}
        <Text size="small" tone="faint" mono truncate title={globalIdentity.globalFile}
          >{globalIdentity.globalFile}</Text
        >
      {/if}
    </Stack>
    <Stack direction="row" gap="sm">
      {@render field("Global name", "Name", globalName, (next) => (globalName = next))}
      {@render field("Global email", "Email", globalEmail, (next) => (globalEmail = next))}
      <Button
        onclick={() => void saveGlobal()}
        disabled={!globalChanged || saving !== null || !!globalNameError || !!globalEmailError}
      >
        Save
      </Button>
    </Stack>
    {#if globalNameError || globalEmailError}
      <Text size="small" tone="danger">{globalNameError ?? globalEmailError}</Text>
    {/if}
  </Stack>

  {#if repoRoot !== null}
    <Stack gap="sm" label="Repository identity">
      <Stack direction="row" align="center" gap="md">
        <Text size="small" weight="semibold">Repository</Text>
        {#if repos.length > 1}
          <Select
            size="small"
            label="Repository"
            options={repos.map((repo) => ({ value: repo.root, label: repo.name }))}
            value={repoRoot}
            onchange={(root) => (repoRoot = root)}
          />
        {:else}
          <Text size="small" tone="faint" truncate title={repoRoot}>{repoName(repoRoot)}</Text>
        {/if}
      </Stack>
      <Stack direction="row" gap="sm">
        {@render field(
          "Repository name",
          repoIdentity?.global.name ? `${repoIdentity.global.name} (global)` : "Name",
          localName,
          (next) => (localName = next),
        )}
        {@render field(
          "Repository email",
          repoIdentity?.global.email ? `${repoIdentity.global.email} (global)` : "Email",
          localEmail,
          (next) => (localEmail = next),
        )}
        <Button
          onclick={() => void saveLocal()}
          disabled={!localChanged || saving !== null || !!localNameError || !!localEmailError}
        >
          Save
        </Button>
      </Stack>
      {#if localNameError || localEmailError}
        <Text size="small" tone="danger">{localNameError ?? localEmailError}</Text>
      {/if}
      <Stack direction="row" align="center" gap="md">
        {#if repoIdentity && !repoIdentity.complete}
          <Text size="small" tone="warning">git has no name and email here yet</Text>
        {:else if effective}
          <Text size="small" tone="dim" truncate>Commits use {effective}</Text>
        {/if}
        <Spacer />
        {#if hasLocal}
          <Button size="small" onclick={() => void useGlobal()} disabled={saving !== null}>Use Global</Button>
        {/if}
      </Stack>
    </Stack>
  {/if}
</Stack>
