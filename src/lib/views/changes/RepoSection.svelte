<script lang="ts">
  import { repoStore } from "$lib/stores/repo.svelte";
  import type { FileStatus } from "$lib/types";
  import Badge from "@git-manager/ui/components/Badge.svelte";
  import Button from "@git-manager/ui/components/Button.svelte";
  import Collapsible from "@git-manager/ui/components/Collapsible.svelte";
  import IconButton from "@git-manager/ui/components/IconButton.svelte";
  import Pill from "@git-manager/ui/components/Pill.svelte";
  import Row from "@git-manager/ui/components/Row.svelte";
  import Spacer from "@git-manager/ui/components/Spacer.svelte";
  import Stack from "@git-manager/ui/components/Stack.svelte";
  import Tag from "@git-manager/ui/components/Tag.svelte";
  import Text from "@git-manager/ui/components/Text.svelte";
  import { contextMenu, type MenuItem } from "$lib/ui/menu.svelte";
  import CommitBox from "./CommitBox.svelte";
  import FileRow from "./FileRow.svelte";
  import { kindIn, rowElementId, sameSelection, type FileSelection, type GroupId, type RowAction } from "./fileStatus";
  import { changesLayout } from "./layout.svelte";
  import { activate, copyText, discard, stage, unstage } from "./mutations";
  import RepoActions from "./RepoActions.svelte";
  import { repoMenuFor } from "./repoActions";
  import { ignoreMenu } from "$lib/ignore/ignoreActions";
  import { openShelveDialog } from "$lib/shelf/shelfActions.svelte";
  import { branchLabel, opLabel, showRelativePath, type RepoSection } from "./sections";
  import { lfsFileSet } from "../git/lfs/lfsModel";
  import { lfsStore } from "../git/lfs/lfsStore.svelte";
  import { submoduleEntryItems } from "../git/submodules/submoduleActions";
  import { describeSubmoduleChange, isSubmoduleEntry } from "../git/submodules/submoduleModel";

  interface Props {
    section: RepoSection;
    /** Several repositories are shown: render the repository header and indent the groups. */
    multiRepo: boolean;
    active: boolean;
    /** The selection when it belongs to this repository, else null. */
    selected: FileSelection | null;
    onselect: (selection: FileSelection) => void;
    /** Settings > Git > Commit box is Per repository: this section has its own commit box at the top. */
    commitBox?: boolean;
  }

  let { section, multiRepo, active, selected, onselect, commitBox = false }: Props = $props();

  const repo = $derived(section.repo);
  const repoRoot = $derived(section.repo.root);
  const head = $derived(section.status?.head ?? null);
  const branch = $derived(branchLabel(head));
  const operation = $derived(opLabel(section.status?.op?.kind));
  const busy = $derived(repoStore.busy !== null);
  const collapsed = $derived(multiRepo && changesLayout.isRepoCollapsed(repoRoot));
  /** Repository named in dialogs when several are shown. */
  const dialogName = $derived(multiRepo ? repo.name : null);
  const lfsFiles = $derived(lfsFileSet(lfsStore.statuses[repoRoot]));

  // LFS files for the "LFS" badges, checked again when HEAD, the index or entries change.
  $effect(() => {
    lfsStore.follow(repoRoot, repoStore.treeVersions[repoRoot] ?? 0);
  });

  function rowBadge(file: FileStatus): string | null {
    if (isSubmoduleEntry(file)) {
      return "submodule";
    }
    return lfsFiles.has(file.path) ? "LFS" : null;
  }

  function rowNote(file: FileStatus, group: GroupId): string | null {
    return group === "unstaged" ? describeSubmoduleChange(file.submodule) || null : null;
  }

  function rowSelection(file: FileStatus, group: GroupId): FileSelection {
    return { repoRoot, path: file.path, area: group === "staged" ? "staged" : "unstaged" };
  }

  function rowActions(file: FileStatus, group: GroupId): RowAction[] {
    if (group === "conflicts") {
      return [
        { icon: "merge", title: "Resolve in merge tool", run: () => void repoStore.openMerge(file.path, repoRoot) },
      ];
    }
    if (group === "staged") {
      return [{ icon: "minus", title: "Unstage", run: () => unstage(repoRoot, [file]) }];
    }
    // Discarding does not apply to a submodule: Update (in its menu) checks out the recorded commit.
    if (isSubmoduleEntry(file)) {
      return [{ icon: "plus", title: "Stage", run: () => stage(repoRoot, [file]) }];
    }
    return [
      {
        icon: "discard",
        title: "Discard changes",
        run: () => void discard(repoRoot, [file], dialogName),
        danger: true,
      },
      { icon: "plus", title: "Stage", run: () => stage(repoRoot, [file]) },
    ];
  }

  function rowMenu(event: MouseEvent, file: FileStatus, group: GroupId): void {
    let items: MenuItem[];
    if (group === "conflicts") {
      items = [
        { label: "Resolve in Merge Tool", action: () => void repoStore.openMerge(file.path, repoRoot) },
        { label: "Show All Conflicts...", action: () => void repoStore.openConflicts(repoRoot) },
      ];
    } else if (group === "staged") {
      items = [{ label: "Unstage", action: () => unstage(repoRoot, [file]), disabled: busy }];
    } else {
      items = [
        { label: "Stage", action: () => stage(repoRoot, [file]), disabled: busy },
        {
          label: "Discard Changes...",
          action: () => void discard(repoRoot, [file], dialogName),
          danger: true,
          disabled: busy,
        },
      ];
    }
    if (isSubmoduleEntry(file) && group !== "conflicts") {
      items =
        group === "staged" ? items : items.filter((item) => !("label" in item) || item.label !== "Discard Changes...");
      items.push({ separator: true }, ...submoduleEntryItems(repoRoot, file.path));
    }
    const ignoreItem = group === "conflicts" ? null : ignoreMenu(repoRoot, file.path, file.path.endsWith("/"));
    if (ignoreItem) {
      items.push({ separator: true }, ignoreItem);
    }
    if (group !== "conflicts" && !file.submodule) {
      items.push({ label: "Shelve Changes...", disabled: busy, action: () => openShelveDialog(repoRoot, [file.path]) });
    }
    items.push({ separator: true }, { label: "Copy Path", action: () => copyText(file.path) });
    contextMenu.open(event, items);
  }

  /** Right click: the "..." menu, plus the repository items. */
  async function headerMenu(event: MouseEvent): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    const items: MenuItem[] = await repoMenuFor(repoRoot);
    if (section.conflicts.length > 0) {
      items.push({ label: "Resolve Conflicts...", action: () => void repoStore.openConflicts(repoRoot) });
    }
    items.push({ separator: true });
    if (!active) {
      items.push({ label: "Set as Active Repository", action: () => void repoStore.setActiveRepo(repoRoot) });
    }
    items.push({ label: "Copy Repository Path", action: () => copyText(repoRoot) });
    contextMenu.open(event, items);
  }

  function headerTitle(): string {
    const parts = [repoRoot];
    if (branch) {
      parts.push(`on ${branch}`);
    }
    if (active) {
      parts.push("active repository");
    }
    return parts.join(", ");
  }
