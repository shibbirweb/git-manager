#!/usr/bin/env bun
/**
 * Regenerates every wiki screenshot in docs/wiki/images. Each shot is a define() call below, named
 * after its image; docs/wiki/features.json assigns the images to features and pages.
 *
 * How it works: a WebKit page (Playwright) opens the dev server with `?ipc-bridge`. The page mocks
 * Tauri's IPC and relays every command to the running app, which runs it with the real Rust backend
 * and real git (see src/lib/dev/ipcBridge.ts). The page answers a few commands itself so nothing
 * touches your own setup: settings and state live in memory, the launch mode points at the demo
 * workspace, and OS dialogs, the opener and window commands never reach the app. Any other command
 * with an absolute path outside the demo folder is refused.
 *
 * Every run rebuilds the demo in /tmp/gitmanager-docs with scripts/make-docs-demo.sh, so paths in the
 * UI are stable and nothing from an earlier run leaks into the next.
 *
 * Prerequisites:
 *   GM_IPC_BRIDGE=1 bun tauri dev      the app, with the bridge on, left running in another terminal
 *   bunx --bun playwright install webkit   once, for the browser engine
 *
 * Usage:
 *   bun scripts/screenshots.ts                 regenerate every screenshot
 *   bun scripts/screenshots.ts merge-tool blame-gutter.png   only these (with or without .png)
 *   bun scripts/screenshots.ts --list          print the screenshot names
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, realpathSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type Browser, type BrowserContext, type Locator, type Page, webkit } from "playwright";

const PROJECT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(PROJECT, "docs/wiki/images");
const DEMO_DIR = "/tmp/gitmanager-docs";
const DEV_SERVER = "http://127.0.0.1:1420";
const VIEWPORT = { width: 1280, height: 800 };
const SCALE = 2;

// Filled in by buildDemo(); macOS resolves /tmp to /private/tmp, so these are the real paths.
let demo = DEMO_DIR;
let acme = "";
let storefront = "";
let paymentsApi = "";
let designSystem = "";
let notes = "";

const appVersion = /^version\s*=\s*"([^"]+)"/m.exec(readFileSync(join(PROJECT, "src-tauri/Cargo.toml"), "utf8"))?.[1] ?? "0.0.0";

// ---------------------------------------------------------------------------------------------
// Scenario: what the page answers itself

interface Scenario {
  /** get_launch_mode; defaults to the acme workspace. */
  launch?: Record<string, unknown>;
  /** settings.json contents (preferences). */
  settings?: Record<string, unknown>;
  /** state.json contents, merged over the defaults below. */
  state?: Record<string, unknown>;
  colorScheme?: "light" | "dark";
  /** What the GitHub releases API answers. */
  releases?: unknown[];
  /** What a folder picker returns. */
  dialogFolder?: string | null;
  /** Answer load_mergetool with a real load_conflict of this file. */
  mergetool?: { repoPath: string; conflictPath: string };
  /** Let Playwright control timers, for the delayed update check. */
  clock?: boolean;
  /** Hold a fetch this long before running it, to catch the busy state. */
  holdFetchMs?: number;
  /** A smaller window, for shots of one panel that would otherwise be mostly empty. */
  viewport?: { width: number; height: number };
  /** load_config("state") fails with this message, like a state.json with a typo. */
  stateLoadError?: string;
}

interface PageConfig {
  launch: Record<string, unknown>;
  settings: Record<string, unknown>;
  state: Record<string, unknown>;
  dialogFolder: string | null;
  mergetool: { repoPath: string; conflictPath: string } | null;
  holdFetchMs: number;
  stateLoadError: string | null;
  allowedRoot: string;
}

function workspaceLaunch(): Record<string, unknown> {
  return { mode: "app", repoPath: acme };
}

function defaultState(): Record<string, unknown> {
  return {
    lastRunVersion: appVersion,
    // The acme workspace opens on storefront.
    activeRepos: { [acme]: storefront },
    explorerOpen: true,
    leftPanel: "changes",
    sidebarWidth: 300,
    explorerWidth: 250,
  };
}

function pageConfig(scenario: Scenario): PageConfig {
  return {
    launch: scenario.launch ?? workspaceLaunch(),
    settings: scenario.settings ?? {},
    state: { ...defaultState(), ...(scenario.state ?? {}) },
    dialogFolder: scenario.dialogFolder ?? null,
    mergetool: scenario.mergetool ?? null,
    holdFetchMs: scenario.holdFetchMs ?? 0,
    stateLoadError: scenario.stateLoadError ?? null,
    allowedRoot: demo,
  };
}

