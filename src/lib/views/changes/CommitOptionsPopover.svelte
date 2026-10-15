<!-- Commit Options behind a gear next to the Commit button: sign-off, author,
     GPG signing and skipping hooks. Sign-off and GPG are settings; the author and Skip hooks
     stay with the repository until the app quits. -->
<script lang="ts">
  import type { GpgSign } from "$lib/types";
  import Button from "@git-manager/ui/components/Button.svelte";
  import Checkbox from "@git-manager/ui/components/Checkbox.svelte";
  import Field from "@git-manager/ui/components/Field.svelte";
  import Fieldset from "@git-manager/ui/components/Fieldset.svelte";
  import Input from "@git-manager/ui/components/Input.svelte";
  import Popover from "@git-manager/ui/components/Popover.svelte";
  import Segmented from "@git-manager/ui/components/Segmented.svelte";
  import Text from "@git-manager/ui/components/Text.svelte";
  import { changedOptionCount, commitOptionsTooltip, GPG_SIGN_CHOICES, validateAuthor } from "./commitOptions";
  import { commitOptions } from "./commitOptions.svelte";

  interface Props {
    repoRoot: string;
    disabled?: boolean;
  }

  let { repoRoot, disabled = false }: Props = $props();

  const options = $derived(commitOptions.for(repoRoot));
  const authorError = $derived(validateAuthor(options.author ?? ""));
  const checked = $derived({ ...options, author: authorError ? null : options.author });
  const changed = $derived(changedOptionCount(checked));
  const authorPlaceholder = "Name <email>";
  const gpgChoices = GPG_SIGN_CHOICES.map((choice) => ({
    value: choice.value,
    label: choice.label,
    title: choice.description,
  }));
</script>

<Popover label="Commit Options" placement="above" align="end" width="medium" padding="form" layer="window" autofocus>
  {#snippet trigger({ toggle, open })}
    <Button
      variant={changed > 0 ? "accent" : "default"}
      icon="settings"
      badge={changed > 0 ? changed : null}
      onclick={toggle}
      {disabled}
      title={commitOptionsTooltip(checked)}
      aria-label="Commit Options"
      aria-haspopup="dialog"
      aria-expanded={open}
    />
  {/snippet}
  <Text weight="semibold">Commit Options</Text>
  <Checkbox
    label="Sign-off (--signoff)"
    checked={options.signOff}
    onchange={(signOff) => commitOptions.setSignOff(signOff)}
  />
  <Field label="Author (--author)" look="compact" error={authorError}>
    <Input
      mono
      value={options.author ?? ""}
      invalid={authorError !== null}
      oninput={(event) => commitOptions.setAuthor(repoRoot, event.currentTarget.value)}
      placeholder={authorPlaceholder}
      spellcheck="false"
      autocomplete="off"
    />
  </Field>
  <Fieldset legend="GPG sign" legendTone="dim">
    <Segmented
      variant="split"
      label="GPG sign"
      options={gpgChoices}
      value={options.gpgSign}
      onchange={(gpgSign: GpgSign) => commitOptions.setGpgSign(gpgSign)}
    />
  </Fieldset>
  <Checkbox
    label="Skip hooks (--no-verify)"
    checked={options.noVerify}
    onchange={(noVerify) => commitOptions.setNoVerify(repoRoot, noVerify)}
  />
  <Text size="small" tone="faint">
    Sign-off and GPG apply to every commit. Author and Skip hooks apply to this repository until you quit.
  </Text>
</Popover>
