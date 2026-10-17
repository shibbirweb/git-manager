<!-- One row of the Branches and Stashes panel, on the UI library's Row: a section or folder with its count, a branch
     with its sync counts, a tag, a stash with Apply, Pop and Drop, or a worktree. -->
<script lang="ts">
  import Icon from "@nibtree/ui/components/Icon.svelte";
  import IconButton from "@nibtree/ui/components/IconButton.svelte";
  import Row from "@nibtree/ui/components/Row.svelte";
  import Stack from "@nibtree/ui/components/Stack.svelte";
  import Text from "@nibtree/ui/components/Text.svelte";
  import { repoStore } from "$lib/stores/repo.svelte";
  import { applyStash, dropStash, newBranchFrom } from "./actions";
  import { openNewWorktreeDialog } from "../git/worktrees/worktreeActions";
  import { worktreeLabel, worktreeTooltip } from "../git/worktrees/worktreeModel";
  import { isCollapsible, type SidebarRow } from "./tree";

  let { row, selected, ontoggle }: { row: SidebarRow; selected: boolean; ontoggle: () => void } = $props();

  const busy = $derived(repoStore.busy !== null);

  function localTooltip(): string {
    if (row.kind !== "local") {
      return "";
    }
    const branch = row.branch;
    const parts = [branch.name];
    if (branch.shortId) {
      parts.push(`at ${branch.shortId}`);
    }
    parts.push(branch.upstream ? `tracking ${branch.upstream}` : "no upstream");
    if (branch.ahead > 0) {
      parts.push(`${branch.ahead} ahead`);
    }
    if (branch.behind > 0) {
      parts.push(`${branch.behind} behind`);
    }
    return parts.join(", ");
  }
</script>

{#snippet syncCount(count: number, icon: "arrow-up" | "arrow-down", title: string)}
  <Stack direction="row" align="center" gap="none" element="span">
    <Text size="xsmall" tone="dim" {title}>{count}</Text>
    <Icon name={icon} size="xsmall" tone="dim" />
  </Stack>
{/snippet}

{#snippet rowButton(icon: "plus" | "check" | "arrow-up" | "x", label: string, run: () => void, danger = false)}
  <IconButton
    {icon}
    iconSize="medium"
    size="mini"
    tone={danger ? "dim-danger" : "dim"}
    {label}
    disabled={busy}
    onclick={run}
  />
{/snippet}

<Row
  size={row.kind === "section" ? "section" : "tree"}
  {selected}
  depth={row.depth}
  expanded={isCollapsible(row) ? row.expanded : "leaf"}
  onclick={isCollapsible(row) ? ontoggle : undefined}
>
  {#if row.kind === "section"}
    <Text variant="sectionLabel">{row.label}</Text>
    <Text size="xsmall" tone="faint">{row.count}</Text>
  {:else if row.kind === "group"}
    <Icon name={row.icon} size="normal" tone="dim" />
    <Text truncate>{row.label}</Text>
    <Text size="xsmall" tone="faint">{row.count}</Text>
  {:else if row.kind === "local"}
    <Icon name={row.branch.isHead ? "check" : "branch"} size="normal" tone={row.branch.isHead ? "accent" : "inherit"} />
    <Text truncate weight={row.branch.isHead ? "semibold" : undefined} title={localTooltip()}>{row.label}</Text>
    {#if row.branch.ahead > 0}
      {@render syncCount(row.branch.ahead, "arrow-up", "Commits to push")}
    {/if}
    {#if row.branch.behind > 0}
      {@render syncCount(row.branch.behind, "arrow-down", "Commits to pull")}
    {/if}
  {:else if row.kind === "remote"}
    <Icon name="branch" size="normal" tone="dim" />
    <Text truncate title={row.branch.name}>{row.label}</Text>
  {:else if row.kind === "tag"}
    <Icon name="tag" size="normal" tone="dim" />
    <Text truncate title={row.tagName}>{row.label}</Text>
  {:else if row.kind === "stash"}
    <Icon name="stash" size="normal" tone="dim" />
    <Text truncate title={row.stash.message}>{row.stash.message}</Text>
    <Text size="xsmall" tone="dim">stash@&#123;{row.stash.index}&#125;</Text>
  {:else if row.kind === "worktree"}
    <Icon
      name={row.worktree.isCurrent ? "check" : "folder-git"}
      size="normal"
      tone={row.worktree.isCurrent ? "accent" : "dim"}
    />
    <Text
      truncate
      weight={row.worktree.isCurrent ? "semibold" : undefined}
      strike={row.worktree.prunable}
      title={worktreeTooltip(row.worktree)}
    >
      {worktreeLabel(row.worktree)}
    </Text>
    <Text size="small" tone="dim" truncate giveWay>{row.worktree.path}</Text>
    {#if row.worktree.locked}
      <Text size="xsmall" tone="dim" title={row.worktree.lockReason ?? "Locked"}>locked</Text>
    {:else if row.worktree.prunable}
      <Text size="xsmall" tone="dim" title={row.worktree.prunableReason ?? "Its folder is gone"}>prunable</Text>
    {:else if row.worktree.isMain}
      <Text size="xsmall" tone="dim">main</Text>
    {/if}
  {:else}
    <Text tone="dim">{row.label}</Text>
  {/if}
  {#snippet actions()}
    {#if row.kind === "section" && row.section === "local"}
      {@render rowButton("plus", "New branch from HEAD", () => void newBranchFrom(null))}
    {:else if row.kind === "section" && row.section === "worktrees"}
      {@render rowButton("plus", "New worktree", openNewWorktreeDialog)}
    {:else if row.kind === "stash"}
      {@const stash = row.stash}
      {@render rowButton("check", "Apply stash", () => void applyStash(stash.index, false))}
      {@render rowButton("arrow-up", "Pop stash (apply and drop)", () => void applyStash(stash.index, true))}
      {@render rowButton("x", "Drop stash", () => void dropStash(stash), true)}
    {/if}
  {/snippet}
</Row>
