<script lang="ts">
  // The repository row actions: branch, Sync, Commit, Refresh and "...".
  import { repoStore } from "$lib/stores/repo.svelte";
  import IconButton from "@git-manager/ui/components/IconButton.svelte";
  import Stack from "@git-manager/ui/components/Stack.svelte";
  import Text from "@git-manager/ui/components/Text.svelte";
  import { contextMenu } from "$lib/ui/menu.svelte";
  import { commitDraft } from "./commitDraft.svelte";
  import { branchDecorations, branchTooltip, commitButtonTooltip, commitPlan } from "./repoMenu";
  import { commitFromRow, openBranchPicker, refreshRepoRow, repoMenuFor, stateOf, syncFromRow } from "./repoActions";
  import { branchLabel, type RepoSection } from "./sections";
  import { rowSync, rowSyncBadge, rowSyncTooltip } from "./sync";

  interface Props {
    section: RepoSection;
    /** Show the Commit (check) button; clean repositories leave it out. */
    showCommit?: boolean;
  }

  let { section, showCommit = true }: Props = $props();

  const repoRoot = $derived(section.repo.root);
  const head = $derived(section.status?.head ?? null);
  const busy = $derived(repoStore.busy !== null);
  const branchText = $derived(branchLabel(head));
  const decorations = $derived(branchDecorations(section));
  const sync = $derived(rowSync(head));
  const syncBadge = $derived(rowSyncBadge(sync));
  // Clean rows have no Commit button, so they do not create a draft.
  const plan = $derived.by(() => {
    if (!showCommit) {
      return null;
    }
    const draft = commitDraft.for(repoRoot);
    return commitPlan(stateOf(section), { message: draft.isBlank() ? "" : draft.message, amend: draft.amend });
  });
  let refreshing = $state(false);

  async function refresh(): Promise<void> {
    refreshing = true;
    try {
      await refreshRepoRow(repoRoot);
    } finally {
      refreshing = false;
    }
  }

  async function openMore(event: MouseEvent): Promise<void> {
    const anchor = event.currentTarget as HTMLElement;
    // A click from Enter or Space has no pointer position (detail 0).
    const keyboard = event.detail === 0;
    const items = await repoMenuFor(repoRoot);
    if (items.length > 0 && anchor.isConnected) {
      contextMenu.openBelow(anchor, items, { keyboard, alignEnd: true });
    }
  }
</script>

<Stack direction="row" align="center" gap="none" shrink="first">
  {#if section.status}
    <IconButton
      icon="branch"
      iconSize="compact"
      size="row"
      onclick={() => void openBranchPicker(repoRoot)}
      disabled={busy}
      title={branchTooltip(branchText, section, head?.upstream ?? null)}
      label="Checkout branch or tag, current {branchText}{decorations}"
    >
      <Text size="small" truncate giveWay hideAt="narrow" tone={head?.branch ? "default" : "dim"}>
        {branchText}
      </Text>
      {#if decorations}<Text size="small" weight="semibold">{decorations}</Text>{/if}
    </IconButton>
  {/if}
  {#if sync.kind !== "hidden"}
    <Stack direction="row" hideAt="tiny">
      <IconButton
        icon={sync.kind === "publish" ? "cloud-upload" : "sync"}
        iconSize="medium"
        size="row"
        count={syncBadge ?? ""}
        onclick={() => void syncFromRow(repoRoot)}
        disabled={busy || (section.status?.op?.kind ?? "none") !== "none"}
        title={rowSyncTooltip(sync)}
        label={sync.kind === "publish" ? "Publish Branch" : rowSyncTooltip(sync)}
      />
    </Stack>
  {/if}
  {#if plan}
    <IconButton
      icon="check"
      iconSize="normal"
      size="row"
      onclick={() => void commitFromRow(repoRoot)}
      disabled={busy || plan.kind === "blocked"}
      title={commitButtonTooltip(plan)}
      label="Commit"
    />
  {/if}
  <IconButton
    icon="refresh"
    iconSize="medium"
    size="row"
    spinning={refreshing}
    onclick={() => void refresh()}
    title="Refresh"
    label="Refresh {section.repo.name}"
  />
  <IconButton
    icon="more"
    iconSize="normal"
    size="row"
    onclick={(event) => void openMore(event)}
    title="More Actions..."
    label="More actions for {section.repo.name}"
    aria-haspopup="menu"
  />
</Stack>