</script>

{#snippet fileGroup(group: GroupId, label: string, groupFiles: FileStatus[])}
  {#if groupFiles.length > 0}
    <Collapsible
      title={label}
      count={groupFiles.length}
      nested={multiRepo}
      open={!changesLayout.isGroupCollapsed(repoRoot, group)}
      ontoggle={() => changesLayout.toggleGroup(repoRoot, group)}
    >
      {#snippet actions()}
        {#if group === "conflicts"}
          <Button size="mini" onclick={() => void repoStore.openConflicts(repoRoot)}>Resolve...</Button>
        {:else if group === "staged"}
          <IconButton
            icon="minus"
            iconSize="medium"
            size="row"
            label="Unstage all"
            onclick={() => unstage(repoRoot, groupFiles)}
            disabled={busy}
          />
        {:else}
          <IconButton
            icon="discard"
            iconSize="medium"
            size="row"
            tone="dim-danger"
            label="Discard all"
            onclick={() => void discard(repoRoot, groupFiles, dialogName)}
            disabled={busy}
          />
          <IconButton
            icon="plus"
            iconSize="medium"
            size="row"
            label="Stage all"
            onclick={() => stage(repoRoot, groupFiles)}
            disabled={busy}
          />
        {/if}
      {/snippet}
      {#each groupFiles as file (file.path)}
        {@const selection = rowSelection(file, group)}
        <FileRow
          {file}
          nested={multiRepo}
          kind={group === "conflicts" ? null : kindIn(file, selection.area)}
          selected={group !== "conflicts" && sameSelection(selection, selected)}
          id={group === "conflicts" ? undefined : rowElementId(selection)}
          actions={rowActions(file, group)}
          badge={rowBadge(file)}
          note={rowNote(file, group)}
          onselect={() => {
            if (group === "conflicts") {
              void repoStore.openMerge(file.path, repoRoot);
            } else {
              onselect(selection);
            }
          }}
          onactivate={() => activate(repoRoot, file, group)}
          oncontextmenu={(event) => rowMenu(event, file, group)}
        />
      {/each}
    </Collapsible>
  {/if}
{/snippet}

<Stack gap="none" role="group" label={repo.name}>
  {#if multiRepo}
    <Stack responsive>
      <Row
        size="section"
        mark={active}
        expanded={!collapsed}
        title={headerTitle()}
        onclick={() => changesLayout.toggleRepo(repoRoot)}
        oncontextmenu={(event) => void headerMenu(event)}
      >
        <Stack direction="row" align="center" gap="sm" shrink>
          <Text weight="semibold" truncate>{repo.name}</Text>
          {#if repo.submodule}
            <Tag variant="outline" size="small" title="A submodule of the repository around it">submodule</Tag>
          {:else if repo.worktree}
            <Tag variant="outline" size="small" title="A linked worktree">worktree</Tag>
          {/if}
          {#if showRelativePath(repo)}
            <Text size="small" tone="faint" truncate giveWay>{repo.relativePath}</Text>
          {/if}
        </Stack>
        <Badge
          count={section.changeCount}
          tone="quiet"
          size="large"
          hideAt="tiny"
          label="{section.changeCount} changed {section.changeCount === 1 ? 'file' : 'files'}"
        />
        {#if operation}
          <Pill tone="warning" strong title={section.status?.op?.description ?? operation}>{operation}</Pill>
        {/if}
        <Spacer />
        <RepoActions {section} />
      </Row>
    </Stack>
  {/if}
  {#if !collapsed}
    <Stack gap="xs">
      {#if commitBox}
        <Stack paddingLeft={multiRepo ? "lg" : null}>
          <CommitBox
            {repo}
            stagedCount={section.staged.length}
            conflictCount={section.conflicts.length}
            {multiRepo}
            choices={[]}
            onpick={() => {}}
            placement="section"
          />
        </Stack>
      {/if}
      {@render fileGroup("conflicts", "Conflicts", section.conflicts)}
      {@render fileGroup("staged", "Staged", section.staged)}
      {@render fileGroup("unstaged", "Changes", section.unstaged)}
    </Stack>
  {/if}
</Stack>
