<script lang="ts">
  import type { Terminal } from "@xterm/xterm";
  import Button from "$ui/components/Button.svelte";
  import Segmented from "$ui/components/Segmented.svelte";
  import Stack from "$ui/components/Stack.svelte";
  import TerminalView from "$ui/components/TerminalView.svelte";

  // No shell here: the story echoes what is typed, like a line editor, to show the colors and states.
  let status = $state<"starting" | "ready" | "failed">("ready");
  let bell = $state(0);
  let terminal: Terminal | null = null;
  const prompt = "\x1b[32mstorefront\x1b[0m \x1b[34mmain\x1b[0m $ ";

  function ready(created: Terminal): void {
    terminal = created;
    created.write("\x1b[1mWelcome\x1b[0m: colors \x1b[31mred \x1b[32mgreen \x1b[33myellow \x1b[34mblue");
    created.write(" \x1b[35mmagenta \x1b[36mcyan\x1b[0m\r\n" + prompt);
  }

  function input(data: string): void {
    if (data === "\r") {
      terminal?.write("\r\n" + prompt);
    } else if (data === "\x7f") {
      terminal?.write("\b \b");
    } else {
      terminal?.write(data);
    }
  }
</script>

<Stack direction="row" gap="md" align="center">
  <Segmented
    label="State"
    bind:value={status}
    options={[
      { value: "ready", label: "Ready" },
      { value: "starting", label: "Starting" },
      { value: "failed", label: "Failed" },
    ]}
  />
  <Button size="small" onclick={() => (bell += 1)}>Ring the bell</Button>
</Stack>
<TerminalView
  label="Terminal"
  height="medium"
  {status}
  {bell}
  message={status === "failed" ? "The shell could not start" : "Starting zsh"}
  detail={status === "failed" ? "zsh: no such file or directory" : ""}
  onready={ready}
  oninput={input}
  onretry={() => (status = "ready")}
/>
