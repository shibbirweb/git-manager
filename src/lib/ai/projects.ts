// The AI panel's tree, like Orca's sidebar: projects (the workspace's repositories, and folders without one),
// the worktrees of each repository, and the agent tabs running in each worktree. Kept free of Svelte so it can be
// tested directly.

import { baseName } from "$lib/stores/workspacePaths";
import type { RepoInfo, WorktreeInfo } from "$lib/types";
import { sortedWorktrees, worktreeLabel, worktreeTooltip } from "$lib/views/git/worktrees/worktreeModel";

/** What an agent tab is doing, read from its terminal (see agentStatus.ts). */
export type AgentState = "starting" | "working" | "waiting" | "ready" | "done" | "exited";

/** An agent tab as the panel lists it. */
export interface AgentSession {
  terminalKey: number;
  name: string;
  /** The folder the agent runs in: a worktree, or a plain folder. */
  folderPath: string;
  state: AgentState;
  /** The agent's own title for what it does, without its spinner; may be empty. */
  title: string;
  /** Which agent (agents.ts), for its mark. */
  agentId: string;
  /** When its state last changed (ms since the epoch). */
  changedAt: number;
}

/** A workspace folder and the repositories found in it. */
export interface ProjectFolder {
  root: string;
  name: string;
  repoRoots: string[];
}

export interface Project {
  /** The repository's root, or the folder itself when it has no repository. */
  root: string;
  name: string;
  /** Name of the workspace folder it was found in. */
  folderName: string;
  isRepo: boolean;
  /** A linked worktree that the workspace opened as a repository of its own. */
  linked: boolean;
}

export type PanelRow =
  | { kind: "folder"; key: string; name: string }
  | { kind: "project"; key: string; project: Project; expanded: boolean; sessionCount: number }
  | {
      kind: "worktree";
      key: string;
      project: Project;
      /** As `git worktree list` gave it; a stand-in main worktree until the list is loaded. */
      worktree: WorktreeInfo;
      path: string;
      label: string;
      /** The worktree's folder name, shown beside a linked worktree's branch. */
      detail: string;
      tooltip: string;
      isMain: boolean;
      /** Its folder is gone (`git worktree prune` would remove it). */
      missing: boolean;
      expanded: boolean;
      sessionCount: number;
    }
  | { kind: "session"; key: string; session: AgentSession; depth: number };

/**
 * The workspace's projects, in folder order, like Orca: every workspace folder (a plain folder project, unless the
 * folder is a repository itself), then the repositories found in it (not submodules).
 */
export function workspaceProjects(folders: readonly ProjectFolder[], repos: readonly RepoInfo[]): Project[] {
  const projects: Project[] = [];
  const seen = new Set<string>();
  for (const folder of folders) {
    const inFolder = repos.filter((repo) => !repo.submodule && folder.repoRoots.includes(repo.root));
    const isRepo = inFolder.some((repo) => trimSlash(repo.root) === trimSlash(folder.root));
    if (!isRepo && !seen.has(folder.root)) {
      seen.add(folder.root);
      projects.push({ root: folder.root, name: folder.name, folderName: folder.name, isRepo: false, linked: false });
    }
    for (const repo of inFolder) {
      if (seen.has(repo.root)) {
        continue;
      }
      seen.add(repo.root);
      projects.push({
        root: repo.root,
        name: repo.name,
        folderName: folder.name,
        isRepo: true,
        linked: repo.worktree ?? false,
      });
    }
  }
  return projects;
}

function trimSlash(folderPath: string): string {
  return folderPath.length > 1 ? folderPath.replace(/\/+$/, "") : folderPath;
}

function contains(folderPath: string, filePath: string): boolean {
  const folder = trimSlash(folderPath);
  const target = trimSlash(filePath);
  return target === folder || target.startsWith(folder === "/" ? "/" : `${folder}/`);
}

interface Place {
  path: string;
  sessions: AgentSession[];
}

/** The worktrees a repository lists: loaded ones without bare entries, else its own root as the main one. */
type WorktreesByRoot = Readonly<Record<string, WorktreeInfo[] | undefined>>;

function worktreesOf(project: Project, worktreesByRoot: WorktreesByRoot): WorktreeInfo[] {
  const loaded = (worktreesByRoot[project.root] ?? []).filter((worktree) => !worktree.bare);
  if (loaded.length > 0) {
    return sortedWorktrees(loaded);
  }
  return [
    {
      path: project.root,
      head: null,
      branch: null,
      detached: false,
      bare: false,
      locked: false,
      lockReason: null,
      prunable: false,
      prunableReason: null,
      isMain: true,
      isCurrent: true,
    },
  ];
}

/** Every listed worktree's main worktree, from whichever lists are loaded. */
function mainRoots(worktreesByRoot: WorktreesByRoot): Map<string, string> {
  const mains = new Map<string, string>();
  for (const list of Object.values(worktreesByRoot)) {
    const main = list?.find((worktree) => worktree.isMain && !worktree.bare);
    if (main) {
      for (const worktree of list ?? []) {
        mains.set(trimSlash(worktree.path), trimSlash(main.path));
      }
    }
  }
  return mains;
}

/**
 * One project per repository: a linked worktree opened as a folder joins the project of its main worktree (the main
 * one shows it, else the first one, named after the main folder).
 */
