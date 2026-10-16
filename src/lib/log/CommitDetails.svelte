<script lang="ts">
  import { untrack } from "svelte";
  import { errorMessage } from "$lib/api";
  import { settings } from "$lib/stores/settings.svelte";
  import GitDiffView from "$lib/diff/GitDiffView.svelte";
  import Button from "@git-manager/ui/components/Button.svelte";
  import DescriptionList from "@git-manager/ui/components/DescriptionList.svelte";
  import EmptyState from "@git-manager/ui/components/EmptyState.svelte";
  import IconButton from "@git-manager/ui/components/IconButton.svelte";
  import Link from "@git-manager/ui/components/Link.svelte";
  import SplitPane from "@git-manager/ui/components/SplitPane.svelte";
  import Stack from "@git-manager/ui/components/Stack.svelte";
  import Text from "@git-manager/ui/components/Text.svelte";
  import { toast } from "$lib/ui/toast.svelte";
  import CommitFileList from "./CommitFileList.svelte";
  import { CommitLoader } from "./commitLoader.svelte";
  import { fullDate } from "./format";
  import { findLine } from "./lineMatch";

  interface Props {
    repoPath: string;
    commitId: string;
    /** Short id of a commit if it is loaded in the table, otherwise null. */
    loadedShortId: (commitId: string) => string | null;
    onSelectCommit: (commitId: string) => void;
    /**
     * Open this file's diff when showing that commit (e.g. coming from blame).
     * `lineText` is set when `line` is only a guess, to find the real line.
     */
    preferredFile?: {
      commitId: string;
      path: string;
      line: number | null;
      lineText?: string | null;
      token: number;
    } | null;
    /**
     * Shows "Open in Tab" and makes a double-click on a changed file open the
     * commit in its own editor tab on that file. Left out inside the tab itself.
     */
    onOpenInTab?: ((filePath: string | null) => void) | null;
  }

  let { repoPath, commitId, loadedShortId, onSelectCommit, preferredFile = null, onOpenInTab = null }: Props = $props();

  const loader = new CommitLoader();
  const details = $derived(loader.details);
  const detailsError = $derived(loader.detailsError);
  const shown = $derived(loader.shown);
  const diffError = $derived(loader.diffError);
  const diffLoading = $derived(loader.diffLoading);
  let leftWidth = $state(360);
  let width = $state(0);
  /** The commit details column's height, for the largest size of its message and details. */
  let infoHeight = $state(0);

  const current = $derived(details && details.id === commitId ? details : null);
  const selectedRow = $derived(current ? loader.selectedRow : null);
  /** The line of the diff on screen to scroll to, from `preferredFile`. */
  const revealLine = $derived.by(() => {
    const preferred = preferredFile;
    const diff = shown;
    if (!preferred || !diff || preferred.commitId !== commitId || preferred.line === null) {
      return null;
    }
    if (preferred.path !== diff.path && preferred.path !== selectedRow?.file.origPath) {
      return null;
    }
    return { line: findLine(diff.diff.modified, preferred.line, preferred.lineText ?? null), token: preferred.token };
  });
  const body = $derived.by(() => {
    const message = details?.message ?? "";
    const newline = message.indexOf("\n");
    return {
      subject: newline === -1 ? message.trim() : message.slice(0, newline).trim(),
      rest:
        newline === -1
          ? ""
          : message
              .slice(newline + 1)
              .replace(/^\s*\n/, "")
              .trimEnd(),
    };
  });

  $effect(() => {
    void loader.loadDetails(repoPath, commitId, () => preferredFile);
  });

  // Back / Forward to another file of the commit already on screen.
  $effect(() => {
    const preferred = preferredFile;
    const loaded = current;
    if (!preferred || !loaded || preferred.commitId !== loaded.id) {
      return;
    }
    untrack(() => loader.selectPath(preferred.path));
  });

  $effect(() => {
    const ready = current !== null;
    const row = selectedRow;
    if (!ready) {
      return;
    }
    if (!row) {
      loader.clearDiff();
      return;
    }
    void loader.loadDiff(repoPath, commitId, row);
  });

  async function copyHash(): Promise<void> {
    try {
      await navigator.clipboard.writeText(details?.id ?? commitId);
      toast.success("Copied revision hash");
    } catch (error) {
      toast.error("Could not copy", errorMessage(error));
    }
  }

  /** Author, date, committer, hash and parents, for the description list. */
  const facts = $derived.by(() => {
    if (!details) {
      return [];
    }
    const items = [
      { label: "Author", value: details.authorName },
      { label: "Date", value: fullDate(details.authorTime) },
    ];
    if (details.committerName && details.committerName !== details.authorName) {
      items.push({ label: "Committer", value: `${details.committerName}, ${fullDate(details.committerTime)}` });
    }
    items.push({ label: "Hash", value: details.id });
    if (details.parents.length > 0) {
      items.push({ label: details.parents.length > 1 ? "Parents" : "Parent", value: details.parents.join(" ") });
    }
    return items;
  });

  const OPEN_TAB_TITLE =
    "Open this commit in an editor tab, with the diff in the whole editor area (or double-click the commit or a file)";
