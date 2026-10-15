<script lang="ts">
  import { localKeys } from "$lib/commands/commandRuntime";
  import { api, errorMessage } from "$lib/api";
  import { repoStore } from "$lib/stores/repo.svelte";
  import type { RepoInfo } from "$lib/types";
  import Button from "@git-manager/ui/components/Button.svelte";
  import Checkbox from "@git-manager/ui/components/Checkbox.svelte";
  import Icon from "@git-manager/ui/components/Icon.svelte";
  import Select from "@git-manager/ui/components/Select.svelte";
  import SplitButton from "@git-manager/ui/components/SplitButton.svelte";
  import Stack from "@git-manager/ui/components/Stack.svelte";
  import Text from "@git-manager/ui/components/Text.svelte";
  import { toast } from "$lib/ui/toast.svelte";
  import { syncRepo } from "../gitActions";
  import { commitDraft } from "./commitDraft.svelte";
  import CommitMessageField from "./CommitMessageField.svelte";
  import CommitOptionsPopover from "./CommitOptionsPopover.svelte";
  import { commitRepo } from "./repoActions";
  import { type CommitChoice, commitChoiceSpec, commitDropdownItems } from "./repoMenu";
  import { syncPlan, syncTooltip } from "./sync";
  import { branchLabel, showRelativePath, type RepoSection } from "./sections";

  interface Props {
    /** Repository the commit goes to. */
    repo: RepoInfo;
    stagedCount: number;
    conflictCount: number;
    /** Several repositories are open: show the target and its picker. */
    multiRepo: boolean;
    /** Repositories offered by the picker. */
    choices: RepoSection[];
    onpick: (repoRoot: string) => void;
    /**
     * Under the file list (the single commit box), above it, or at the top of a repository's
     * section (one box per repository): no picker, a smaller message and no sync button, since
     * the section's header has the push and pull buttons.
     */
    placement?: "bottom" | "top" | "section";
  }

  let { repo, stagedCount, conflictCount, multiRepo, choices, onpick, placement = "bottom" }: Props = $props();

  /** Repository whose HEAD message is being loaded for amend. */
  let loadingRoot = $state<string | null>(null);

  const commitKeys = localKeys("CmdOrCtrl+Enter");
  const draft = $derived(commitDraft.for(repo.root));
  const status = $derived(repoStore.statuses[repo.root] ?? null);
  const unborn = $derived(status?.head?.unborn ?? false);
  const branch = $derived(branchLabel(status?.head));
  const busy = $derived(repoStore.busy !== null);
  const loadingMessage = $derived(loadingRoot === repo.root);
  const hasMessage = $derived(!draft.isBlank());
  const inSection = $derived(placement === "section");
  const placeholder = $derived.by(() => {
    if (draft.templateHint) {
      return draft.templateHint;
    }
    if (inSection) {
      return branch ? `Message (${commitKeys} to commit on ${branch})` : `Message (${commitKeys} to commit)`;
    }
    return multiRepo ? `Message for ${repo.name}` : "Commit message";
  });
  const disabledReason = $derived.by(() => {
    if (conflictCount > 0) {
      return "Resolve conflicts before committing";
    }
    if (!draft.amend && stagedCount === 0) {
      return "Stage changes to commit";
    }
    if (!draft.amend && !hasMessage) {
      return "Enter a commit message";
    }
    return null;
  });
  const canCommit = $derived(disabledReason === null && !busy && !loadingMessage);
  const summary = $derived.by(() => {
    if (conflictCount > 0) {
      return conflictCount === 1 ? "1 conflicted file" : `${conflictCount} conflicted files`;
    }
    if (stagedCount === 0) {
      return draft.amend ? "Amend message only" : "Nothing staged";
    }
    return stagedCount === 1 ? "1 file staged" : `${stagedCount} files staged`;
  });
  const operation = $derived((status?.op?.kind ?? "none") !== "none");
  const canAmend = $derived(!unborn && conflictCount === 0 && !operation && !loadingMessage);
  const sync = $derived(syncPlan(status?.head));
  const commitHint = $derived(multiRepo ? `Commit to ${repo.name} (${commitKeys})` : `Commit (${commitKeys})`);

  const commitItems = $derived(
    commitDropdownItems(
      { busy, canCommit, canAmend, canPush: !!status?.head?.branch && !unborn, amendChecked: draft.amend },
      runChoice,
    ),
  );
  const pickerOptions = $derived(choices.map((choice) => ({ value: choice.repo.root, label: choiceLabel(choice) })));

  function choiceLabel(choice: RepoSection): string {
    const name = showRelativePath(choice.repo) ? `${choice.repo.name} (${choice.repo.relativePath})` : choice.repo.name;
    const staged = choice.staged.length;
    return staged > 0 ? `${name}, ${staged} staged` : name;
  }

  async function toggleAmend(checked: boolean): Promise<void> {
    const target = draft;
    const repoRoot = repo.root;
    target.amend = checked;
    if (!checked) {
      if (target.prefilled !== null && target.message === target.prefilled) {
        target.message = target.template ?? "";
      }
      target.prefilled = null;
      return;
    }
    if (!target.isBlank()) {
      return;
    }
    loadingRoot = repoRoot;
    try {
      const headMessage = (await api.getHeadMessage(repoRoot)).trimEnd();
      if (target.amend && target.isBlank()) {
        target.message = headMessage;
        target.prefilled = headMessage;
      }
    } catch (error) {
      toast.error("Could not read the last commit message", errorMessage(error));
    } finally {
      if (loadingRoot === repoRoot) {
        loadingRoot = null;
      }
    }
  }

  async function commit(): Promise<void> {
    if (!canCommit) {
      return;
    }
    await commitRepo(repo.root, { mode: "staged", amend: draft.amend, followUp: "none" });
  }

  /** The dropdown: Commit, Commit & Push, Commit & Sync, Commit (Amend). */
  function runChoice(choice: CommitChoice): void {
    const spec = commitChoiceSpec(choice);
    if (choice !== "amend" && !canCommit) {
      return;
    }
    const amend = spec.amend || draft.amend;
    void commitRepo(repo.root, { mode: "staged", amend, followUp: spec.followUp });
  }