/** Runs in the page before the app: installs the overrides and a gate in front of Tauri's invoke. */
function installOverrides(config: PageConfig): void {
  type Handler = (args: unknown) => unknown;
  type Invoke = (cmd: string, args?: unknown, options?: unknown) => Promise<unknown>;
  const store: Record<string, unknown> = { settings: config.settings, state: config.state };
  const overrides: Record<string, Handler> = {
    load_config: (args) => {
      const { configName } = args as { configName: string };
      if (configName === "state" && config.stateLoadError) {
        // Shaped like the backend's AppError for a file that is not valid JSON.
        throw { kind: "invalid", message: config.stateLoadError };
      }
      return structuredClone(store[configName] ?? {});
    },
    save_config: (args) => {
      const { configName, value } = args as { configName: string; value: unknown };
      store[configName] = value;
      return null;
    },
    config_dir: () => "/Users/you/.gitmanager",
    get_launch_mode: () => config.launch,
    save_mergetool: () => null,
    cancel_mergetool: () => null,
    "plugin:dialog|open": () => config.dialogFolder,
  };
  const target = config.mergetool;
  if (target) {
    // A real mergetool launch labels the panes from git's LOCAL and REMOTE files, not the branches.
    overrides.load_mergetool = async (args) => ({
      ...((await internals.invoke("load_conflict", {
        repoPath: target.repoPath,
        conflictPath: target.conflictPath,
        ignoreWhitespace: (args as { ignoreWhitespace?: boolean }).ignoreWhitespace ?? false,
      })) as Record<string, unknown>),
      oursLabel: "Local (yours)",
      theirsLabel: "Remote (theirs)",
    });
  }
  if (config.holdFetchMs > 0) {
    // Holds the first fetch in the page for a moment so the header's busy state can be photographed;
    // the fetch itself still runs for real afterwards.
    overrides.fetch_all = async (args) => {
      await new Promise((resolve) => setTimeout(resolve, config.holdFetchMs));
      delete overrides.fetch_all;
      return internals.invoke("fetch_all", args);
    };
  }
  const shots = { pending: 0, blocked: [] as string[], inflight: {} as Record<string, number> };
  const blockedPrefixes = ["plugin:dialog|", "plugin:opener|", "plugin:window|", "plugin:webview|", "plugin:process|"];
  let inner: Invoke | null = null;

  async function gate(cmd: string, args?: unknown, options?: unknown): Promise<unknown> {
    if (!(cmd in overrides)) {
      if (blockedPrefixes.some((prefix) => cmd.startsWith(prefix))) {
        shots.blocked.push(cmd);
        return null;
      }
      // Never let a command reach a real repository: every path argument must be in the demo.
      // Exact folder or below it: a bare prefix would also let a sibling like /tmp/gitmanager-docs-x through.
      const inside = (value: string) => value === config.allowedRoot || value.startsWith(`${config.allowedRoot.replace(/\/+$/, "")}/`);
      const outside = pathArguments(args).find((value) => value.startsWith("/") && !inside(value));
      if (outside) {
        shots.blocked.push(`${cmd} ${outside}`);
        throw { kind: "blocked", message: `screenshots.ts refused ${cmd} on ${outside}` };
      }
    }
    if (!inner) {
      throw { kind: "blocked", message: "IPC is not ready" };
    }
    shots.pending++;
    shots.inflight[cmd] = (shots.inflight[cmd] ?? 0) + 1;
    try {
      return await inner(cmd, args, options);
    } finally {
      shots.pending--;
      shots.inflight[cmd]--;
    }
  }

  /** Values of arguments named like paths (repoPath, filePaths, workspaceRoot, ...), not file contents. */
  function pathArguments(args: unknown): string[] {
    const found: string[] = [];
    if (!args || typeof args !== "object") {
      return found;
    }
    for (const [key, value] of Object.entries(args as Record<string, unknown>)) {
      if (!/(path|root|dir|folder)s?$/i.test(key)) {
        continue;
      }
      for (const item of Array.isArray(value) ? value : [value]) {
        if (typeof item === "string") {
          found.push(item);
        }
      }
    }
    return found;
  }

  const internals = {} as { invoke: Invoke };
  Object.defineProperty(internals, "invoke", {
    configurable: true,
    enumerable: true,
    get: () => gate,
    set: (value: Invoke) => {
      inner = value;
    },
  });
  const page = window as unknown as Record<string, unknown>;
  page.__GM_IPC_OVERRIDES__ = overrides;
  page.__GM_SHOTS__ = shots;
  page.__TAURI_INTERNALS__ = internals;
}

// ---------------------------------------------------------------------------------------------
// Demo data

function buildDemo(): void {
  rmSync(DEMO_DIR, { recursive: true, force: true });
  execFileSync("bash", [join(PROJECT, "scripts/make-docs-demo.sh"), DEMO_DIR], { stdio: ["ignore", "ignore", "inherit"] });
  demo = realpathSync(DEMO_DIR);
  acme = join(demo, "acme");
  storefront = join(acme, "storefront");
  paymentsApi = join(acme, "payments-api");
  notes = join(acme, "notes");
  designSystem = join(demo, "design-system");
}

function githubReleases(): unknown[] {
  const release = (version: string, prerelease: boolean, daysAgo: number, body: string) => ({
    tag_name: `v${version}`,
    name: `Git Manager ${version}`,
    body,
    html_url: `https://github.com/shibbirweb/git-manager/releases/tag/v${version}`,
    published_at: new Date(Date.now() - daysAgo * 86400000).toISOString(),
    prerelease,
    draft: false,
    assets: [
      {
        name: `Git.Manager_${version}_aarch64.dmg`,
        browser_download_url: `https://github.com/shibbirweb/git-manager/releases/download/v${version}/Git.Manager_${version}_aarch64.dmg`,
      },
    ],
  });
  return [
    release(
      "0.1.0",
      false,
      1,
      [
        "### Added",
        "",
        "- Stage single lines from the side-by-side diff, not only whole hunks.",
        "- The Log remembers its filter per repository.",
        "",
        "### Changed",
        "",
        "- The merge tool scrolls all three panes together more smoothly on long files.",
        "",
        "### Fixed",
        "",
        "- Blame no longer shows a stale author after you save a file.",
        "- Pushing a new branch sets its upstream the first time.",
      ].join("\n"),
    ),
    release(
      "0.1.0-beta.2",
      true,
      8,
      ["### Fixed", "", "- The Files panel keeps its scroll position when a repository refreshes."].join("\n"),
    ),
    release("0.1.0-beta.1", true, 20, "### Added\n\n- First beta."),
  ];
}

// ---------------------------------------------------------------------------------------------
// Page helpers

class Shot {
  constructor(
    readonly page: Page,
    readonly name: string,
    readonly viewport: { width: number; height: number },
  ) {}

