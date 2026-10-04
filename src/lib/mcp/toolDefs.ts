// The MCP tools the frontend implements ("ui" tools): what the window can do that the backend
// cannot, such as the menus, the open editors, the terminals and UI performance. Sent to the
// backend once at start (mcp_register_ui_tools); handlers.ts runs them. Pure data, so the
// tests can check names, schemas and flags.

import { MENU_ACTIONS } from "$lib/menu/menuIds";
import { MARKDOWN_VIEW_MODES, SETTINGS_SECTIONS } from "$lib/stores/settingsData";
import type { McpToolCategory, McpUiToolDef } from "$lib/types";

export const MCP_CATEGORIES = [
  "Workspace",
  "Git",
  "Files",
  "Search",
  "Scripts",
  "Terminal",
  "App",
  "Performance",
] as const satisfies readonly McpToolCategory[];

/** What show_panel can show: the left sidebar panels, the Log, the Files panel and the bottom panel tabs. */
export const PANELS = ["changes", "branches", "scripts", "log", "files", "terminal", "run", "gitConsole", "shelf"] as const;
export type PanelName = (typeof PANELS)[number];

/** Areas scroll_view can scroll; "auto" is the largest visible scrollable area. */
export const SCROLL_TARGETS = ["auto", "editor", "markdown-preview", "rich-markdown", "log", "diff", "files"] as const;
export type ScrollTarget = (typeof SCROLL_TARGETS)[number];

/** Most text get_editor_text returns by default and at most. */
export const EDITOR_TEXT_DEFAULT_CHARS = 200_000;
export const EDITOR_TEXT_MAX_CHARS = 1_000_000;
/** Longest text send_terminal_text types. */
export const TERMINAL_TEXT_MAX_CHARS = 10_000;
/** Most paths one copy_paths, move_paths or trash_paths call takes. */
export const FILE_TOOL_MAX_PATHS = 1000;

type Schema = Record<string, unknown>;

function objectSchema(properties: Record<string, Schema>, required: string[] = []): Schema {
  return { type: "object", properties, required, additionalProperties: false };
}

const absolutePath = (description: string): Schema => ({ type: "string", description, minLength: 1 });

const filePathList = (description: string): Schema => ({
  type: "array",
  items: { type: "string", minLength: 1 },
  minItems: 1,
  maxItems: FILE_TOOL_MAX_PATHS,
  description,
});

const optionalFilePath = absolutePath(
  "Absolute path of an open file tab, or the untitled: path of a New File tab as get_app_state lists it. Leave out for the tab on screen.",
);

function tool(
  name: string,
  title: string,
  category: McpToolCategory,
  flags: { readOnly: boolean; destructive?: boolean },
  description: string,
  inputSchema: Schema = objectSchema({}),
): McpUiToolDef {
  return { name, title, description, category, readOnly: flags.readOnly, destructive: flags.destructive ?? false, inputSchema };
}

