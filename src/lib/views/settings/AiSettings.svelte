<!-- Settings > AI: agent permissions, keeping the computer awake, usage in the status bar, worktree links, agents. -->
<script lang="ts">
  import AiAgentSettings from "$lib/ai/AiAgentSettings.svelte";
  import { settings } from "$lib/stores/settings.svelte";
  import {
    AI_USAGE_PROVIDERS,
    type AiPermissionMode,
    type AiUsageProvider,
    type AiUsagePosition,
    type ComputerAwakeMode,
  } from "$lib/stores/settingsData";
  import Checkbox from "@nibtree/ui/components/Checkbox.svelte";
  import Input from "@nibtree/ui/components/Input.svelte";
  import Select from "@nibtree/ui/components/Select.svelte";
  import Stack from "@nibtree/ui/components/Stack.svelte";
  import SettingsRow from "./SettingsRow.svelte";
  import { set } from "./settingsShared";

  const permissionChoices: { value: AiPermissionMode; label: string; hint: string }[] = [
    { value: "ask", label: "Ask on first start", hint: "The first agent you start asks which you prefer." },
    { value: "normal", label: "Ask before acting", hint: "Agents ask you before they edit files or run commands." },
    {
      value: "full",
      label: "Full autonomy",
      hint:
        "Agents act without asking (Claude Code --dangerously-skip-permissions and the like). Best in a worktree of " +
        "its own.",
    },
  ];
  const awakeChoices: { value: ComputerAwakeMode; label: string }[] = [
    { value: "on", label: "On" },
    { value: "agent", label: "Agent" },
    { value: "off", label: "Off" },
  ];
  const usagePlaces: { value: AiUsagePosition; label: string }[] = [
    { value: "left", label: "Left" },
    { value: "right", label: "Right" },
    { value: "hidden", label: "Hidden" },
  ];
  const permissionHint = $derived(
    (permissionChoices.find((choice) => choice.value === settings.aiPermissionMode)?.hint ?? "") +
      " Agents start from the AI panel (the robot icon on the right).",
  );

  function showUsageOf(providerId: AiUsageProvider, shown: boolean): void {
    const hidden = settings.aiUsageHidden.filter((id) => id !== providerId);
    set("aiUsageHidden", shown ? hidden : [...hidden, providerId]);
  }

  function setWorktreeLinks(text: string): void {
    const names = text
      .split(",")
      .map((name) => name.trim())
      .filter((name) => name !== "");
    set("aiWorktreeLinks", names);
  }
</script>

<SettingsRow title="Agent permissions" hint={permissionHint}>
  <Select
    label="Agent permissions"
    options={permissionChoices}
    value={settings.aiPermissionMode}
    onchange={(mode) => set("aiPermissionMode", mode)}
  />
</SettingsRow>
<SettingsRow title="Keep computer awake">
  {#snippet hintContent()}
    Choose On, Agent, or Off. Agent mode keeps the screen on and stops idle sleep and the screen lock while agents work,
    so long runs finish. Closing the lid still puts a Mac to sleep. Also in the status bar (the coffee cup).
  {/snippet}
  <Select
    label="Keep computer awake"
    options={awakeChoices}
    value={settings.computerAwakeMode}
    onchange={(mode) => set("computerAwakeMode", mode)}
  />
</SettingsRow>
<SettingsRow title="Usage in status bar">
  {#snippet hintContent()}
    How much of Claude Code's and Codex's limits you used, like Orca. Claude Code's comes from Anthropic with Claude
    Code's own sign-in (macOS asks once to let Nibtree read it from the Keychain), Codex's from its session files.
  {/snippet}
  <Select
    label="Usage in status bar"
    options={usagePlaces}
    value={settings.aiUsagePosition}
    onchange={(place) => set("aiUsagePosition", place)}
  />
</SettingsRow>
<SettingsRow title="Show usage of" hint="Which agents the status bar shows. A hidden one is not read at all.">
  <Stack direction="row" gap="lg">
    {#each AI_USAGE_PROVIDERS as provider (provider.id)}
      <Checkbox
        label={provider.label}
        checked={!settings.aiUsageHidden.includes(provider.id)}
        disabled={settings.aiUsagePosition === "hidden"}
        onchange={(shown) => showUsageOf(provider.id, shown)}
      />
    {/each}
  </Stack>
</SettingsRow>
<SettingsRow title="Link into new worktrees">
  {#snippet hintContent()}
    Folders of the main checkout that New Task links into each new worktree, so it runs at once, such as node_modules.
    Only folders git ignores are linked. Separate them with commas.
  {/snippet}
  <Input
    spellcheck="false"
    value={settings.aiWorktreeLinks.join(", ")}
    onchange={(event) => setWorktreeLinks(event.currentTarget.value)}
    aria-label="Link into new worktrees"
  />
</SettingsRow>
<SettingsRow title="Agents" stacked>
  {#snippet hintContent()}
    Found on your login shell's PATH. Open an agent to change the command that starts it, its full-autonomy flags, how
    it takes a first prompt and extra arguments, so a provider's renamed command or flag needs no app update.
  {/snippet}
  <AiAgentSettings />
</SettingsRow>