  /** Waits until no relayed command is in flight for a moment, then for two frames. */
  async settle(quietMs = 350): Promise<void> {
    const deadline = Date.now() + 20000;
    let quietSince = Date.now();
    for (;;) {
      if (Date.now() >= deadline) {
        const inflight = await this.page.evaluate(
          () => (window as unknown as { __GM_SHOTS__: { inflight: Record<string, number> } }).__GM_SHOTS__.inflight,
        );
        const names = Object.entries(inflight).filter((entry) => entry[1] > 0).map((entry) => entry[0]);
        console.warn(`  ${this.name}: still waiting on ${names.join(", ")}`);
        break;
      }
      const pending = await this.page.evaluate(() => (window as unknown as { __GM_SHOTS__: { pending: number } }).__GM_SHOTS__.pending);
      if (pending > 0) {
        quietSince = Date.now();
      } else if (Date.now() - quietSince >= quietMs) {
        break;
      }
      await this.page.waitForTimeout(50);
    }
    await this.page.evaluate(
      () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
    );
  }

  /** A row of the Files panel, by its absolute path (the row's title). */
  fileRow(absolutePath: string): Locator {
    return this.page.locator(`aside.explorer [role="treeitem"][title="${absolutePath}"]`);
  }

  /** Expands folders in the Files panel, top down. */
  async expand(...absolutePaths: string[]): Promise<void> {
    for (const absolutePath of absolutePaths) {
      const row = this.fileRow(absolutePath);
      await row.waitFor();
      if ((await row.getAttribute("aria-expanded")) === "false") {
        await row.click();
        await this.settle();
      }
    }
  }

  /** Opens a file from the Files panel: double-click keeps it, a single click previews it. */
  async openFile(absolutePath: string, options: { preview?: boolean } = {}): Promise<void> {
    const root = absolutePath.startsWith(`${designSystem}/`) ? designSystem : acme;
    const segments = absolutePath.slice(root.length + 1).split("/");
    const folders = segments.slice(0, -1).map((_, index) => join(root, ...segments.slice(0, index + 1)));
    await this.expand(...folders);
    const row = this.fileRow(absolutePath);
    if (options.preview) {
      await row.click();
    } else {
      await row.dblclick();
    }
    await this.editorReady();
  }

  /** The visible editor has rendered its text. */
  async editorReady(): Promise<void> {
    await this.page.locator(".file-host:not(.hidden) .cm-content .cm-line").first().waitFor();
    await this.settle();
  }

  /** The visible file editor's line that contains this text. */
  editorLine(text: string): Locator {
    return this.page.locator(".file-host:not(.hidden) .cm-content .cm-line", { hasText: text }).first();
  }

  menu(): Locator {
    return this.page.locator('.menu[role="menu"]');
  }

  async closeMenu(): Promise<void> {
    if (await this.menu().isVisible()) {
      await this.page.keyboard.press("Escape");
      await this.menu().waitFor({ state: "hidden" });
    }
  }

  async activateRepo(repoName: string): Promise<void> {
    await this.page.locator('header button[title^="Active repository:"]').click();
    await this.menu().getByRole("menuitem", { name: new RegExp(`^\\S*\\s*${repoName}\\b`) }).click();
    await this.settle();
  }

  async showLog(): Promise<void> {
    await this.page.getByRole("button", { name: "Log", exact: true }).click();
    await this.page.locator('[aria-label="Commits"]').waitFor();
    await this.settle();
  }

  /** Dismisses toasts that report success; any error toast fails the shot. */
  async clearToasts(): Promise<void> {
    const toasts = this.page.locator(".toasts .toast");
    const errors = await this.page.locator(".toasts .toast.error").allInnerTexts();
    if (errors.length > 0) {
      throw new Error(`${this.name}: error toast on screen: ${errors.join(" | ").replace(/\s+/g, " ")}`);
    }
    while ((await toasts.count()) > 0) {
      await toasts.first().getByRole("button", { name: "Dismiss" }).click();
    }
  }

  /** Union of the elements' boxes plus padding, kept inside the window. */
  async clipAround(targets: Locator[], padding: number | { top?: number; right?: number; bottom?: number; left?: number } = 0) {
    const pad = typeof padding === "number" ? { top: padding, right: padding, bottom: padding, left: padding } : padding;
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    for (const target of targets) {
      const box = await target.boundingBox();
      if (!box) {
        throw new Error(`${this.name}: an element to clip is not visible`);
      }
      left = Math.min(left, box.x);
      top = Math.min(top, box.y);
      right = Math.max(right, box.x + box.width);
      bottom = Math.max(bottom, box.y + box.height);
    }
    left = Math.max(0, Math.floor(left - (pad.left ?? 0)));
    top = Math.max(0, Math.floor(top - (pad.top ?? 0)));
    right = Math.min(this.viewport.width, Math.ceil(right + (pad.right ?? 0)));
    bottom = Math.min(this.viewport.height, Math.ceil(bottom + (pad.bottom ?? 0)));
    return { x: left, y: top, width: right - left, height: bottom - top };
  }

  /** The top of a panel, down to just below the lowest of `contents`. */
  async clipPanel(panel: Locator, contents: Locator[], paddingBottom = 16) {
    const box = await panel.boundingBox();
    if (!box) {
      throw new Error(`${this.name}: the panel is not visible`);
    }
    let bottom = box.y;
    for (const content of contents) {
      const contentBox = await content.boundingBox();
      if (!contentBox) {
        throw new Error(`${this.name}: an element to clip is not visible`);
      }
      bottom = Math.max(bottom, contentBox.y + contentBox.height);
    }
    const height = Math.min(box.height, Math.ceil(bottom + paddingBottom - box.y));
    return { x: Math.floor(box.x), y: Math.floor(box.y), width: Math.ceil(box.width), height };
  }

  /** Saves the window, a clip of it, or one element. */
  async save(
    target?: Locator | { x: number; y: number; width: number; height: number },
    options: { scale?: "css" | "device"; settle?: boolean } = {},
  ): Promise<void> {
    if (options.settle !== false) {
      await this.settle();
    }
    await this.clearToasts();
    const blocked = await this.page.evaluate(() => (window as unknown as { __GM_SHOTS__: { blocked: string[] } }).__GM_SHOTS__.blocked);
    const unexpected = blocked.filter((entry) => !entry.startsWith("plugin:window|"));
    if (unexpected.length > 0) {
      console.warn(`  ${this.name}: blocked ${unexpected.join(", ")}`);
    }
    const path = join(OUT_DIR, `${this.name}.png`);
    const scale = options.scale ?? "device";
    if (target && "screenshot" in target) {
      await target.screenshot({ path, scale, animations: "disabled" });
    } else {
      await this.page.screenshot({ path, clip: target, scale, animations: "disabled" });
    }
  }
}

