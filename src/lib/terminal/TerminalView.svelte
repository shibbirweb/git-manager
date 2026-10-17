<!--
  One terminal: an xterm.js view wired to a shell in the backend, on the UI library's TerminalScreen. It stays mounted
  while hidden or moved (TerminalHost moves its element), so its scrollback survives switching and moving between
  the panel and the editor. Its life is in TerminalController; the effects here follow settings, visibility and
  requests.
-->
<script lang="ts">
  import Button from "@nibtree/ui/components/Button.svelte";
  import CornerCard from "@nibtree/ui/components/CornerCard.svelte";
  import TerminalScreen from "@nibtree/ui/components/TerminalScreen.svelte";
  import { untrack } from "svelte";
  import { settings } from "$lib/stores/settings.svelte";
  import { terminalScreenId } from "./dropPaths";
  import { applyChangedOptions, changesMetrics, terminalAddonPlan, terminalDisplayOptions } from "./options";
  import { runFinishedMessage } from "./runs";
  import { TerminalController } from "./terminalController.svelte";
  import TerminalFindBar from "./TerminalFindBar.svelte";
  import { terminalStore, type TerminalEntry } from "./terminalStore.svelte";
  import { exitMessage, shellNameFor, startupFailureTitle, startupLabel } from "./terminals";
  import type { TerminalPlacement } from "./terminalTabs";

  interface Props {
    terminal: TerminalEntry;
    /** On screen: the panel's active terminal while the panel is open, or the active terminal tab. */
    visible: boolean;
    /** Where the element sits now; a move re-measures the grid. */
    placement: TerminalPlacement;
  }

  let { terminal, visible, placement }: Props = $props();

  let root = $state<HTMLDivElement | null>(null);
  let findBar = $state<ReturnType<typeof TerminalFindBar> | null>(null);

  const displayOptions = $derived(terminalDisplayOptions(settings, terminal.exited));
  const controller = new TerminalController({
    terminal: () => terminal,
    visible: () => visible,
    options: () => displayOptions,
    focusFindBar: () => findBar?.focus(),
  });
  const shell = controller.shell;
  const find = controller.find;
  const shellName = $derived(
    terminal.run ? terminal.run.program : shellNameFor(terminal.shellId, terminalStore.shells),
  );
  const statusLabel = $derived(startupLabel(shell.phase, shellName));
  const addonPlan = $derived(terminalAddonPlan(settings));

  // Terminal settings apply to open terminals right away; font changes re-fit
  // the grid so the shell learns the new size. A hidden terminal waits until it
  // shows: xterm's DOM renderer measures glyphs with offsetWidth, which is 0
  // under display: none, and would keep a wrong letter spacing.
  $effect(() => {
    const next = displayOptions;
    const instance = controller.term;
    if (!instance || !visible) {
      return;
    }
    untrack(() => {
      const changed = applyChangedOptions(instance.options, next);
      if (changesMetrics(changed)) {
        controller.scheduleFit();
      }
    });
  });

  // Optional parts follow their settings at once. Turning one off disposes it
  // even while hidden, to free its memory; WebGL waits until the terminal
  // shows, since its renderer measures the cells as it starts.
  $effect(() => {
    const plan = addonPlan;
    const instance = controller.term;
    const shown = visible;
    if (!instance) {
      return;
    }
    untrack(() => {
      const current = controller.addons;
      if (!current) {
        return;
      }
      if (!plan.webgl || shown) {
        void current.setWebgl(plan.webgl);
      }
      void current.setUnicode11(plan.unicode11);
      if (!plan.search) {
        controller.find.close(false);
        current.disposeSearch();
      }
      controller.links.set(instance, plan.fileLinks);
    });
  });

  // Hidden: everything received is acked, so a shell never waits on a view out of sight.
  $effect(() => {
    if (!visible) {
      untrack(() => controller.shell.flushAcks());
    }
  });

  // A bell that rang out of sight is seen once the terminal shows.
  $effect(() => {
    if (visible && terminal.bell) {
      untrack(() => terminalStore.clearBell(terminal.key));
    }
  });

  // Fit when shown or moved between the panel and the editor. The move happens
  // in TerminalHost's effect, so the grid is measured on the next frame, once
  // the element sits in its new place with its new size; the rows are redrawn
  // because the DOM renderer may have skipped frames while detached.
  $effect(() => {
    void placement;
    const instance = controller.term;
    if (!visible || !instance) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      controller.fitNow();
      instance.refresh(0, instance.rows - 1);
    });
    return () => cancelAnimationFrame(frame);
  });

  // An agent's Restart (its tab menu, the AI panel, the strip below): the same view starts it again.
  let restartToken = 0;
  $effect(() => {
    const request = terminalStore.restartRequest;
    if (!request || request.terminalKey !== terminal.key || request.token === restartToken) {
      return;
    }
    restartToken = request.token;
    untrack(() => void controller.retry());
  });

  // Focus on request (panel open, switching to it, opening its tab, a move),
  // as soon as it is on screen.
  $effect(() => {
    const request = terminalStore.focusRequest;
    const instance = controller.term;
    if (!request || request.terminalKey !== terminal.key || !visible || !instance) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      controller.fitNow();
      instance.focus();
    });
    return () => cancelAnimationFrame(frame);
  });

  // A hidden terminal must not keep keyboard focus, or typing would go to its shell unseen.
  $effect(() => {
    if (!visible && root?.contains(document.activeElement)) {
      (document.activeElement as HTMLElement | null)?.blur();
    }
  });

  // A shell that ended with an error stays open with a note; a clean exit closes it.
  // A run always ends with "Process finished with exit code N".
  $effect(() => {
    const instance = controller.term;
    if (!instance || !terminal.exited) {
      return;
    }
    const exitCode = terminal.exitCode;
    const isRun = terminal.location === "run" || Boolean(terminal.agent);
    untrack(() => {
      instance.options.disableStdin = true;
      if (controller.shell.exitShown || (exitCode === 0 && !isRun)) {
        return;
      }
      controller.shell.exitShown = true;
      instance.write(isRun ? runFinishedMessage(exitCode) : exitMessage(exitCode));
    });
  });
</script>

<TerminalScreen
  id={terminalScreenId(terminal.key)}
  hidden={!visible}
  ligatures={settings.terminalLigatures}
  dropTarget={controller.dropOver}
  bell={controller.bellCount}
  status={shell.phase === "failed" ? "failed" : statusLabel ? "starting" : "ready"}
  message={shell.phase === "failed" ? startupFailureTitle(controller.term !== null, shellName) : (statusLabel ?? "")}
  detail={shell.phase === "failed" ? (shell.failure ?? "") : ""}
  bind:element={root}
  onready={(host) => controller.mount(host)}
  onretry={() => void controller.retry()}
  oncontextmenu={(event) => controller.openMenu(event)}
  onfocusin={() => terminalStore.focusPane(terminal.key)}
>
  {#if find.open}
    <TerminalFindBar
      bind:this={findBar}
      query={find.query}
      options={find.options}
      counter={find.counter}
      problem={find.problem}
      onQuery={(query) => find.setQuery(query)}
      onToggle={(option) => find.toggle(option)}
      onPrevious={() => find.run("previous")}
      onNext={() => find.run("next")}
      onClose={() => find.close()}
    />
  {/if}
  {#if shell.phase !== "failed" && !statusLabel && terminal.agent && terminal.exited}
    <CornerCard message="Agent exited">
      {#snippet action()}
        <Button size="small" onclick={() => terminalStore.restartAgent(terminal.key)}>Restart</Button>
      {/snippet}
    </CornerCard>
  {/if}
</TerminalScreen>
