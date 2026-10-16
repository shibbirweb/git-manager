<!-- The app's own dialogs (dialog.svelte.ts): confirm, prompt (with an optional second field and checkbox), pick
     from a filterable list, and choose one of a few answers, drawn with the UI library's Dialog. Esc cancels, Enter
     confirms; a prompt's text is selected (or the given range) when it opens. -->
<script lang="ts">
  import Button from "@git-manager/ui/components/Button.svelte";
  import Checkbox from "@git-manager/ui/components/Checkbox.svelte";
  import ChoiceList from "@git-manager/ui/components/ChoiceList.svelte";
  import Dialog from "@git-manager/ui/components/Dialog.svelte";
  import Field from "@git-manager/ui/components/Field.svelte";
  import Input from "@git-manager/ui/components/Input.svelte";
  import PickList from "@git-manager/ui/components/PickList.svelte";
  import Text from "@git-manager/ui/components/Text.svelte";
  import TextArea from "@git-manager/ui/components/TextArea.svelte";
  import { tick } from "svelte";
  import { dialogs } from "./dialog.svelte";

  let value = $state("");
  let checked = $state(false);
  let secondary = $state("");
  let input = $state<HTMLInputElement | null>(null);

  const active = $derived(dialogs.active);
  const validationError = $derived(
    active?.type === "prompt" && active.options.validate ? active.options.validate(value) : null,
  );

  // A new prompt starts from its text, selected (or the given range) once the dialog has put the focus in.
  $effect(() => {
    const current = dialogs.active;
    if (current?.type !== "prompt") {
      value = "";
      return;
    }
    value = current.options.initial ?? "";
    checked = current.options.checkbox?.checked ?? false;
    secondary = current.options.secondary?.initial ?? "";
    const range = current.options.selection;
    void tick().then(() => {
      if (range) {
        input?.setSelectionRange(range[0], range[1]);
      } else {
        input?.select();
      }
    });
  });

  function cancel(): void {
    const current = dialogs.active;
    dialogs.close();
    if (current?.type === "confirm") {
      current.resolve(false);
    } else {
      current?.resolve(null);
    }
  }

  function submit(): void {
    const current = dialogs.active;
    if (current?.type === "prompt") {
      if (validationError || !value.trim()) {
        return;
      }
      dialogs.close();
      current.resolve({ value: value.trim(), checked, secondary: secondary.trim() });
    } else if (current?.type === "confirm") {
      dialogs.close();
      current.resolve(true);
    }
  }

  function pick(choice: string): void {
    const current = dialogs.active;
    if (current?.type === "choose" || current?.type === "pick") {
      dialogs.close();
      current.resolve(choice);
    }
  }
</script>

<Dialog
  open={active !== null}
  title={active?.options.title ?? ""}
  enterSubmits={active?.type === "prompt"}
  onclose={cancel}
  onsubmit={submit}
>
  {#if active?.type === "confirm"}
    {#if active.options.message}
      <Text selectable wrap="anywhere" element="p">{active.options.message}</Text>
    {/if}
  {:else if active?.type === "prompt"}
    <Field label={active.options.label ?? ""} error={value ? validationError : null}>
      <Input
        bind:element={input}
        bind:value
        width="fill"
        placeholder={active.options.placeholder ?? ""}
        spellcheck="false"
        autocomplete="off"
        aria-label={active.options.label || active.options.title}
      />
    </Field>
    {#if active.options.secondary}
      <Field label={active.options.secondary.label}>
        <TextArea
          bind:value={secondary}
          placeholder={active.options.secondary.placeholder ?? ""}
          spellcheck="true"
          aria-label={active.options.secondary.label}
        />
      </Field>
    {/if}
    {#if active.options.checkbox}
      <Checkbox bind:checked label={active.options.checkbox.label} />
    {/if}
  {:else if active?.type === "pick"}
    <PickList
      items={active.options.items}
      label={active.options.title}
      placeholder={active.options.placeholder ?? "Type to filter"}
      emptyText={active.options.emptyText ?? "Nothing matches"}
      onpick={pick}
      oncancel={cancel}
    />
  {:else if active?.type === "choose"}
    {#if active.options.message}
      <Text selectable wrap="anywhere" element="p">{active.options.message}</Text>
    {/if}
    <ChoiceList choices={active.options.options} label={active.options.title} onpick={pick} />
  {/if}
  {#snippet actions()}
    {#if active?.type === "confirm"}
      <Button onclick={cancel}>{active.options.cancelLabel ?? "Cancel"}</Button>
      <!-- svelte-ignore a11y_autofocus -->
      <Button variant={active.options.danger ? "danger-primary" : "primary"} autofocus onclick={submit}>
        {active.options.confirmLabel ?? "OK"}
      </Button>
    {:else if active?.type === "prompt"}
      <Button onclick={cancel}>Cancel</Button>
      <Button variant="primary" disabled={!!validationError || !value.trim()} onclick={submit}>
        {active.options.confirmLabel ?? "OK"}
      </Button>
    {:else}
      <Button onclick={cancel}>Cancel</Button>
    {/if}
  {/snippet}
</Dialog>