</script>

{#snippet fact(item: { label: string; value: string })}
  {#if item.label === "Author" && details}
    <Text selectable truncate title={details.authorEmail}>
      {details.authorName}
      {#if details.authorEmail}<Text tone="dim">&lt;{details.authorEmail}&gt;</Text>{/if}
    </Text>
  {:else if item.label === "Hash"}
    <Stack direction="row" gap="xs" align="center">
      <Text mono selectable truncate>{item.value}</Text>
      <IconButton icon="copy" label="Copy revision hash" size="mini" tone="dim" iconSize="medium" onclick={copyHash} />
    </Stack>
  {:else if item.label === "Parent" || item.label === "Parents"}
    <Stack direction="row" gap="sm" wrap>
      {#each details?.parents ?? [] as parentId (parentId)}
        {@const loaded = loadedShortId(parentId)}
        <Link
          size="small"
          mono
          disabled={loaded === null}
          title={loaded === null ? `${parentId} (not loaded yet)` : `Select ${parentId}`}
          onclick={() => onSelectCommit(parentId)}
        >
          {loaded ?? parentId.slice(0, 8)}
        </Link>
      {/each}
    </Stack>
  {:else}
    <Text selectable truncate>{item.value}</Text>
  {/if}
{/snippet}

{#snippet info()}
  {#if detailsError}
    <EmptyState icon="alert" title="Could not load commit: {detailsError}" titleTone="dim" />
  {:else if !details}
    <EmptyState title="Loading commit..." titleTone="dim" delayed />
  {:else}
    <SplitPane
      direction="column"
      label="Resize the commit message and the changed files"
      preset="bottom"
      inPanel
      bind:size={settings.commitInfoHeight}
      bind:extent={infoHeight}
      max={Math.max(80, infoHeight - 120)}
      oncommit={() => settings.save()}
    >
      {#snippet first()}
        <Stack gap="sm" padding="lg" scroll="y" grow>
          <Stack direction="row" gap="md" align="start">
            <Stack grow>
              <Text weight="semibold" selectable wrap="anywhere">{body.subject || "(no message)"}</Text>
            </Stack>
            {#if onOpenInTab}
              <Button
                size="small"
                icon="commit"
                title={OPEN_TAB_TITLE}
                onclick={() => onOpenInTab?.(selectedRow?.file.path ?? null)}
              >
                Open in Tab
              </Button>
            {/if}
          </Stack>
          {#if body.rest}
            <Text size="codeSmall" wrap="pre" selectable element="p">{body.rest}</Text>
          {/if}
          <DescriptionList label="Commit" items={facts} value={fact} />
        </Stack>
      {/snippet}
      {#snippet second()}
        <CommitFileList
          {details}
          rows={loader.rows}
          view={loader.mergeView}
          bind:selected={loader.selectedKey}
          onview={(view) => loader.setMergeView(view)}
          onopen={onOpenInTab}
        />
      {/snippet}
    </SplitPane>
  {/if}
{/snippet}

<SplitPane
  label="Resize the commit details"
  preset="files"
  bind:size={leftWidth}
  bind:extent={width}
  max={Math.max(220, width - 240)}
>
  {#snippet first()}{@render info()}{/snippet}
  {#snippet second()}
    {#if diffError}
      <EmptyState icon="alert" title="Could not load diff: {diffError}" titleTone="dim" />
    {:else if shown}
      {#key shown.key}
        <GitDiffView
          source={{
            kind: "commit",
            repoRoot: repoPath,
            commitId: details?.id ?? commitId,
            filePath: shown.path,
            origPath: shown.origPath,
            parentId: shown.parentId,
            secondParent: shown.secondParent,
            parents: details?.parents ?? [],
          }}
          diff={shown.diff}
          path={shown.path}
          labels={{ left: shown.parentLabel, right: shown.label }}
          blame={shown.diff.modified === ""
            ? null
            : {
                repoRoot: repoPath,
                filePath: shown.path,
                revision: commitId,
                origin: (line) => ({ kind: "log", repoRoot: repoPath, commitId, filePath: shown?.path ?? null, line }),
              }}
          {revealLine}
          previewSides={shown.previewSides}
        />
      {/key}
    {:else if diffLoading}
      <EmptyState title="Loading diff..." titleTone="dim" delayed />
    {:else}
      <EmptyState title="Select a file to see its changes" titleTone="dim" />
    {/if}
  {/snippet}
</SplitPane>
