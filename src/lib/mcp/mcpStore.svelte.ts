// The MCP server and command line tool as Settings and Help > Available MCP Tools show them:
// status, the tool list and recent calls, read from the backend on demand. Nothing here polls;
// the lists load when a view that shows them opens.

import { api, errorMessage, onMcpActivity } from "$lib/api";
import type { McpActivity, McpStatus, McpToolInfo } from "$lib/types";
import { dialogs } from "$lib/ui/dialog.svelte";
import { toast } from "$lib/ui/toast.svelte";
import { defaultToolEnabled, UI_TOOLS } from "./toolDefs";

/** As many calls as the backend keeps. */
const MAX_ACTIVITY = 50;

class McpStore {
  status = $state.raw<McpStatus | null>(null);
  /** The backend could not be asked (an older build, or a failed call). */
  statusError = $state<string | null>(null);
  tools = $state.raw<McpToolInfo[]>([]);
  toolsError = $state<string | null>(null);
  activity = $state.raw<McpActivity[]>([]);
  toolsDialogOpen = $state(false);
  /** A token or install change is on its way. */
  working = $state(false);

  /** Pushes the switches, port and tool choices; the server starts, restarts or stops to match. */
  async configure(enabled: boolean, cliEnabled: boolean, port: number, toolStates: Record<string, boolean>): Promise<void> {
    try {
      this.status = await api.mcpConfigure(enabled, cliEnabled, port, toolStates);
      this.statusError = null;
    } catch (error) {
      this.statusError = errorMessage(error);
    }
  }

  async refreshStatus(): Promise<void> {
    try {
      this.status = await api.mcpStatus();
      this.statusError = null;
    } catch (error) {
      this.statusError = errorMessage(error);
    }
  }

  /** Backend and UI tools; without an answer, the UI tools alone so the dialog still lists something. */
  async loadTools(): Promise<void> {
    try {
      this.tools = (await api.mcpTools()) ?? [];
      this.toolsError = null;
    } catch (error) {
      this.toolsError = errorMessage(error);
      this.tools = UI_TOOLS.map((tool) => ({ ...tool, kind: "ui", enabled: defaultToolEnabled(tool) }));
    }
  }

  async loadActivity(): Promise<void> {
    try {
      this.activity = ((await api.mcpActivity()) ?? []).slice(-MAX_ACTIVITY);
    } catch {
      this.activity = [];
    }
  }

  /** Follows new calls while a view shows them; returns the function that stops it. */
  followActivity(): () => void {
    let stopped = false;
    let unlisten: (() => void) | null = null;
    onMcpActivity((entry) => {
      this.activity = [...this.activity, entry].slice(-MAX_ACTIVITY);
    })
      .then((stop) => {
        if (stopped) {
          stop();
        } else {
          unlisten = stop;
        }
      })
      .catch(() => undefined);
    return () => {
      stopped = true;
      unlisten?.();
    };
  }

  async regenerateToken(): Promise<void> {
    const ok = await dialogs.confirm({
      title: "New Token",
      message: "Make a new secret token? Tools connected with the current one stop working until you give them the new one.",
      confirmLabel: "New Token",
      danger: true,
    });
    if (!ok) {
      return;
    }
    await this.change(() => api.mcpRegenerateToken(), "New token made");
  }

  installCli(): Promise<void> {
    return this.change(() => api.cliInstall(), "Installed git-manager in ~/.local/bin");
  }

  uninstallCli(): Promise<void> {
    return this.change(() => api.cliUninstall(), "Removed git-manager from ~/.local/bin");
  }

  private async change(work: () => Promise<McpStatus>, success: string): Promise<void> {
    this.working = true;
    try {
      this.status = await work();
      this.statusError = null;
      toast.success(success);
    } catch (error) {
      toast.error("That did not work", errorMessage(error));
    } finally {
      this.working = false;
    }
  }

  openToolsDialog(): void {
    this.toolsDialogOpen = true;
  }
}

export const mcpStore = new McpStore();
