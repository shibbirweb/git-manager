import { describe, expect, it } from "vitest";
import type { RepoInfo, WorktreeInfo } from "$lib/types";
import { type AgentSession, panelRows, type PanelRow, type ProjectFolder, workspaceProjects } from "./projects";

function repo(root: string, extra: Partial<RepoInfo> = {}): RepoInfo {
  return { root, name: root.slice(root.lastIndexOf("/") + 1), relativePath: "", ...extra };
}

function worktree(path: string, branch: string | null, extra: Partial<WorktreeInfo> = {}): WorktreeInfo {
  return {
    path,
    head: "0123456789abcdef0123456789abcdef01234567",
    branch,
    detached: branch === null,
    bare: false,
    locked: false,
    lockReason: null,
    prunable: false,
    prunableReason: null,
    isMain: false,
    isCurrent: false,
    ...extra,
  };
}

function session(terminalKey: number, folderPath: string): AgentSession {
  return {
    terminalKey,
    name: `Agent ${terminalKey}`,
    folderPath,
    state: "working",
    title: "",
    agentId: "claude",
    changedAt: 0,
  };
}

/** The rows as short strings, so a whole tree reads at a glance. */
function outline(rows: PanelRow[]): string[] {
  return rows.map((row) => {
    switch (row.kind) {
      case "folder":
        return `# ${row.name}`;
      case "project":
        return `${row.expanded ? "v" : ">"} ${row.project.name}${row.sessionCount ? ` (${row.sessionCount})` : ""}`;
      case "worktree":
        return `  ${row.expanded ? "v" : ">"} ${row.label}${row.detail ? ` [${row.detail}]` : ""}${row.missing ? " missing" : ""}`;
      case "session":
        return `${"  ".repeat(row.depth)}- ${row.session.name}`;
    }
  });
}

const app: ProjectFolder = { root: "/work/app", name: "app", repoRoots: ["/work/app", "/work/app/libs/ui"] };

describe("workspaceProjects", () => {
  it("lists repositories in folder order, skips submodules and keeps a folder without a repository", () => {
    // The app folder is a repository itself, so it is listed once, as the repository.
    const folders: ProjectFolder[] = [app, { root: "/work/notes", name: "notes", repoRoots: [] }];
    const repos = [repo("/work/app"), repo("/work/app/libs/ui"), repo("/work/app/vendor/x", { submodule: true })];
    expect(workspaceProjects(folders, repos).map((project) => [project.name, project.isRepo])).toEqual([
      ["app", true],
      ["ui", true],
      ["notes", false],
    ]);
  });

  it("lists every workspace folder, and a repository enclosing two folders once", () => {
    const folders: ProjectFolder[] = [
      { root: "/mono/a", name: "a", repoRoots: ["/mono"] },
      { root: "/mono/b", name: "b", repoRoots: ["/mono"] },
    ];
    expect(workspaceProjects(folders, [repo("/mono")]).map((project) => [project.root, project.isRepo])).toEqual([
      ["/mono/a", false],
      ["/mono", true],
      ["/mono/b", false],
    ]);
  });

  it("marks a linked worktree opened as a repository", () => {
    const folders: ProjectFolder[] = [{ root: "/work/app-fix", name: "app-fix", repoRoots: ["/work/app-fix"] }];
    expect(workspaceProjects(folders, [repo("/work/app-fix", { worktree: true })])[0].linked).toBe(true);
  });

  it("is empty without folders", () => {
    expect(workspaceProjects([], [])).toEqual([]);
  });
});