export const UI_TOOLS: McpUiToolDef[] = [
  // App
  tool(
    "get_app_state",
    "Get App State",
    "App",
    { readOnly: true },
    "Describes what the Git Manager window shows now: workspace folders, repositories, the active repository with its branch and change counts, open tabs, panels, terminals, theme and any open dialog. Call it first to see where things stand.",
  ),
  tool(
    "list_menu_commands",
    "List Menu Commands",
    "App",
    { readOnly: true },
    "Lists every command of the app's menu bar with its menu path, shortcut and whether it is enabled, checked or shown right now. Use it to find the action name for run_menu_command.",
  ),
  tool(
    "run_menu_command",
    "Run Menu Command",
    "App",
    { readOnly: false },
    "Runs a menu bar command exactly like a click on it, so every feature in the menus is reachable. Commands that open dialogs or ask for confirmation wait for the user in the app; the call returns right away.",
    objectSchema(
      {
        action: {
          type: "string",
          enum: [...MENU_ACTIONS],
          description: "The menu action, as list_menu_commands names it, for example \"git.fetch\" or \"view.terminal\".",
        },
      },
      ["action"],
    ),
  ),
  tool(
    "show_panel",
    "Show Panel",
    "App",
    { readOnly: true },
    "Shows or hides a part of the window: the Changes, Branches or Scripts sidebar, the Log, the Files panel, or a bottom panel tab (Terminal, Run, Git Console, Shelf).",
    objectSchema(
      {
        panel: { type: "string", enum: [...PANELS], description: "The panel to show or hide." },
        visible: { type: "boolean", description: "False hides the panel. Defaults to true.", default: true },
      },
      ["panel"],
    ),
  ),
  tool(
    "open_settings",
    "Open Settings",
    "App",
    { readOnly: true },
    "Opens the Settings dialog, optionally on one section.",
    objectSchema({
      section: { type: "string", enum: [...SETTINGS_SECTIONS], description: "The section to show. Defaults to Appearance." },
    }),
  ),
  tool(
    "close_dialog",
    "Close Dialog",
    "App",
    { readOnly: true },
    "Closes the dialog or popup on top of the window (Settings, Go to File, a Git dialog...), like pressing Escape. Questions the app asks the user, such as confirmations, are left for the user to answer.",
  ),

  // Workspace
  tool(
    "set_active_repository",
    "Set Active Repository",
    "Workspace",
    { readOnly: true },
    "Makes one of the open repositories the active one, which the Git menu, the Log and the Branches panel act on.",
    objectSchema({ repoPath: absolutePath("Absolute path of the repository root, as get_app_state lists it.") }, ["repoPath"]),
  ),

  // Files
  tool(
    "open_file",
    "Open File",
    "Files",
    { readOnly: true },
    "Opens a file of an open workspace folder in an editor tab and shows it, optionally with the cursor on a line.",
    objectSchema(
      {
        filePath: absolutePath("Absolute path of the file, inside an open workspace folder."),
        line: { type: "integer", minimum: 1, description: "1-based line to put the cursor on." },
        column: { type: "integer", minimum: 1, description: "1-based column on that line. Defaults to 1." },
      },
      ["filePath"],
    ),
  ),
  tool(
    "close_tab",
    "Close Tab",
    "Files",
    { readOnly: true },
    "Closes an editor tab. A tab with unsaved edits is not closed without the user: the app asks them first.",
    objectSchema({ tabPath: absolutePath("The tab's path, as get_app_state lists it under tabs.") }, ["tabPath"]),
  ),
  tool(
    "get_editor_text",
    "Get Editor Text",
    "Files",
    { readOnly: true },
    "Returns the text of an open file tab as the editor holds it, unsaved edits included. Long text is cut at maxChars.",
    objectSchema({
      filePath: optionalFilePath,
      maxChars: {
        type: "integer",
        minimum: 1,
        maximum: EDITOR_TEXT_MAX_CHARS,
        description: `Most characters to return. Defaults to ${EDITOR_TEXT_DEFAULT_CHARS}.`,
      },
    }),
  ),
  tool(
    "get_editor_selection",
    "Get Editor Selection",
    "Files",
    { readOnly: true },
    "Returns the cursor position and selected text of an open file tab, with 1-based lines and columns.",
    objectSchema({ filePath: optionalFilePath }),
  ),
  tool(
    "set_markdown_mode",
    "Set Markdown View",
    "Files",
    { readOnly: true },
    "Shows a Markdown file as source only, source beside its preview, or the preview only.",
    objectSchema(
      {
        mode: { type: "string", enum: [...MARKDOWN_VIEW_MODES], description: "editor, split or preview." },
        filePath: absolutePath("Absolute path of an open Markdown tab. Leave out for the file tab on screen."),
      },
      ["mode"],
    ),
  ),
  tool(
    "save_file",
    "Save File",
    "Files",
    { readOnly: false },
    "Saves the unsaved edits of an open file tab to disk, like File > Save.",
    objectSchema({ filePath: optionalFilePath }),
  ),
  tool(
    "create_file",
    "Create File",
    "Files",
    { readOnly: false },
    "Creates an empty file like New File in the Files panel, with any missing folders on the way, and opens it in a tab. It never replaces a file that exists.",
    objectSchema(
      {
        filePath: absolutePath("Absolute path of the new file, inside an open workspace folder."),
        open: { type: "boolean", description: "Open the new file in a tab. Defaults to true.", default: true },
      },
      ["filePath"],
    ),
  ),
  tool(
    "create_folder",
    "Create Folder",
    "Files",
    { readOnly: false },
    "Creates a folder like New Folder in the Files panel, with any missing folders on the way.",
    objectSchema({ folderPath: absolutePath("Absolute path of the new folder, inside an open workspace folder.") }, ["folderPath"]),
  ),
  tool(
    "rename_path",
    "Rename File or Folder",
    "Files",
    { readOnly: false, destructive: true },
    "Renames a file or folder in place like Rename in the Files panel; open tabs follow it, and a file with unsaved edits is refused. Off until the user turns it on.",
    objectSchema(
      {
        entryPath: absolutePath("Absolute path of the file or folder, inside an open workspace folder."),
        newName: { type: "string", minLength: 1, maxLength: 255, description: "The new name only, without a folder, for example \"basket.ts\"." },
      },
      ["entryPath", "newName"],
    ),
  ),
  tool(
    "copy_paths",
    "Copy Files",
    "Files",
    { readOnly: false },
    "Copies files and folders into a folder like Copy and Paste in the Files panel. A taken name gets a copy name such as \"cart copy.ts\", so nothing is replaced.",
    objectSchema(
      {
        paths: filePathList("Absolute paths of the files and folders to copy, inside open workspace folders."),
        targetFolder: absolutePath("Absolute path of the folder to copy into, inside an open workspace folder."),
      },
      ["paths", "targetFolder"],
    ),
  ),
  tool(
    "move_paths",
    "Move Files",
    "Files",
    { readOnly: false, destructive: true },
    "Moves files and folders into a folder like Cut and Paste in the Files panel; open tabs follow, a taken name stops the move and unsaved edits are refused. Off until the user turns it on.",
    objectSchema(
      {
        paths: filePathList("Absolute paths of the files and folders to move, inside open workspace folders."),
        targetFolder: absolutePath("Absolute path of the folder to move into, inside an open workspace folder."),
      },
      ["paths", "targetFolder"],
    ),
  ),
  tool(
    "trash_paths",
    "Move to Trash",
    "Files",
    { readOnly: false, destructive: true },
    "Moves files and folders to the system Trash like Move to Trash in the Files panel (never deletes them) and closes their tabs; unsaved edits are refused. Off until the user turns it on.",
    objectSchema(
      { paths: filePathList("Absolute paths of the files and folders to move to the Trash, inside open workspace folders.") },
      ["paths"],
    ),
  ),

  // Git
  tool(
    "show_commit",
    "Show Commit in Log",
    "Git",
    { readOnly: true },
    "Opens the Log of a repository on one commit, optionally with one of its files' diff shown.",
    objectSchema(
      {
        repoPath: absolutePath("Absolute path of the repository root."),
        commitId: { type: "string", minLength: 1, maxLength: 256, description: "A commit hash (full or short), branch or tag." },
        filePath: { type: "string", description: "Repository-relative path of a file changed in the commit." },
      },
      ["repoPath", "commitId"],
    ),
  ),
  tool(
    "show_changes_diff",
    "Show Change Diff",
    "Git",
    { readOnly: true },
    "Shows the diff of one changed file in the main area, like a click in the Changes panel.",
    objectSchema(
      {
        repoPath: absolutePath("Absolute path of the repository root."),
        filePath: { type: "string", minLength: 1, description: "Repository-relative path of the changed file." },
        staged: { type: "boolean", description: "True for the staged change, false for the unstaged one. Defaults to false.", default: false },
      },
      ["repoPath", "filePath"],
    ),
  ),

  // Scripts
  tool(
    "list_scripts",
    "List Scripts",
    "Scripts",
    { readOnly: true },
    "Lists the scripts of the workspace folders (package.json, composer.json, Makefile, deno.json, justfile) as the Scripts panel shows them, with the runner and Node version each would use.",
  ),
  tool(
    "run_script",
    "Run Script",
    "Scripts",
    { readOnly: false, destructive: true },
    "Runs a project script in the Run tab exactly like the Scripts panel, with the Node version picked there. Scripts can run any command, so it is off until the user turns it on.",
    objectSchema(
      {
        manifestPath: absolutePath("Absolute path of the package.json, composer.json, Makefile, deno.json or justfile, as list_scripts gives it."),
        scriptName: { type: "string", minLength: 1, description: "The script's name in that file." },
      },
      ["manifestPath", "scriptName"],
    ),
  ),
  tool(
    "stop_run",
    "Stop Run",
    "Scripts",
    { readOnly: false },
    "Stops a script running in the Run tab; its output stays.",
    objectSchema({
      runKey: { type: "integer", minimum: 1, description: "The run session's key from list_terminals. Defaults to the session the Run tab shows." },
    }),
  ),

  // Terminal
  tool(
    "list_terminals",
    "List Terminals",
    "Terminal",
    { readOnly: true },
    "Lists the integrated terminals and Run tab sessions with their key, name, folder, location and whether they still run.",
  ),
  tool(
    "new_terminal",
    "New Terminal",
    "Terminal",
    { readOnly: false },
    "Opens a new integrated terminal with the default shell and returns its key.",
    objectSchema({
      folderPath: absolutePath("Folder to start in, inside an open workspace folder. Defaults to the active repository."),
      location: { type: "string", enum: ["panel", "editor"], description: "The bottom panel (default) or an editor tab." },
    }),
  ),
  tool(
    "send_terminal_text",
    "Send Text to Terminal",
    "Terminal",
    { readOnly: false, destructive: true },
    "Types text into an integrated terminal, pressing Enter after it by default, so it runs commands in that shell. Off until the user turns it on.",
    objectSchema(
      {
        terminalKey: { type: "integer", minimum: 1, description: "The terminal's key from list_terminals or new_terminal." },
        text: { type: "string", maxLength: TERMINAL_TEXT_MAX_CHARS, description: "The text to type." },
        pressEnter: { type: "boolean", description: "Press Enter after the text. Defaults to true.", default: true },
      },
      ["terminalKey", "text"],
    ),
  ),

  // Performance
  tool(
    "get_ui_performance",
    "Get UI Performance",
    "Performance",
    { readOnly: true },
    "Measures the window: DOM element counts for the page and each main area, open tabs, mounted editors, terminals, drawn Markdown diagrams, long tasks since the last call and frame timing over a short sample. Pair it with the backend's memory tool.",
    objectSchema({
      sampleMs: {
        type: "integer",
        minimum: 0,
        maximum: 5000,
        description: "How long to sample frame timing, in milliseconds. Defaults to 500; 0 skips it.",
      },
    }),
  ),
  tool(
    "inspect_elements",
    "Inspect Elements",
    "Performance",
    { readOnly: true },
    "Finds elements in the app window by CSS selector and returns, for each (up to limit), its tag, classes, text start, position and size on screen, whether it is visible, and the computed styles asked for. For debugging what the user sees (colors, layout, what is drawn).",
    objectSchema(
      {
        selector: { type: "string", minLength: 1, maxLength: 500, description: "A CSS selector, e.g. .cm-selectionBackground or .cm-editor .cm-activeLine." },
        styles: {
          type: "array",
          items: { type: "string", maxLength: 60 },
          maxItems: 30,
          description: "Computed style properties to read, e.g. [\"background-color\", \"z-index\", \"opacity\"].",
        },
        limit: { type: "integer", minimum: 1, maximum: 100, description: "At most this many elements (default 20)." },
      },
      ["selector"],
    ),
  ),
  tool(
    "scroll_view",
    "Scroll View",
    "Performance",
    { readOnly: true },
    "Scrolls a visible area from top to bottom and back like a fast user, then reports the duration and dropped frames. Sample memory meanwhile to measure scrolling cost.",
    objectSchema(
      {
        target: { type: "string", enum: [...SCROLL_TARGETS], description: "The area to scroll; auto picks the largest visible scrollable area." },
        speed: {
          type: "integer",
          minimum: 5,
          maximum: 2000,
          description: "Pixels per frame. Defaults to 80.",
        },
        rounds: { type: "integer", minimum: 1, maximum: 10, description: "Top-to-bottom-and-back passes. Defaults to 1." },
      },
      ["target"],
    ),
  ),
];

/** Every tool is on unless it is destructive; the user's choices change that. */
/** The backend says so for its tools (clone_repository starts off); a UI tool is on unless destructive. */
export function defaultToolEnabled(tool: { destructive: boolean; defaultEnabled?: boolean }): boolean {
  return tool.defaultEnabled ?? !tool.destructive;
}
