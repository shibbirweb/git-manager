<script lang="ts">
  import { repoStore } from "$lib/stores/repo.svelte";
  import Collapsible from "@nibtree/ui/components/Collapsible.svelte";
  import Icon from "@nibtree/ui/components/Icon.svelte";
  import IconButton from "@nibtree/ui/components/IconButton.svelte";
  import Pill from "@nibtree/ui/components/Pill.svelte";
  import Row from "@nibtree/ui/components/Row.svelte";
  import Spacer from "@nibtree/ui/components/Spacer.svelte";
  import Stack from "@nibtree/ui/components/Stack.svelte";
  import Tag from "@nibtree/ui/components/Tag.svelte";
  import Text from "@nibtree/ui/components/Text.svelte";
  import { contextMenu, type MenuItem } from "$lib/ui/menu.svelte";
  import { changesLayout } from "./layout.svelte";
  import { copyText } from "./mutations";
  import RepoActions from "./RepoActions.svelte";
  import { repoMenuFor } from "./repoActions";
  import { opLabel, showRelativePath, type RepoSection } from "./sections";

  interface Props {
    /** Repositories without changes (or whose status is still loading). */
    sections: RepoSection[];
    activeRoot: string | null;
  }

  let { sections, activeRoot }: Props = $props();

  const collapsed = $derived(changesLayout.isCleanCollapsed(sections.length));

  /** Right click: the "..." menu, plus the repository items. */
  async function repoMenu(event: MouseEvent, section: RepoSection): Promise<void> {
    event.preventDefault();
    event.stopPropagation();
    const repoRoot = section.repo.root;
    const items: MenuItem[] = section.status ? await repoMenuFor(repoRoot) : [];
    if (items.length > 0) {
      items.push({ separator: true });
    }
    if (repoRoot !== activeRoot) {
      items.push({ label: "Set as Active Repository", action: () => void repoStore.setActiveRepo(repoRoot) });
    }
    items.push({ label: "Copy Repository Path", action: () => copyText(repoRoot) });
    contextMenu.open(event, items);
  }
</script>

<Stack responsive role="group" label="Repositories without changes">
  <Collapsible
    title="No Changes"
    count={sections.length}
    dim
    open={!collapsed}
    ontoggle={() => changesLayout.toggleClean(sections.length)}
  >
    {#each sections as section (section.repo.root)}
      {@const active = section.repo.root === activeRoot}
      {@const operation = opLabel(section.status?.op?.kind)}
      <Row
        size="group"
        mark={active}
        title="{section.repo.root}{active ? ', active repository' : ''}"
        oncontextmenu={(event) => void repoMenu(event, section)}
      >
        <Icon name="folder-git" size="medium" tone="faint" />
        <Stack direction="row" align="center" gap="sm" shrink>
          <Text truncate>{section.repo.name}</Text>
          {#if section.repo.submodule}
            <Tag variant="outline" size="small" title="A submodule of the repository around it">submodule</Tag>
          {:else if section.repo.worktree}
            <Tag variant="outline" size="small" title="A linked worktree">worktree</Tag>
          {/if}
          {#if showRelativePath(section.repo)}
            <Text size="small" tone="faint" truncate giveWay>{section.repo.relativePath}</Text>
          {/if}
        </Stack>
        {#if operation}
          <Pill tone="warning" strong title={section.status?.op?.description ?? operation}>{operation}</Pill>
        {/if}
        <Spacer />
        {#if section.status}
          <RepoActions {section} showCommit={false} />
        {:else}
          <Text size="small" tone="faint">reading status</Text>
        {/if}
        {#snippet actions()}
          {#if !active}
            <IconButton
              icon="folder-git"
              iconSize="medium"
              size="row"
              onclick={() => void repoStore.setActiveRepo(section.repo.root)}
              title="Set as active repository"
              label="Set {section.repo.name} as active repository"
            />
          {/if}
        {/snippet}
      </Row>
    {/each}
  </Collapsible>
</Stack>