describe("panelRows", () => {
  const projects = workspaceProjects([app], [repo("/work/app"), repo("/work/app/libs/ui")]);

  it("shows the main worktree first, then linked ones with their folder names", () => {
    const worktrees = {
      "/work/app": [
        worktree("/work/app-login", "fix/login"),
        worktree("/work/app", "main", { isMain: true, isCurrent: true }),
      ],
    };
    expect(outline(panelRows(projects, worktrees, [], new Set()))).toEqual([
      "v app",
      "  v main",
      "  v fix/login [app-login]",
      "v ui",
      "  v main",
    ]);
  });

  it("puts each agent tab under the deepest worktree holding its folder", () => {
    const worktrees = {
      "/work/app": [worktree("/work/app", "main", { isMain: true }), worktree("/work/app-login", "fix/login")],
    };
    const sessions = [session(1, "/work/app"), session(2, "/work/app-login"), session(3, "/work/app/libs/ui/src")];
    expect(outline(panelRows(projects, worktrees, sessions, new Set()))).toEqual([
      "v app (2)",
      "  v main",
      "    - Agent 1",
      "  v fix/login [app-login]",
      "    - Agent 2",
      "v ui (1)",
      "  v main",
      "    - Agent 3",
    ]);
  });

  it("does not match a folder that only shares a name prefix", () => {
    const sessions = [session(1, "/work/app-other")];
    expect(outline(panelRows(projects, {}, sessions, new Set()))).toEqual([
      "v app",
      "  v main",
      "v ui",
      "  v main",
      "# Other folders",
      "  - Agent 1",
    ]);
  });

  it("hides collapsed rows but still counts their agents", () => {
    const sessions = [session(1, "/work/app"), session(2, "/work/app")];
    const collapsed = new Set(["project:/work/app/libs/ui", "worktree:/work/app"]);
    expect(outline(panelRows(projects, {}, sessions, collapsed))).toEqual(["v app (2)", "  > main", "> ui"]);
  });

  it("hides a linked worktree project that its repository already lists", () => {
    const withLinked = workspaceProjects(
      [app, { root: "/work/app-login", name: "app-login", repoRoots: ["/work/app-login"] }],
      [repo("/work/app"), repo("/work/app-login", { worktree: true })],
    );
    const worktrees = {
      "/work/app": [worktree("/work/app", "main", { isMain: true }), worktree("/work/app-login", "fix/login")],
    };
    const names = panelRows(withLinked, worktrees, [], new Set())
      .filter((row) => row.kind === "project")
      .map((row) => (row.kind === "project" ? row.project.name : ""));
    expect(names).toEqual(["app"]);
  });

  it("keeps a linked worktree project whose repository is not open", () => {
    const linkedOnly = workspaceProjects(
      [{ root: "/work/app-login", name: "app-login", repoRoots: ["/work/app-login"] }],
      [repo("/work/app-login", { worktree: true })],
    );
    expect(outline(panelRows(linkedOnly, {}, [], new Set()))).toEqual(["v app-login", "  v app-login"]);
  });

  it("lists agents of a folder without a repository right under it", () => {
    const mixed = workspaceProjects([app, { root: "/work/notes", name: "notes", repoRoots: [] }], [repo("/work/app")]);
    expect(outline(panelRows(mixed, {}, [session(4, "/work/notes/drafts")], new Set()))).toEqual([
      "v app",
      "  v main",
      "v notes (1)",
      "  - Agent 4",
    ]);
  });

  it("marks a worktree whose folder is gone, labels a detached one and skips a bare entry", () => {
    const worktrees = {
      "/work/app": [
        worktree("/work/app.git", null, { bare: true, isMain: true }),
        worktree("/work/app-old", "old", { prunable: true }),
        worktree("/work/app-try", null),
      ],
    };
    const rows = outline(panelRows(projects.slice(0, 1), worktrees, [], new Set()));
    expect(rows).toEqual(["v app", "  v old [app-old] missing", "  v detached at 01234567 [app-try]"]);
  });

  it("shows a repository once when the workspace also opened its linked worktrees, with unique row keys", () => {
    // Found in the app: a moved worktree folder listed the main worktree too, and the panel froze on a repeated key.
    const opened = workspaceProjects(
      [
        {
          root: "/work",
          name: "work",
          repoRoots: ["/work/app", "/work/app-moved", "/work/app-login"],
        },
      ],
      [repo("/work/app"), repo("/work/app-moved", { worktree: true }), repo("/work/app-login", { worktree: true })],
    );
    const list = [worktree("/work/app", "main", { isMain: true }), worktree("/work/app-login", "fix/login")];
    const rows = panelRows(
      opened,
      { "/work/app": list, "/work/app-moved": list, "/work/app-login": list },
      [],
      new Set(),
    );
    expect(outline(rows)).toEqual(["v work", "v app", "  v main", "  v fix/login [app-login]"]);
    expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length);
  });

  it("names a repository after its main folder when only linked worktrees are open", () => {
    const linked = workspaceProjects(
      [{ root: "/work", name: "work", repoRoots: ["/work/app-a", "/work/app-b"] }],
      [repo("/work/app-a", { worktree: true }), repo("/work/app-b", { worktree: true })],
    );
    const list = [
      worktree("/work/app", "main", { isMain: true }),
      worktree("/work/app-a", "a"),
      worktree("/work/app-b", "b"),
    ];
    expect(outline(panelRows(linked, { "/work/app-a": list, "/work/app-b": list }, [], new Set()))).toEqual([
      "v work",
      "v app",
      "  v main",
      "  v a [app-a]",
      "  v b [app-b]",
    ]);
  });

  it("labels a linked worktree whose list could not be read by its folder", () => {
    const broken = workspaceProjects(
      [{ root: "/work/app-moved", name: "app-moved", repoRoots: ["/work/app-moved"] }],
      [repo("/work/app-moved", { worktree: true })],
    );
    expect(outline(panelRows(broken, { "/work/app-moved": [] }, [], new Set()))).toEqual([
      "v app-moved",
      "  v app-moved",
    ]);
  });

  it("lists a worktree once even when two repositories name it", () => {
    const two = workspaceProjects(
      [{ root: "/work", name: "work", repoRoots: ["/work/a", "/work/b"] }],
      [repo("/work/a"), repo("/work/b")],
    );
    const shared = worktree("/work/shared", "shared");
    const rows = panelRows(
      two,
      {
        "/work/a": [worktree("/work/a", "main", { isMain: true }), shared],
        "/work/b": [worktree("/work/b", "main", { isMain: true }), shared],
      },
      [],
      new Set(),
    );
    expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length);
    expect(outline(rows)).toEqual(["v work", "v a", "  v main", "  v shared [shared]", "v b", "  v main"]);
  });

  it("lists a workspace folder that holds repositories as a folder project, like Orca", () => {
    // The demo: ai-test holds the repository app and the plain folder notes.
    const holder = workspaceProjects(
      [{ root: "/work/ai-test", name: "ai-test", repoRoots: ["/work/ai-test/app"] }],
      [repo("/work/ai-test/app")],
    );
    const agents = [session(1, "/work/ai-test"), session(2, "/work/ai-test/notes"), session(3, "/work/ai-test/app")];
    expect(outline(panelRows(holder, {}, agents, new Set()))).toEqual([
      "v ai-test (2)",
      "  - Agent 1",
      "  - Agent 2",
      "v app (1)",
      "  v main",
      "    - Agent 3",
    ]);
  });

  it("matches folders with a trailing slash", () => {
    const sessions = [session(1, "/work/app/")];
    expect(outline(panelRows(projects.slice(0, 1), {}, sessions, new Set()))).toEqual([
      "v app (1)",
      "  v main",
      "    - Agent 1",
    ]);
  });
});