</script>

<Stack
  role="group"
  label="Commit box"
  gap={inSection ? "sm" : "md"}
  paddingX="mdPlus"
  paddingY={inSection ? "xs" : "mdPlus"}
  surface={inSection ? "none" : "panel"}
  line={inSection ? "none" : placement === "top" ? "bottom" : "top"}
>
  {#if multiRepo && !inSection}
    <Stack direction="row" align="center" gap="sm">
      <Text size="small" tone="dim">Commit to</Text>
      {#if choices.length > 1}
        <Select
          options={pickerOptions}
          value={repo.root}
          size="small"
          label="Repository to commit to"
          title={repo.root}
          onchange={(repoRoot) => onpick(repoRoot)}
        />
      {:else}
        <Text weight="semibold" truncate title={repo.root}>{repo.name}</Text>
      {/if}
      {#if branch}
        <Text size="small" tone="dim" truncate>on {branch}</Text>
      {/if}
    </Stack>
  {/if}
  <CommitMessageField repoRoot={repo.root} {placeholder} compact={inSection} oncommit={() => void commit()} />
  <Stack direction="row" align="center" gap="mdPlus">
    <Checkbox
      label="Amend"
      checked={draft.amend}
      disabled={unborn || busy}
      title={unborn ? "There is no commit to amend yet" : "Amend the last commit"}
      onchange={(checked) => void toggleAmend(checked)}
    />
    <Stack grow>
      <Text size="small" tone="dim" truncate>{summary}</Text>
    </Stack>
    <CommitOptionsPopover repoRoot={repo.root} disabled={busy} />
    <SplitButton
      text={draft.amend ? "Amend Commit" : "Commit"}
      items={commitItems}
      menuLabel="More commit actions"
      disabled={busy}
      actionDisabled={!canCommit}
      title={disabledReason ?? commitHint}
      onclick={() => void commit()}
    />
  </Stack>
  {#if sync.kind !== "none" && !inSection}
    <!-- Sync Changes: pull, then push; or publish a branch that has no upstream yet. -->
    <Button
      width="fill"
      icon={sync.kind === "publish" ? "cloud-upload" : "sync"}
      onclick={() => void syncRepo(repo.root)}
      disabled={busy}
      title={syncTooltip(sync)}
    >
      {#if sync.kind === "publish"}
        Publish Branch
      {:else}
        Sync Changes
        <Stack direction="row" align="center" gap="sm" element="span">
          {#if sync.pull > 0}
            <Stack direction="row" align="center" gap="none" element="span" label="{sync.pull} to pull">
              <Text tabular>{sync.pull}</Text><Icon name="arrow-down" size="small" />
            </Stack>
          {/if}
          {#if sync.push > 0}
            <Stack direction="row" align="center" gap="none" element="span" label="{sync.push} to push">
              <Text tabular>{sync.push}</Text><Icon name="arrow-up" size="small" />
            </Stack>
          {/if}
        </Stack>
      {/if}
    </Button>
  {/if}
</Stack>