function oneProjectPerRepository(projects: readonly Project[], worktreesByRoot: WorktreesByRoot): Project[] {
  const mains = mainRoots(worktreesByRoot);
  // Its own list first: a moved worktree folder is listed by its old path, but its list still names the main one.
  const mainRootOf = (project: Project) => {
    const own = (worktreesByRoot[project.root] ?? []).find((worktree) => worktree.isMain && !worktree.bare);
    return own ? trimSlash(own.path) : (mains.get(trimSlash(project.root)) ?? trimSlash(project.root));
  };
  const byMain = new Map<string, Project>();
  for (const project of projects) {
    const mainRoot = project.isRepo ? mainRootOf(project) : `folder:${trimSlash(project.root)}`;
    const held = byMain.get(mainRoot);
    if (!held || (trimSlash(project.root) === mainRoot && trimSlash(held.root) !== mainRoot)) {
      byMain.set(mainRoot, project);
    }
  }
  return projects
    .filter((project) => [...byMain.values()].includes(project))
    .map((project) => {
      const mainRoot = project.isRepo ? mainRootOf(project) : trimSlash(project.root);
      return mainRoot === trimSlash(project.root) ? project : { ...project, name: baseName(mainRoot) };
    });
}

/**
 * The rows of the panel. `collapsed` holds the keys of collapsed rows ("project:<root>", "worktree:<path>");
 * everything else is open. Each repository is one project, however many of its worktrees the workspace opened.
 * Agent tabs go to the deepest worktree or folder holding their folder; tabs outside every project come last.
 * A worktree is listed once even when two lists name it, so row keys never repeat.
 */
export function panelRows(
  projects: readonly Project[],
  worktreesByRoot: WorktreesByRoot,
  sessions: readonly AgentSession[],
  collapsed: ReadonlySet<string>,
): PanelRow[] {
  const shown = oneProjectPerRepository(projects, worktreesByRoot);

  const worktreeLists = new Map(
    shown.map((project) => [project.root, project.isRepo ? worktreesOf(project, worktreesByRoot) : []]),
  );
  const places: Place[] = [];
  const placeOf = new Map<string, Place>();
  const owner = new Map<string, string>();
  for (const project of shown) {
    const worktrees = worktreeLists.get(project.root) ?? [];
    const paths = project.isRepo ? worktrees.map((worktree) => worktree.path) : [project.root];
    for (const path of paths) {
      const key = trimSlash(path);
      if (!placeOf.has(key)) {
        const place = { path, sessions: [] };
        placeOf.set(key, place);
        owner.set(key, project.root);
        places.push(place);
      }
    }
  }
  const unplaced: AgentSession[] = [];
  for (const session of sessions) {
    let best: Place | null = null;
    for (const place of places) {
      if (contains(place.path, session.folderPath) && (best === null || place.path.length > best.path.length)) {
        best = place;
      }
    }
    if (best) {
      best.sessions.push(session);
    } else {
      unplaced.push(session);
    }
  }

  const rows: PanelRow[] = [];
  for (const project of shown) {
    const projectKey = `project:${project.root}`;
    const expanded = !collapsed.has(projectKey);
    if (!project.isRepo) {
      const own = placeOf.get(trimSlash(project.root))?.sessions ?? [];
      rows.push({ kind: "project", key: projectKey, project, expanded, sessionCount: own.length });
      if (expanded) {
        for (const session of own) {
          rows.push({ kind: "session", key: `session:${session.terminalKey}`, session, depth: 1 });
        }
      }
      continue;
    }
    // A worktree another project already lists stays there.
    const worktrees = (worktreeLists.get(project.root) ?? []).filter(
      (worktree) => owner.get(trimSlash(worktree.path)) === project.root,
    );
    const sessionCount = worktrees.reduce(
      (count, worktree) => count + (placeOf.get(trimSlash(worktree.path))?.sessions.length ?? 0),
      0,
    );
    rows.push({ kind: "project", key: projectKey, project, expanded, sessionCount });
    if (!expanded) {
      continue;
    }
    for (const worktree of worktrees) {
      const worktreeKey = `worktree:${trimSlash(worktree.path)}`;
      const own = placeOf.get(trimSlash(worktree.path))?.sessions ?? [];
      const worktreeExpanded = !collapsed.has(worktreeKey);
      const known = worktree.branch !== null || worktree.head !== null;
      const label = known ? worktreeLabel(worktree) : project.linked ? baseName(worktree.path) : "main";
      rows.push({
        kind: "worktree",
        key: worktreeKey,
        project,
        worktree,
        path: worktree.path,
        label,
        detail: worktree.isMain ? "" : baseName(worktree.path),
        tooltip: known ? worktreeTooltip(worktree) : worktree.path,
        isMain: worktree.isMain,
        missing: worktree.prunable,
        expanded: worktreeExpanded,
        sessionCount: own.length,
      });
      if (worktreeExpanded) {
        for (const session of own) {
          rows.push({ kind: "session", key: `session:${session.terminalKey}`, session, depth: 2 });
        }
      }
    }
  }
  if (unplaced.length > 0) {
    rows.push({ kind: "folder", key: "folder:other", name: "Other folders" });
    for (const session of unplaced) {
      rows.push({ kind: "session", key: `session:${session.terminalKey}`, session, depth: 1 });
    }
  }
  return rows;
}