async function openApp(browser: Browser, name: string, scenario: Scenario): Promise<{ context: BrowserContext; shot: Shot }> {
  const viewport = scenario.viewport ?? VIEWPORT;
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: SCALE,
    colorScheme: scenario.colorScheme ?? "light",
  });
  const releases = scenario.releases ?? [];
  await context.route("https://api.github.com/**", (route) => route.fulfill({ json: releases }));
  const page = await context.newPage();
  page.on("pageerror", (error) => console.warn(`  ${name}: page error: ${error.message}`));
  if (scenario.clock) {
    await page.clock.install();
  }
  await page.addInitScript(installOverrides, pageConfig(scenario));
  await page.goto(`${DEV_SERVER}/?ipc-bridge`);
  const shot = new Shot(page, name, viewport);
  const ready = page.locator(".workspace, .welcome, .mergetool").first();
  try {
    await ready.waitFor({ timeout: 20000 });
  } catch {
    throw new Error("The app did not answer through the bridge. Is `GM_IPC_BRIDGE=1 bun tauri dev` running?");
  }
  await shot.settle(500);
  if (await page.locator("aside.explorer").isVisible()) {
    // The Files panel lists the workspace once the first directory listing is back.
    await page.locator('aside.explorer [role="treeitem"]').first().waitFor();
    await shot.settle();
  }
  return { context, shot };
}

// ---------------------------------------------------------------------------------------------
// Screenshots

interface ShotSpec {
  name: string;
  scenario?: () => Scenario;
  run: (shot: Shot) => Promise<void>;
}

const shots: ShotSpec[] = [];

function define(name: string, run: (shot: Shot) => Promise<void>, scenario?: () => Scenario): void {
  shots.push({ name, run, scenario });
}

const cartTs = () => join(storefront, "src/cart.ts");
const appTs = () => join(paymentsApi, "src/app.ts");

/** Collapses a repository in the Changes sidebar so the next one has room. */
async function collapseRepo(shot: Shot, repoName: string): Promise<void> {
  const toggle = shot.page.getByRole("group", { name: repoName, exact: true }).locator("button.repo-toggle");
  if ((await toggle.getAttribute("aria-expanded")) === "true") {
    await toggle.click();
    await shot.settle();
  }
}

/**
 * Puts the cursor at the start of the line with this text. Scrolls with the wheel and clicks by
 * coordinates: a CodeMirror line is as wide as the longest one, and Playwright would otherwise
 * scroll the editor sideways to reach the middle of it.
 */
async function clickLine(shot: Shot, text: string): Promise<void> {
  const scroller = shot.page.locator(".file-host:not(.hidden) .cm-scroller");
  const area = await scroller.boundingBox();
  if (!area) {
    throw new Error(`${shot.name}: no editor on screen`);
  }
  let box = null;
  for (let attempt = 0; attempt < 20; attempt++) {
    const line = shot.editorLine(text);
    if ((await line.count()) > 0) {
      box = await line.boundingBox();
      if (box && box.y >= area.y + 24 && box.y + box.height <= area.y + area.height - 60) {
        break;
      }
    }
    await shot.page.mouse.move(area.x + area.width / 2, area.y + area.height / 2);
    await shot.page.mouse.wheel(0, box && box.y < area.y + 24 ? -200 : 200);
    await shot.settle(150);
    box = null;
  }
  if (!box) {
    throw new Error(`${shot.name}: line "${text}" not found`);
  }
  await shot.page.mouse.click(box.x + 3, box.y + box.height / 2);
  await shot.settle();
}

/** The everyday window: storefront's changes, cart.ts open with the cursor on a changed line. */
async function overview(shot: Shot): Promise<void> {
  await collapseRepo(shot, "payments-api");
  await shot.openFile(cartTs());
  await clickLine(shot, "setQuantity(productId");
}

/** The Log gets the whole width: sidebar and Files panel hidden. */
function logScenario(): Scenario {
  return { state: { leftPanel: null, explorerOpen: false } };
}

function branchesScenario(): Scenario {
  return { state: { sidebarWidth: 340 } };
}

async function openBranches(shot: Shot): Promise<void> {
  await shot.page.getByRole("button", { name: "Branches and Stashes" }).click();
  await shot.page.getByRole("tree", { name: "Branches, tags and stashes" }).waitFor();
  await shot.settle();
}

function sidebarRow(shot: Shot, text: string | RegExp): Locator {
  return shot.page.locator(".sidebar-row", { hasText: text }).first();
}

function commitRow(shot: Shot, summary: string): Locator {
  return shot.page.locator('[aria-label="Commits"] [role="option"]', { hasText: summary }).first();
}

async function openSettings(shot: Shot, section: string): Promise<Locator> {
  await shot.page.getByRole("button", { name: "Settings", exact: true }).click();
  const dialog = shot.page.getByRole("dialog");
  await dialog.waitFor();
  await dialog.getByRole("navigation", { name: "Settings sections" }).getByRole("button", { name: section, exact: true }).click();
  await shot.settle();
  return dialog;
}

async function openConflictsDialog(shot: Shot): Promise<Locator> {
  await shot.activateRepo("payments-api");
  await shot.page.getByRole("button", { name: "Resolve Conflicts...", exact: true }).click();
  const dialog = shot.page.getByRole("dialog");
  await dialog.locator(".row.item").first().waitFor();
  await shot.settle();
  return dialog;
}

