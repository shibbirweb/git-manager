<!-- Settings > Git > Commit messages: the user's commit message templates, picked from the
     commit box's Templates menu. Saved to settings.json once every name is valid. -->
<script lang="ts">
  import { untrack } from "svelte";
  import { settings } from "$lib/stores/settings.svelte";
  import { dialogs } from "$lib/ui/dialog.svelte";
  import Icon from "$lib/ui/Icon.svelte";
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

<div class="templates">
  {#each rows as row, index (index)}
    <div class="template">
      <div class="template-head">
        <input
          class="input name"
          value={row.name}
          oninput={(event) => {
            row.name = event.currentTarget.value;
            persist();
          }}
          aria-label="Template name"
          autocomplete="off"
          spellcheck="false"
        />
        <button class="icon-btn" onclick={() => void remove(index)} title="Delete template" aria-label="Delete template">
          <Icon name="trash" size={13} />
        </button>
      </div>
      {#if errors[index]}
        <div class="error">{errors[index]}</div>
      {/if}
      <textarea
        class="input text"
        value={row.text}
        oninput={(event) => {
          row.text = event.currentTarget.value;
          persist();
        }}
        maxlength={MAX_TEMPLATE_TEXT_LENGTH}
        rows="3"
        aria-label="Template text"
        spellcheck="false"
      ></textarea>
    </div>
  {:else}
    <div class="hint">No templates yet.</div>
  {/each}
  <div class="actions">
    <button class="btn small" onclick={add} disabled={rows.length >= MAX_COMMIT_TEMPLATES}>Add Template</button>
  </div>
  <div class="hint">
    Placeholders:
    {#each TEMPLATE_PLACEHOLDERS as placeholder, index (placeholder.token)}
      <code>{placeholder.token}</code> {placeholder.hint}{index < TEMPLATE_PLACEHOLDERS.length - 1 ? ", " : "."}
    {/each}
  </div>
</div>

<style>
  .templates {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .template {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }

  .template-head {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .name {
    flex: 1;
    min-width: 0;
    font-weight: 500;
  }

  .text {
    width: 100%;
    font-family: var(--font-mono);
    font-size: 12px;
    line-height: 1.45;
  }

  .actions {
    display: flex;
  }

  .hint {
    font-size: 12px;
    color: var(--text-dim);
    line-height: 1.6;
  }

  code {
    font-family: var(--font-mono);
    font-size: 11.5px;
  }

  .error {
    font-size: 12px;
    color: var(--danger);
  }
</style>
