<!-- Settings > Git > Commit messages: the user's commit message templates, picked from the
     commit box's Templates menu. Saved to settings.json once every name is valid. -->
<script lang="ts">
  import { untrack } from "svelte";
  import { settings } from "$lib/stores/settings.svelte";
  import { dialogs } from "$lib/ui/dialog.svelte";
  import Button from "@nibtree/ui/components/Button.svelte";
  import IconButton from "@nibtree/ui/components/IconButton.svelte";
  import Input from "@nibtree/ui/components/Input.svelte";
  import Stack from "@nibtree/ui/components/Stack.svelte";
  import Text from "@nibtree/ui/components/Text.svelte";
  import TextArea from "@nibtree/ui/components/TextArea.svelte";
  import {
    type CommitTemplate,
    MAX_COMMIT_TEMPLATES,
    MAX_TEMPLATE_TEXT_LENGTH,
    TEMPLATE_PLACEHOLDERS,
    validateTemplateName,
  } from "../changes/commitTemplates";

  let rows = $state<CommitTemplate[]>(untrack(() => settings.commitTemplates.map((template) => ({ ...template }))));

  const errors = $derived(rows.map((row, index) => validateTemplateName(row.name, rows, index)));

  function persist(): void {
    if (errors.every((error) => error === null)) {
      settings.setPreference(
        "commitTemplates",
        rows.map((row) => ({ name: row.name.trim(), text: row.text })),
      );
    }
  }

  function freeName(): string {
    for (let number = 1; ; number++) {
      const name = number === 1 ? "New template" : `New template ${number}`;
      if (!rows.some((row) => row.name.toLowerCase() === name.toLowerCase())) {
        return name;
      }
    }
  }

  function add(): void {
    rows.push({ name: freeName(), text: "feat:[{ticket}] {cursor}" });
    persist();
  }

  async function remove(index: number): Promise<void> {
    const confirmed = await dialogs.confirm({
      title: "Delete Template",
      message: `Delete the template "${rows[index]?.name ?? ""}"?`,
      confirmLabel: "Delete",
      danger: true,
    });
    if (confirmed) {
      rows.splice(index, 1);
      persist();
    }
  }
</script>

<Stack gap="mdPlus">
  {#each rows as row, index (index)}
    <Stack gap="xs">
      <Stack direction="row" align="center" gap="sm">
        <Input
          width="fill"
          value={row.name}
          oninput={(event) => {
            row.name = event.currentTarget.value;
            persist();
          }}
          aria-label="Template name"
          autocomplete="off"
          spellcheck="false"
        />
        <IconButton icon="trash" iconSize="medium" label="Delete template" onclick={() => void remove(index)} />
      </Stack>
      {#if errors[index]}
        <Text size="small" tone="danger">{errors[index]}</Text>
      {/if}
      <TextArea
        mono
        rows="normal"
        value={row.text}
        oninput={(event) => {
          row.text = event.currentTarget.value;
          persist();
        }}
        maxlength={MAX_TEMPLATE_TEXT_LENGTH}
        aria-label="Template text"
        spellcheck="false"
      />
    </Stack>
  {:else}
    <Text variant="hint">No templates yet.</Text>
  {/each}
  <Stack direction="row">
    <Button size="small" onclick={add} disabled={rows.length >= MAX_COMMIT_TEMPLATES}>Add Template</Button>
  </Stack>
  <Text variant="hint">
    Placeholders:
    {#each TEMPLATE_PLACEHOLDERS as placeholder, index (placeholder.token)}
      <Text variant="code">{placeholder.token}</Text>
      {placeholder.hint}{index < TEMPLATE_PLACEHOLDERS.length - 1 ? ", " : "."}
    {/each}
  </Text>
</Stack>