async function openMergeTool(shot: Shot): Promise<void> {
  const dialog = await openConflictsDialog(shot);
  await dialog.locator(".row.item", { hasText: "app.ts" }).first().click();
  await dialog.getByRole("button", { name: "Merge...", exact: true }).click();
  await shot.page.locator(".cm-editor").nth(2).waitFor();
  await shot.settle(600);
}

define("welcome", async (shot) => {
  // Close the folder like a user would; the Welcome screen then lists what was opened before.
  await shot.page.locator("header .pill").first().click();
  await shot.menu().getByRole("menuitem", { name: "Close Folder" }).click();
  await shot.page.locator(".welcome").waitFor();
  await shot.save();
}, () => ({
  state: {
    recentFolders: [designSystem, storefront, paymentsApi],
    recentWorkspaces: [[acme, designSystem]],
  },
}));

define("window-overview", async (shot) => {
  await overview(shot);
  await shot.save();
});

define("workspace-folders", async (shot) => {
  await shot.page.getByRole("button", { name: "Add folder to workspace" }).click();
  await shot.fileRow(designSystem).waitFor();
  await shot.settle();
  await shot.expand(join(designSystem, "tokens"));
  await shot.page.mouse.move(640, 400);
  const explorer = shot.page.locator("aside.explorer");
  await shot.save(await shot.clipPanel(explorer, [explorer.locator('[role="treeitem"]').last()], 24));
}, () => ({ dialogFolder: designSystem }));

define("repository-switcher", async (shot) => {
  // The menu opens where the pill is clicked; click near its bottom edge so the pill stays visible.
  const pill = shot.page.locator('header button[title^="Active repository:"]');
  const pillBox = await pill.boundingBox();
  await pill.click({ position: { x: 12, y: (pillBox?.height ?? 28) - 3 } });
  await shot.menu().waitFor();
  await shot.page.mouse.move(640, 600);
  await shot.save(await shot.clipAround([shot.page.locator("header .left"), shot.menu()], { top: 0, left: 0, right: 40, bottom: 24 }));
});

define("init-repository", async (shot) => {
  await shot.fileRow(notes).click({ button: "right" });
  await shot.menu().waitFor();
  const explorer = shot.page.locator("aside.explorer");
  const panel = await shot.clipPanel(explorer, [shot.menu()], 24);
  const across = await shot.clipAround([explorer, shot.menu()], { right: 12 });
  await shot.save({ x: across.x, width: across.width, y: panel.y, height: panel.height });
});

define("files-panel", async (shot) => {
  await shot.expand(storefront, join(storefront, "src"));
  await shot.page.mouse.move(640, 400);
  const explorer = shot.page.locator("aside.explorer");
  await shot.save(await shot.clipPanel(explorer, [explorer.locator('[role="treeitem"]').last()], 24));
});

define("files-context-menu", async (shot) => {
  await shot.expand(storefront, join(storefront, "src"));
  await shot.fileRow(cartTs()).click({ button: "right" });
  await shot.menu().waitFor();
  const explorer = shot.page.locator("aside.explorer");
  const panel = await shot.clipPanel(explorer, [shot.menu(), explorer.locator('[role="treeitem"]').last()], 24);
  const across = await shot.clipAround([explorer, shot.menu()], { right: 12 });
  await shot.save({ x: across.x, width: across.width, y: panel.y, height: panel.height });
});

define("editor-tabs", async (shot) => {
  await shot.openFile(join(storefront, "README.md"));
  await shot.openFile(join(storefront, "src/catalog.ts"));
  await shot.openFile(cartTs());
  // A single click opens a preview tab, shown in italics until it is kept.
  await shot.openFile(join(storefront, "src/pricing.ts"), { preview: true });
  await shot.page.mouse.move(640, 700);
  const main = shot.page.locator("main.main");
  const box = await main.boundingBox();
  if (!box) {
    throw new Error("editor-tabs: no editor area");
  }
  await shot.save({ x: box.x, y: box.y, width: box.width, height: 330 });
});

define("unsaved-changes-close", async (shot) => {
  await shot.openFile(cartTs());
  await clickLine(shot, "setQuantity(productId");
  await shot.page.keyboard.type("// Quantities below one remove the line.\n");
  await shot.page.locator(".file-host:not(.hidden) .badge.unsaved").waitFor();
  await shot.page.locator("header .pill").first().click();
  await shot.menu().getByRole("menuitem", { name: "Close Folder" }).click();
  const dialog = shot.page.getByRole("dialog", { name: "Unsaved Changes" });
  await dialog.waitFor();
  await shot.page.mouse.move(5, 790);
  await shot.save(dialog);
  // Keep the edit: the folder stays open with the tab still unsaved.
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  await shot.page.locator(".file-host:not(.hidden) .badge.unsaved").waitFor();
}, () => ({ settings: { currentLineBlame: false } }));

define("editor-change-markers", async (shot) => {
  await shot.openFile(cartTs());
  await clickLine(shot, "useDiscount(code");
  await shot.save(shot.page.locator("main.main"));
}, () => ({ settings: { currentLineBlame: false } }));

define("changes-sidebar", async (shot) => {
  await collapseRepo(shot, "payments-api");
  await shot.page.mouse.move(640, 300);
  await shot.save(shot.page.locator("aside.sidebar"));
}, () => ({ viewport: { width: 1280, height: 560 } }));

define("commit-box", async (shot) => {
  await collapseRepo(shot, "payments-api");
  const message = shot.page.getByRole("textbox", { name: "Commit message" });
  await message.click();
  await shot.page.keyboard.type("Cart: set line quantities\n\nZero removes the line, and totals never go below zero.");
  await shot.save(shot.page.locator(".commit-box"));
});

