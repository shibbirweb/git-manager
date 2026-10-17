<!-- The interactive rebase dialog: one row per commit, oldest at the top, each with
     its action (letter keys on a focused row), reorder by drag and drop or Option+Up / Down,
     reword and squash messages edited in place, and Reset to start over. With merge commits
     the rows follow the --rebase-merges todo, grouped by branch (see rebaseModel.ts). -->
<script lang="ts">
  import Button from "@nibtree/ui/components/Button.svelte";
  import Dialog from "@nibtree/ui/components/Dialog.svelte";
  import ReorderList from "@nibtree/ui/components/ReorderList.svelte";
  import SectionTitle from "@nibtree/ui/components/SectionTitle.svelte";
  import Select from "@nibtree/ui/components/Select.svelte";
  import Stack from "@nibtree/ui/components/Stack.svelte";
  import Tag from "@nibtree/ui/components/Tag.svelte";
  import Text from "@nibtree/ui/components/Text.svelte";
  import TextArea from "@nibtree/ui/components/TextArea.svelte";
  import { untrack } from "svelte";
  import { localKeys } from "$lib/commands/commandRuntime";
  import { relativeTime } from "$lib/log/format";
  import { repoStore } from "$lib/stores/repo.svelte";
  import type { RebaseAction, RebasePlan } from "$lib/types";
  import { gitDialogs } from "./gitDialogs.svelte";
  import {
    actionForKey,
    allowedActions,
    deadCommits,
    dropTarget,
    initialRows,
    isMessageSquash,
    moveRow,
    REBASE_ACTIONS,
    rebaseTitle,
    type RebaseRow,
    rowsChanged,
    segmentTitles,
    setAction,
    setMessage,
    validateRows,
  } from "./rebaseModel";
  import { startRebase } from "./rebaseStart";

  interface Props {
    repoRoot: string;
    plan: RebasePlan;
  }

  let { repoRoot, plan }: Props = $props();

  const original = untrack(() => initialRows(plan.commits, plan.steps));
  const withMerges = untrack(() => plan.steps.length > 0);
  let rows = $state.raw<RebaseRow[]>(original);
  const now = Date.now();

  const error = $derived(validateRows(rows, plan.steps));
  const dead = $derived(deadCommits(rows, plan.steps));
  const changed = $derived(rowsChanged(rows, original));
  const canStart = $derived(error === null && changed && repoStore.busy === null);
  const baseLabel = $derived(plan.ontoName ?? (plan.base ? plan.base.slice(0, 8) : "the root"));
  const titles = $derived(segmentTitles(plan.steps, plan.commits, baseLabel));

  function close(): void {
    gitDialogs.close();
  }

  function actionChoices(row: RebaseRow) {
    return REBASE_ACTIONS.filter((action) => allowedActions(row).includes(action.value)).map((action) => ({
      value: action.value,
      label: action.label,
      title: action.description,
    }));
  }

  /** Lines a message box shows: the message's, from 3 up to 8. */
  function messageRows(message: string): "normal" | "large" | "xlarge" {
    const lines = message.split("\n").length;
    return lines <= 3 ? "normal" : lines <= 5 ? "large" : "xlarge";
  }

  function onRowKey(event: KeyboardEvent, index: number): void {
    // Option changes the typed character on macOS: match the physical key.
    const letter = event.code.startsWith("Key") ? event.code.slice(3) : event.key;
    const action = event.altKey ? null : actionForKey(letter);
    if (action) {
      event.preventDefault();
      rows = setAction(rows, index, action);
    }
  }

  function start(): void {
    if (canStart) {
      void startRebase(repoRoot, plan, rows, close);
    }
  }
</script>

<Dialog
  open
  variant="form"
  title="{rebaseTitle(rows.length)} onto {baseLabel}"
  width="xlarge"
  onclose={close}
  onsubmit={start}
>
  <Text variant="hint" tone="faint">
    Oldest commit at the top. Pick an action, or press P, R, E, S, F or D on a row; Option+Up and Option+Down or drag to
    reorder.
  </Text>
  {#if withMerges}
    <Text variant="hint" tone="faint">
      Merge commits are recreated (--rebase-merges): pick or drop each one, and dropping it drops the branch it merged.
      Commits move only within their part of a branch.
    </Text>
  {/if}
  <ReorderList
    items={rows}
    itemKey={(row) => row.commit.id}
    label="Commits to rebase"
    rowLabel={(row) => `${row.action} ${row.commit.shortId} ${row.commit.summary}`}
    dragBy="row"
    maxHeight="large"
    canDrop={(from, to) => dropTarget(rows, from, to) !== null}
    onreorder={(from, to) => (rows = moveRow(rows, from, to))}
    onkey={onRowKey}
  >
    {#snippet heading(row, index)}
      {#if row.segment !== undefined && row.segment !== rows[index - 1]?.segment}
        <SectionTitle variant="band" title={titles[row.segment] ?? ""} />
      {/if}
    {/snippet}
    {#snippet row(row, index)}
      {@const struck = row.action === "drop" || dead.has(row.commit.id)}
      <Select
        label="Action for {row.commit.shortId}"
        size="small"
        width="xsmall"
        disabled={dead.has(row.commit.id)}
        value={row.action}
        onchange={(action: RebaseAction) => (rows = setAction(rows, index, action))}
        options={actionChoices(row)}
      />
      <Stack width="xsmall">
        <Text mono size="compact" tone={struck ? "faint" : "dim"} strike={struck}>{row.commit.shortId}</Text>
      </Stack>
      <Stack
        direction="row"
        align="center"
        gap="xs"
        grow
        paddingX={row.action === "squash" || row.action === "fixup" ? "lgPlus" : "none"}
      >
        {#if row.commit.isMerge}<Tag variant="outline" size="small">merge</Tag>{/if}
        <Text truncate tone={struck ? "faint" : "default"} strike={struck} title={row.commit.message}>
          {row.commit.summary}
        </Text>
      </Stack>
      <Stack width="large">
        <Text truncate tone={struck ? "faint" : "dim"} strike={struck}>{row.commit.authorName}</Text>
      </Stack>
      <Stack width="small" align="end">
        <Text size="small" tone="dim">{relativeTime(row.commit.time, now)}</Text>
      </Stack>
    {/snippet}
    {#snippet detail(row, index)}
      {#if !dead.has(row.commit.id) && (row.action === "reword" || isMessageSquash(rows, index))}
        <Stack paddingX="mdPlus" paddingY="xs">
          <TextArea
            mono
            resize="vertical"
            rows={messageRows(row.message)}
            value={row.message}
            oninput={(event) => (rows = setMessage(rows, index, event.currentTarget.value))}
            aria-label={row.action === "reword"
              ? `New message for ${row.commit.shortId}`
              : "Message of the squashed commit"}
            spellcheck="true"
          />
        </Stack>
      {/if}
    {/snippet}
  </ReorderList>
  {#if error}
    <Text size="small" tone="danger">{error}</Text>
  {/if}

  {#snippet footnote()}
    <Button onclick={() => (rows = original)} disabled={!changed}>Reset</Button>
  {/snippet}
  {#snippet actions()}
    <Text variant="hint" tone="faint">{localKeys("CmdOrCtrl+Enter")} to start</Text>
    <Button onclick={close}>Cancel</Button>
    <Button variant="primary" disabled={!canStart} onclick={start}>Start Rebasing</Button>
  {/snippet}
</Dialog>