define("diff-view", async (shot) => {
  await collapseRepo(shot, "payments-api");
  // More room for the two sides.
  await shot.page.getByRole("button", { name: "Hide files" }).click();
  await shot.page.getByRole("group", { name: "storefront", exact: true }).getByRole("group", { name: "Changes" }).getByText("cart.ts").click();
  await shot.page.locator(".diff-view .cm-mergeView, .diff-view .cm-merge-a").first().waitFor();
  await shot.settle(500);
  // Hovering a changed block shows its stage button more clearly.
  await shot.page.locator(".diff-view .diff-revert").first().hover();
  await shot.save();
});

define("operation-banner", async (shot) => {
  await shot.activateRepo("payments-api");
  const banner = shot.page.getByRole("button", { name: "Abort", exact: true });
  await banner.waitFor();
  await shot.page.mouse.move(640, 500);
  await shot.save(await shot.clipAround([shot.page.locator("header.header"), shot.page.locator(".workspace > .banner")]));
});

define("conflicts-dialog", async (shot) => {
  const dialog = await openConflictsDialog(shot);
  await dialog.locator(".row.item", { hasText: "app.ts" }).first().click();
  await shot.page.mouse.move(5, 790);
  await shot.save(dialog);
});

define("inline-conflict-actions", async (shot) => {
  await shot.activateRepo("payments-api");
  await shot.openFile(appTs());
  // With the Files panel open the bar wraps, so the counter shows on its second line.
  await shot.page.locator(".cm-conflict-actions .cm-conflict-count").first().waitFor();
  await shot.settle();
  await shot.page.mouse.move(640, 790);
  await shot.save(shot.page.locator("main.main"));
}, () => ({ settings: { currentLineBlame: false } }));

define("merge-tool", async (shot) => {
  await openMergeTool(shot);
  await shot.page.mouse.move(640, 790);
  await shot.save();
});

define("merge-tool-resolved", async (shot) => {
  await openMergeTool(shot);
  await shot.page.getByTitle("Apply all non-conflicting changes", { exact: true }).click();
  await shot.settle(600);
  await shot.page.mouse.move(640, 790);
  await shot.save();
});

define("blame-inline", async (shot) => {
  await shot.openFile(cartTs());
  // Room for the whole annotation.
  await shot.page.getByRole("button", { name: "Hide files" }).click();
  await shot.settle();
  await clickLine(shot, "useDiscount(code");
  const line = shot.editorLine("useDiscount(code");
  await line.locator(".cm-inline-blame").waitFor();
  const editor = shot.page.locator(".file-host:not(.hidden) .cm-editor");
  const lineBox = await line.boundingBox();
  const editorBox = await editor.boundingBox();
  if (!lineBox || !editorBox) {
    throw new Error("blame-inline: editor not visible");
  }
  const height = 240;
  const top = Math.max(editorBox.y, Math.min(lineBox.y - 110, editorBox.y + editorBox.height - height));
  await shot.save({ x: editorBox.x, y: top, width: editorBox.width, height });
});

define("blame-gutter", async (shot) => {
  await shot.openFile(cartTs());
  await shot.page.getByRole("toolbar", { name: "File actions" }).getByRole("button", { name: "Blame" }).click();
  await shot.page.locator(".file-host:not(.hidden) .cm-blame-gutter .cm-blame-cell", { hasText: "Maya Chen" }).first().waitFor();
  await shot.settle(500);
  await shot.page.mouse.move(640, 790);
  await shot.save(shot.page.locator("main.main"));
}, () => ({ settings: { currentLineBlame: false } }));

define("log-graph", async (shot) => {
  await shot.showLog();
  await shot.page.mouse.move(640, 790);
  await shot.save();
}, logScenario);

define("commit-details", async (shot) => {
  await shot.showLog();
  await commitRow(shot, "Cart: discount codes and totals").click();
  const files = shot.page.locator(".log-view").getByRole("listbox", { name: "Changed files" });
  await files.waitFor();
  await files.getByText("cart.ts").first().click();
  await shot.page.locator(".log-view .cm-editor").first().waitFor();
  await shot.settle(500);
  await shot.page.mouse.move(640, 790);
  await shot.save();
}, logScenario);

define("commit-tab", async (shot) => {
  await shot.showLog();
  await commitRow(shot, "Cart: discount codes and totals").dblclick();
  const tab = shot.page.locator(".commit-tab");
  await tab.getByRole("listbox", { name: "Changed files" }).waitFor();
  await tab.locator(".cm-editor").first().waitFor();
  await shot.settle(500);
  await shot.page.mouse.move(640, 790);
  await shot.save();
}, logScenario);

define("log-context-menu", async (shot) => {
  await shot.showLog();
  await commitRow(shot, "Cart: discount codes and totals").click({ button: "right" });
  await shot.menu().waitFor();
  const list = shot.page.locator('[aria-label="Commits"]');
  const across = await shot.clipAround([list], 0);
  const down = await shot.clipAround([shot.menu(), commitRow(shot, "Cart: discount codes and totals")], { top: 70, bottom: 24 });
  await shot.save({ x: across.x, width: across.width, y: down.y, height: down.height });
}, logScenario);

define("branches-panel", async (shot) => {
  await openBranches(shot);
  await sidebarRow(shot, /^\s*Tags/).click();
  await shot.settle();
  await shot.page.mouse.move(640, 790);
  const sidebar = shot.page.locator("aside.sidebar");
  await shot.save(await shot.clipPanel(sidebar, [sidebar.locator(".sidebar-row").last()], 16));
}, branchesScenario);

define("branch-context-menu", async (shot) => {
  await openBranches(shot);
  await sidebarRow(shot, "tax-rates").click({ button: "right" });
  await shot.menu().waitFor();
  const sidebar = shot.page.locator("aside.sidebar");
  const panel = await shot.clipPanel(sidebar, [shot.menu(), sidebar.locator(".sidebar-row").last()], 16);
  const across = await shot.clipAround([sidebar, shot.menu()], { right: 16 });
  await shot.save({ x: across.x, width: across.width, y: panel.y, height: panel.height });
}, branchesScenario);

define("remote-buttons", async (shot) => {
  const header = shot.page.locator("header.header");
  await shot.page.mouse.move(640, 500);
  const buttons = [
    header.getByTitle("Fetch all remotes"),
    header.getByTitle("Pull", { exact: true }),
    header.getByTitle(/^Push/),
    header.getByTitle("Stash changes"),
  ];
  const clip = await shot.clipAround(buttons, { left: 12, right: 6 });
  const headerBox = await header.boundingBox();
  await shot.save({ ...clip, y: headerBox?.y ?? 0, height: headerBox?.height ?? clip.height });
});

define("stashes", async (shot) => {
  await openBranches(shot);
  const stash = sidebarRow(shot, "WIP: free shipping threshold");
  await stash.hover();
  await shot.settle();
  const section = sidebarRow(shot, /^\s*Stashes/);
  const sidebar = await shot.page.locator("aside.sidebar").boundingBox();
  const sectionBox = await section.boundingBox();
  const stashBox = await stash.boundingBox();
  if (!sidebar || !sectionBox || !stashBox) {
    throw new Error("stashes: the stash list is not visible");
  }
  const top = Math.max(sidebar.y, sectionBox.y - 120);
  await shot.save({ x: sidebar.x, y: top, width: sidebar.width, height: stashBox.y + stashBox.height + 16 - top });
}, branchesScenario);

define("back-forward", async (shot) => {
  await shot.openFile(cartTs());
  await shot.openFile(join(storefront, "src/catalog.ts"));
  await shot.openFile(join(storefront, "src/pricing.ts"));
  await shot.page.getByRole("button", { name: "Go back" }).click();
  await shot.settle();
  await shot.page.mouse.move(640, 500);
  const header = shot.page.locator("header.header");
  const headerBox = await header.boundingBox();
  const clip = await shot.clipAround([shot.page.getByRole("group", { name: "Navigation history" }), header.getByTitle(/^Branch:/)], { left: 0, right: 12 });
  await shot.save({ ...clip, y: headerBox?.y ?? 0, height: headerBox?.height ?? clip.height });
});

for (const [name, section] of [
  ["settings-appearance", "Appearance"],
  ["settings-editor", "Editor"],
  ["settings-merge", "Merge and Log"],
  ["settings-layout", "Layout"],
  ["settings-updates", "Updates"],
  ["settings-files", "Settings Files"],
  ["settings-about", "About"],
] as const) {
  define(name, async (shot) => {
    const dialog = await openSettings(shot, section);
    await shot.page.mouse.move(5, 790);
    await shot.save(dialog);
  }, () => (name === "settings-files" ? { settings: { tabSize: 2, wordWrap: true } } : {}));
}

// The Editor section scrolls; this is its lower half (ligatures, tab size, word wrap, blame).
define("settings-editor-more", async (shot) => {
  const dialog = await openSettings(shot, "Editor");
  await dialog.locator(".rows").evaluate((rows) => {
    rows.scrollTop = rows.scrollHeight;
  });
  await shot.page.mouse.move(5, 790);
  await shot.save(dialog);
});

define("settings-state-error", async (shot) => {
  // The start-up toast points at Settings; dismiss it so only the banner tells the story.
  const toastError = shot.page.locator(".toasts .toast.error", { hasText: "state.json could not be read" });
  await toastError.waitFor();
  await toastError.getByRole("button", { name: "Dismiss" }).click();
  const dialog = await openSettings(shot, "Settings Files");
  await dialog.getByText("state.json could not be read").waitFor();
  await shot.page.mouse.move(5, 790);
  await shot.save(dialog);
}, () => ({ stateLoadError: "/Users/you/.gitmanager/state.json is not valid JSON: expected value at line 1 column 1" }));

define("editor-conflict-toolbar", async (shot) => {
  await shot.activateRepo("payments-api");
  await shot.openFile(appTs());
  await shot.page.locator(".cm-conflict-actions").first().waitFor();
  await shot.page.mouse.move(640, 790);
  const host = shot.page.locator(".file-host:not(.hidden)");
  await shot.save(await shot.clipAround([host.locator(".title-row"), host.getByRole("toolbar", { name: "File actions" })], { bottom: 4 }));
}, () => ({ settings: { currentLineBlame: false } }));

define("diff-hunk-staging", async (shot) => {
  await collapseRepo(shot, "payments-api");
  await shot.page.getByRole("button", { name: "Hide files" }).click();
  await shot.page.getByRole("group", { name: "storefront", exact: true }).getByRole("group", { name: "Changes" }).getByText("cart.ts").click();
  await shot.page.locator(".diff-view .diff-revert").first().waitFor();
  await shot.settle(500);
  const stage = shot.page.locator(".diff-view .diff-revert").first();
  await stage.hover();
  await shot.settle();
  const view = shot.page.locator(".diff-view");
  const across = await shot.clipAround([view], 0);
  const down = await shot.clipAround([view.locator(".toolbar"), stage], { bottom: 150 });
  await shot.save({ x: across.x, width: across.width, y: down.y, height: down.height });
});

define("empty-main", async (shot) => {
  await shot.page.mouse.move(640, 790);
  const main = await shot.clipAround([shot.page.locator("main.main")]);
  const content = await shot.clipAround([shot.page.locator("main.main .empty .logo"), shot.page.locator("main.main .empty .actions")], 56);
  await shot.save({ x: main.x, width: main.width, y: content.y, height: content.height });
});

define("git-progress", async (shot) => {
  await shot.page.getByTitle("Fetch all remotes").click();
  const busy = shot.page.locator("header .busy");
  await busy.waitFor();
  await shot.page.mouse.move(640, 500);
  const header = shot.page.locator("header.header");
  const headerBox = await header.boundingBox();
  const clip = await shot.clipAround([busy, header.getByTitle("Settings (Cmd+,)")], { left: 14, right: 14 });
  await shot.save({ ...clip, y: headerBox?.y ?? 0, height: headerBox?.height ?? clip.height }, { settle: false });
}, () => ({ holdFetchMs: 6000 }));

define("scan-repositories", async (shot) => {
  const pill = shot.page.locator("header .pill").first();
  const pillBox = await pill.boundingBox();
  await pill.click({ position: { x: 12, y: (pillBox?.height ?? 28) - 3 } });
  await shot.menu().getByRole("menuitem", { name: "Scan for Repositories" }).waitFor();
  await shot.page.mouse.move(640, 700);
  await shot.save(await shot.clipAround([shot.page.locator("header .left"), shot.menu()], { top: 0, left: 0, right: 40, bottom: 24 }));
}, () => ({ state: { recentFolders: [designSystem] } }));

define("dark-theme", async (shot) => {
  await overview(shot);
  await shot.save();
}, () => ({ colorScheme: "dark" }));

define("update-dialog", async (shot) => {
  // The first automatic check runs 30 seconds after start; jump there instead of waiting.
  await shot.page.clock.fastForward(31000);
  const item = shot.page.getByRole("button", { name: /Update available/ });
  await item.waitFor();
  await item.click();
  const dialog = shot.page.getByRole("dialog");
  await dialog.waitFor();
  await shot.page.mouse.move(5, 790);
  await shot.save(dialog);
}, () => ({ releases: githubReleases(), clock: true }));

// A manual check opens the dialog even for a skipped newest release, marked as skipped.
define("update-dialog-skipped", async (shot) => {
  const settingsDialog = await openSettings(shot, "Updates");
  await settingsDialog.getByRole("button", { name: "Check Now", exact: true }).click();
  const dialog = shot.page.getByRole("dialog", { name: /is available/ });
  await dialog.waitFor();
  await dialog.getByText("You skipped this version.").waitFor();
  await dialog.getByRole("button", { name: "Stop Skipping", exact: true }).waitFor();
  await shot.page.mouse.move(5, 790);
  await shot.save(dialog);
}, () => ({ releases: githubReleases(), state: { skippedVersion: "0.1.0" } }));

define("whats-new", async (shot) => {
  const dialog = shot.page.getByRole("dialog");
  await dialog.waitFor();
  await shot.page.mouse.move(5, 790);
  await shot.save(dialog);
}, () => ({ state: { lastRunVersion: "0.0.9" } }));

define("status-bar", async (shot) => {
  await shot.openFile(cartTs());
  await clickLine(shot, "useDiscount(code");
  await shot.page.locator("footer.status-bar").getByText(/Memory/).waitFor();
  await shot.save(shot.page.locator("footer.status-bar"));
});

define("help-menu", async (shot) => {
  await shot.page.getByRole("button", { name: "Report an issue" }).click();
  await shot.menu().waitFor();
  const bar = await shot.page.locator("footer.status-bar").boundingBox();
  const menu = await shot.menu().boundingBox();
  if (!bar || !menu) {
    throw new Error("help-menu: menu not visible");
  }
  const left = Math.max(0, Math.min(menu.x, VIEWPORT.width - 480) - 16);
  const top = menu.y - 16;
  await shot.save({ x: left, y: top, width: VIEWPORT.width - left, height: VIEWPORT.height - top });
});

define("mergetool-mode", async (shot) => {
  await shot.page.locator(".mergetool .cm-editor").nth(2).waitFor();
  await shot.settle(600);
  await shot.page.mouse.move(640, 790);
  await shot.save();
}, () => ({
  launch: {
    mode: "mergeTool",
    base: join(paymentsApi, "src/app_BASE_4242.ts"),
    local: join(paymentsApi, "src/app_LOCAL_4242.ts"),
    remote: join(paymentsApi, "src/app_REMOTE_4242.ts"),
    merged: appTs(),
  },
  mergetool: { repoPath: paymentsApi, conflictPath: "src/app.ts" },
}));


// ---------------------------------------------------------------------------------------------

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes("--list")) {
    console.log(shots.map((spec) => spec.name).join("\n"));
    return;
  }
  const wanted = new Set(args.map((arg) => arg.replace(/\.png$/, "")));
  const unknown = [...wanted].filter((name) => !shots.some((spec) => spec.name === name));
  if (unknown.length > 0) {
    throw new Error(`Unknown screenshot: ${unknown.join(", ")}. Try --list.`);
  }
  const selected = wanted.size > 0 ? shots.filter((spec) => wanted.has(spec.name)) : shots;

  try {
    await fetch(DEV_SERVER);
  } catch {
    throw new Error(`No dev server on ${DEV_SERVER}. Start the app with GM_IPC_BRIDGE=1 bun tauri dev.`);
  }
  buildDemo();
  mkdirSync(OUT_DIR, { recursive: true });

  const browser = await webkit.launch();
  const failed: string[] = [];
  try {
    for (const spec of selected) {
      const started = Date.now();
      process.stdout.write(`${spec.name} ... `);
      // One retry: a dev server reload or a slow first response can break a single attempt.
      let lastError: unknown = null;
      for (let attempt = 1; attempt <= 2; attempt++) {
        let context: BrowserContext | null = null;
        try {
          const opened = await openApp(browser, spec.name, spec.scenario?.() ?? {});
          context = opened.context;
          await spec.run(opened.shot);
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
          if (attempt === 1) {
            process.stdout.write("retrying ... ");
          }
        } finally {
          await context?.close();
        }
      }
      if (lastError) {
        failed.push(spec.name);
        console.log("FAILED");
        console.error(`  ${lastError instanceof Error ? lastError.message : String(lastError)}`);
      } else {
        const size = statSync(join(OUT_DIR, `${spec.name}.png`)).size;
        console.log(`${(size / 1024).toFixed(0)} KB, ${((Date.now() - started) / 1000).toFixed(1)}s`);
      }
    }
  } finally {
    await browser.close();
  }
  if (failed.length > 0) {
    console.error(`\n${failed.length} failed: ${failed.join(", ")}`);
    process.exit(1);
  }
}

await main();
